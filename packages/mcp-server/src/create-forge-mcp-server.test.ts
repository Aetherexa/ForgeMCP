import {
  InMemoryTransport,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { ForgeApplicationBuilder } from "@forgemcp/application";
import type { Module, ModuleBuilder, Tool } from "@forgemcp/core";
import { describe, expect, it } from "vitest";
import * as z from "zod/v4";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("createForgeMcpServer", () => {
  it("exposes ForgeMCP tools through the official MCP SDK", async () => {
    let requestId: unknown;

    const echoTool: Tool<{ message: string }, { echoed: string }> = {
      metadata: {
        name: "echo",
        description: "Echoes a message.",
        inputSchema: z.object({
          message: z.string(),
        }),
      },
      execute(context, input) {
        requestId = context.execution.attributes["mcp.requestId"];

        return {
          value: {
            echoed: input.message,
          },
        };
      },
    };

    class EchoModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(echoTool);
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create().use(EchoModule).build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-test-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const listed = await client.listTools();

      expect(listed.tools).toHaveLength(1);
      expect(listed.tools[0]?.name).toBe("echo");
      expect(listed.tools[0]?.description).toBe("Echoes a message.");
      expect(listed.tools[0]?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          message: {
            type: "string",
          },
        },
      });

      const result = await client.callTool({
        name: "echo",
        arguments: {
          message: "hello",
        },
      });

      expect(getText(result)).toBe('{"echoed":"hello"}');
      expect(requestId).toBeDefined();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("lets the MCP SDK reject invalid tool arguments before execution", async () => {
    let executions = 0;

    const tool: Tool<{ count: number }, number> = {
      metadata: {
        name: "double",
        inputSchema: z.object({
          count: z.number().int().positive(),
        }),
      },
      execute(_context, input) {
        executions += 1;
        return { value: input.count * 2 };
      },
    };

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(tool);
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-validation-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create().use(TestModule).build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-validation-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "double",
        arguments: {
          count: -1,
        },
      });

      expect(result.isError).toBe(true);
      expect(executions).toBe(0);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("supports zero-input tools without an input schema", async () => {
    const tool: Tool<undefined, string> = {
      metadata: {
        name: "ping",
        description: "Returns pong.",
      },
      execute() {
        return { value: "pong" };
      },
    };

    class PingModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(tool);
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-ping-test",
      version: "0.2.0",
      createApplication: () =>
        ForgeApplicationBuilder.create().use(PingModule).build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-ping-client",
      version: "0.2.0",
    });

    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "ping",
        arguments: {},
      });

      expect(getText(result)).toBe("pong");
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
