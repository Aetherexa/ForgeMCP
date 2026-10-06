import { ForgeApplicationBuilder } from "@forgemcp/application";
import {
  createServiceToken,
  LifecycleState,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

class GreetingService {
  public constructor(private readonly prefix: string) {}

  public greet(name: string): string {
    return `${this.prefix}, ${name}!`;
  }
}

describe("ForgeMCP service integration", () => {
  it("flows configuration through a service and module into MCP execution", async () => {
    const greetingServiceToken =
      createServiceToken<GreetingService>("greetingService");
    let constructions = 0;

    class GreetingModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const greetingService =
          builder.services.require(greetingServiceToken);

        builder.tool({
          metadata: {
            name: "greet",
            description: "Returns a greeting from an application service.",
          },
          execute() {
            return {
              value: greetingService.greet("ForgeMCP"),
            };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .configure({
        "greeting.prefix": "Hello",
      })
      .provideFactory(greetingServiceToken, ({ configuration }) => {
        constructions += 1;

        return new GreetingService(
          configuration.require("greeting.prefix"),
        );
      })
      .use(GreetingModule)
      .build();

    const server = await createForgeMcpServer({
      name: "service-integration-test",
      version: "0.3.0",
      createApplication: () => application,
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "service-integration-client",
      version: "0.3.0",
    });

    await client.connect(clientTransport);

    try {
      const first = await client.callTool({
        name: "greet",
        arguments: {},
      });
      const second = await client.callTool({
        name: "greet",
        arguments: {},
      });

      expect(getText(first)).toBe("Hello, ForgeMCP!");
      expect(getText(second)).toBe("Hello, ForgeMCP!");
      expect(constructions).toBe(1);
      expect(application.state).toBe(LifecycleState.Started);
    } finally {
      await client.close();
      await server.close();
    }

    expect(application.state).toBe(LifecycleState.Stopped);
  });
});

function getText(result: CallToolResult): string | undefined {
  const block = result.content.find((item) => item.type === "text");

  return block?.type === "text" ? block.text : undefined;
}
