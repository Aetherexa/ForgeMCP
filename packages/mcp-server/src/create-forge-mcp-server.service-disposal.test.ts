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

interface DisposalResult {
  readonly applicationId: number;
  readonly scopedId: number;
  readonly transientIds: readonly [number, number];
}

describe("createForgeMcpServer service disposal", () => {
  it("disposes request-owned services per MCP call and application services on close", async () => {
    const applicationToken = createServiceToken<{ id: number }>("application");
    const providedToken = createServiceToken<object>("provided");
    const scopedToken = createServiceToken<{ id: number }>("scoped");
    const transientToken = createServiceToken<{ id: number }>("transient");

    const disposalEvents: string[] = [];
    let scopedId = 0;
    let transientId = 0;
    let providedDisposals = 0;

    const provided = {
      [Symbol.dispose]() {
        providedDisposals += 1;
      },
    };

    class DisposalModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: {
            name: "disposal",
            description: "Returns service identities for one MCP execution.",
          },
          async execute(context) {
            const application =
              await context.services.require(applicationToken);
            const scoped = await context.services.require(scopedToken);
            const firstTransient =
              await context.services.require(transientToken);
            const secondTransient =
              await context.services.require(transientToken);

            return {
              value: {
                applicationId: application.id,
                scopedId: scoped.id,
                transientIds: [firstTransient.id, secondTransient.id],
              },
            };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-disposal-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .provide(providedToken, provided)
          .provideFactory(applicationToken, () => ({
            id: 1,
            [Symbol.dispose]() {
              disposalEvents.push("application");
            },
          }))
          .provideScopedFactory(scopedToken, () => {
            const id = ++scopedId;

            return {
              id,
              [Symbol.dispose]() {
                disposalEvents.push(`scoped:${id}`);
              },
            };
          })
          .provideTransientFactory(transientToken, () => {
            const id = ++transientId;

            return {
              id,
              [Symbol.dispose]() {
                disposalEvents.push(`transient:${id}`);
              },
            };
          })
          .use(DisposalModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-disposal-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const first = getJson<DisposalResult>(
        await client.callTool({
          name: "disposal",
          arguments: {},
        }),
      );

      expect(first).toEqual({
        applicationId: 1,
        scopedId: 1,
        transientIds: [1, 2],
      });
      expect(disposalEvents).toEqual([
        "transient:2",
        "transient:1",
        "scoped:1",
      ]);

      const second = getJson<DisposalResult>(
        await client.callTool({
          name: "disposal",
          arguments: {},
        }),
      );

      expect(second).toEqual({
        applicationId: 1,
        scopedId: 2,
        transientIds: [3, 4],
      });
      expect(disposalEvents).toEqual([
        "transient:2",
        "transient:1",
        "scoped:1",
        "transient:4",
        "transient:3",
        "scoped:2",
      ]);
      expect(providedDisposals).toBe(0);

      await server.close();

      expect(disposalEvents).toEqual([
        "transient:2",
        "transient:1",
        "scoped:1",
        "transient:4",
        "transient:3",
        "scoped:2",
        "application",
      ]);
      expect(providedDisposals).toBe(0);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not dispose application services before an in-flight MCP call finishes", async () => {
    const applicationToken = createServiceToken<{
      readonly disposed: boolean;
    }>("application");
    const scopedToken = createServiceToken<object>("scoped");

    const disposalEvents: string[] = [];
    let applicationDisposed = false;
    let enteredExecution: (() => void) | undefined;
    let releaseExecution: (() => void) | undefined;

    const executionEntered = new Promise<void>((resolve) => {
      enteredExecution = resolve;
    });
    const executionRelease = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });

    class DrainModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "drain" },
          async execute(context) {
            const application =
              await context.services.require(applicationToken);
            await context.services.require(scopedToken);

            expect(application.disposed).toBe(false);
            enteredExecution?.();

            await executionRelease;

            expect(application.disposed).toBe(false);
            return { value: "finished" };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-drain-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .provideFactory(applicationToken, () => ({
            get disposed() {
              return applicationDisposed;
            },
            [Symbol.dispose]() {
              applicationDisposed = true;
              disposalEvents.push("application");
            },
          }))
          .provideScopedFactory(scopedToken, () => ({
            [Symbol.dispose]() {
              disposalEvents.push("scoped");
            },
          }))
          .use(DrainModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-drain-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    const call = client.callTool({
      name: "drain",
      arguments: {},
    });

    await executionEntered;

    const closing = server.close();

    expect(applicationDisposed).toBe(false);
    expect(disposalEvents).toEqual([]);

    releaseExecution?.();

    const callOutcome = await Promise.allSettled([call]);

    await closing;

    expect(callOutcome).toHaveLength(1);
    expect(disposalEvents).toEqual(["scoped", "application"]);
    expect(applicationDisposed).toBe(true);

    await client.close();
  });
});

function getJson<TResult>(result: CallToolResult): TResult {
  const block = result.content.find((item) => item.type === "text");

  if (block?.type !== "text") {
    throw new Error("Expected MCP tool result to contain a text block.");
  }

  return JSON.parse(block.text) as TResult;
}
