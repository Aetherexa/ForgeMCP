import { ForgeApplicationBuilder } from "@forgemcp/application";
import type {
  Module,
  ModuleBuilder,
  ModuleType,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  type CallToolResult,
  InMemoryTransport,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("createForgeMcpServer module dependencies", () => {
  it("exposes a dependent module after dependency-first composition", async () => {
    const configurationOrder: string[] = [];

    class FoundationModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        configurationOrder.push("foundation");
      }
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(builder: ModuleBuilder): void {
        configurationOrder.push("feature");

        builder.tool({
          metadata: {
            name: "module-order",
            description: "Returns the module configuration order.",
          },
          execute() {
            return {
              value: {
                order: [...configurationOrder],
              },
            };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-module-dependency-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .use(FeatureModule)
          .use(FoundationModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-module-dependency-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const listed = await client.listTools();

      expect(listed.tools.map((tool) => tool.name)).toEqual(["module-order"]);

      const result = getJson<{ order: string[] }>(
        await client.callTool({
          name: "module-order",
          arguments: {},
        }),
      );

      expect(result.order).toEqual(["foundation", "feature"]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects a missing module dependency before MCP serving is available", async () => {
    let configurations = 0;

    class MissingModule implements Module {
      public configure(_builder: ModuleBuilder): void {}
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        MissingModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        configurations += 1;
      }
    }

    await expect(
      createForgeMcpServer({
        name: "forgemcp-missing-module-test",
        version: "0.2.0",
        createApplication: () =>
          ForgeApplicationBuilder.create().use(FeatureModule).build(),
      }),
    ).rejects.toThrow(
      "Module 'FeatureModule' requires module 'MissingModule', but it is not registered.",
    );

    expect(configurations).toBe(0);
  });

  it("rejects a circular module graph before MCP serving is available", async () => {
    let configurations = 0;

    class FirstModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [SecondModule];
      }

      public configure(_builder: ModuleBuilder): void {
        configurations += 1;
      }
    }

    class SecondModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [FirstModule];
      }

      public configure(_builder: ModuleBuilder): void {
        configurations += 1;
      }
    }

    await expect(
      createForgeMcpServer({
        name: "forgemcp-circular-module-test",
        version: "0.2.0",
        createApplication: () =>
          ForgeApplicationBuilder.create()
            .use(FirstModule)
            .use(SecondModule)
            .build(),
      }),
    ).rejects.toThrow(
      "Circular module dependency detected: 'FirstModule' -> 'SecondModule' -> 'FirstModule'.",
    );

    expect(configurations).toBe(0);
  });
});

function getJson<TResult>(result: CallToolResult): TResult {
  const block = result.content.find((item) => item.type === "text");

  if (block?.type !== "text") {
    throw new Error("Expected MCP tool result to contain a text block.");
  }

  return JSON.parse(block.text) as TResult;
}
