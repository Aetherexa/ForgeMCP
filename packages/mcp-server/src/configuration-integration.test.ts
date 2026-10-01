import {
  EnvironmentConfigurationSource,
  ForgeApplicationBuilder,
} from "@forgemcp/application";
import type { Module, ModuleBuilder } from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("ForgeMCP configuration integration", () => {
  it("flows environment-backed configuration through a module to an MCP tool", async () => {
    class GreetingModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const greeting = builder.configuration.require("greeting.message");

        builder.tool({
          metadata: {
            name: "greeting",
            description: "Returns the configured greeting.",
          },
          execute() {
            return { value: greeting };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "configuration-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .configure({
            "greeting.message": "default",
          })
          .configureFrom(
            new EnvironmentConfigurationSource({
              prefix: "TEST_",
              environment: {
                TEST_GREETING__MESSAGE: "hello from configuration",
              },
            }),
          )
          .use(GreetingModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "configuration-test-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "greeting",
        arguments: {},
      });

      expect(getText(result)).toBe("hello from configuration");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function getText(result: CallToolResult): string | undefined {
  const block = result.content.find((item) => item.type === "text");

  return block?.type === "text" ? block.text : undefined;
}
