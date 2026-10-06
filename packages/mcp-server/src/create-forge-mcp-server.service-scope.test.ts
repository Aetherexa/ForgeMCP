import { ForgeApplicationBuilder } from "@forgemcp/application";
import {
  createServiceToken,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  type CallToolResult,
  InMemoryTransport,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

interface LifetimeResult {
  readonly applicationId: number;
  readonly scopedId: number;
  readonly transientIds: readonly [number, number];
}

describe("createForgeMcpServer service lifetimes", () => {
  it("preserves application, scoped, and transient semantics across MCP calls", async () => {
    const applicationToken = createServiceToken<{ id: number }>("application");
    const scopedToken = createServiceToken<{
      id: number;
      application: { id: number };
    }>("scoped");
    const transientToken = createServiceToken<{ id: number }>("transient");

    let applicationConstructions = 0;
    let scopedConstructions = 0;
    let transientConstructions = 0;

    class LifetimeModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: {
            name: "lifetimes",
            description: "Returns service identities for the current MCP call.",
          },
          async execute(context) {
            const scoped = await context.services.require(scopedToken);
            const firstTransient =
              await context.services.require(transientToken);
            const secondTransient =
              await context.services.require(transientToken);

            return {
              value: {
                applicationId: scoped.application.id,
                scopedId: scoped.id,
                transientIds: [firstTransient.id, secondTransient.id],
              },
            };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-lifetime-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .provideFactory(applicationToken, () => ({
            id: ++applicationConstructions,
          }))
          .provideScopedFactory(scopedToken, async ({ services }) => ({
            id: ++scopedConstructions,
            application: await services.require(applicationToken),
          }))
          .provideTransientFactory(transientToken, () => ({
            id: ++transientConstructions,
          }))
          .use(LifetimeModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-lifetime-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const first = getJson<LifetimeResult>(
        await client.callTool({
          name: "lifetimes",
          arguments: {},
        }),
      );
      const second = getJson<LifetimeResult>(
        await client.callTool({
          name: "lifetimes",
          arguments: {},
        }),
      );

      expect(first.applicationId).toBe(second.applicationId);
      expect(first.scopedId).not.toBe(second.scopedId);
      expect(first.transientIds[0]).not.toBe(first.transientIds[1]);
      expect(second.transientIds[0]).not.toBe(second.transientIds[1]);
      expect(
        new Set([...first.transientIds, ...second.transientIds]).size,
      ).toBe(4);

      expect(applicationConstructions).toBe(1);
      expect(scopedConstructions).toBe(2);
      expect(transientConstructions).toBe(4);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps overlapping MCP tool calls in isolated execution scopes", async () => {
    const applicationToken = createServiceToken<{ id: number }>("application");
    const scopedToken = createServiceToken<{
      id: number;
      application: { id: number };
    }>("scoped");

    let applicationConstructions = 0;
    let scopedConstructions = 0;
    let enteredExecutions = 0;
    let releaseExecutions: (() => void) | undefined;
    const bothExecutionsEntered = new Promise<void>((resolve) => {
      releaseExecutions = resolve;
    });

    class ConcurrentModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: {
            name: "concurrent-lifetime",
          },
          async execute(context) {
            const scoped = await context.services.require(scopedToken);
            enteredExecutions += 1;

            if (enteredExecutions === 2) {
              releaseExecutions?.();
            }

            await bothExecutionsEntered;

            return {
              value: {
                applicationId: scoped.application.id,
                scopedId: scoped.id,
              },
            };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-concurrency-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .provideFactory(applicationToken, () => ({
            id: ++applicationConstructions,
          }))
          .provideScopedFactory(scopedToken, async ({ services }) => ({
            id: ++scopedConstructions,
            application: await services.require(applicationToken),
          }))
          .use(ConcurrentModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-concurrency-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const [firstResult, secondResult] = await Promise.all([
        client.callTool({
          name: "concurrent-lifetime",
          arguments: {},
        }),
        client.callTool({
          name: "concurrent-lifetime",
          arguments: {},
        }),
      ]);

      const first = getJson<{
        applicationId: number;
        scopedId: number;
      }>(firstResult);
      const second = getJson<{
        applicationId: number;
        scopedId: number;
      }>(secondResult);

      expect(enteredExecutions).toBe(2);
      expect(first.applicationId).toBe(second.applicationId);
      expect(first.scopedId).not.toBe(second.scopedId);
      expect(applicationConstructions).toBe(1);
      expect(scopedConstructions).toBe(2);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function getJson<TResult>(result: CallToolResult): TResult {
  const block = result.content.find((item) => item.type === "text");

  if (block?.type !== "text") {
    throw new Error("Expected MCP tool result to contain a text block.");
  }

  return JSON.parse(block.text) as TResult;
}
