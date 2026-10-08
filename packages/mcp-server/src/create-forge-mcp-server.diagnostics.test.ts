import { ForgeApplicationBuilder } from "@forgemcp/application";
import {
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  type DiagnosticEvent,
  type Module,
  type ModuleBuilder,
  type Tool,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  type CallToolResult,
  InMemoryTransport,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import * as z from "zod/v4";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("createForgeMcpServer diagnostics", () => {
  it("preserves Forge execution correlation and MCP transport identifiers", async () => {
    const events: DiagnosticEvent[] = [];

    const tool: Tool<{ message: string }, { echoed: string }> = {
      metadata: {
        name: "diagnostic-echo",
        inputSchema: z.object({
          message: z.string(),
        }),
      },
      execute(_context, input) {
        return {
          value: {
            echoed: input.message,
          },
        };
      },
    };

    class DiagnosticModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(tool);
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-diagnostics-test",
      version: "0.3.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .observe({
            onEvent(event) {
              if (event.execution !== undefined) {
                events.push(event);
              }
            },
          })
          .use(DiagnosticModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    serverTransport.sessionId = "session-diagnostics";

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-diagnostics-client",
      version: "0.3.0",
    });

    await client.connect(clientTransport);

    try {
      const firstSecret = "raw-input-secret-one";
      const secondSecret = "raw-input-secret-two";

      const first = await client.callTool({
        name: "diagnostic-echo",
        arguments: {
          message: firstSecret,
        },
      });
      const second = await client.callTool({
        name: "diagnostic-echo",
        arguments: {
          message: secondSecret,
        },
      });

      expect(getText(first)).toBe(`{"echoed":"${firstSecret}"}`);
      expect(getText(second)).toBe(`{"echoed":"${secondSecret}"}`);

      expect(events.map((event) => event.name)).toEqual([
        DiagnosticEventNames.ExecutionStarted,
        DiagnosticEventNames.ExecutionCompleted,
        DiagnosticEventNames.ExecutionStarted,
        DiagnosticEventNames.ExecutionCompleted,
      ]);

      const [firstStarted, firstCompleted, secondStarted, secondCompleted] =
        events;

      expect(firstStarted?.execution?.id).toBeTruthy();
      expect(firstCompleted?.execution?.id).toBe(firstStarted?.execution?.id);
      expect(secondStarted?.execution?.id).toBeTruthy();
      expect(secondCompleted?.execution?.id).toBe(secondStarted?.execution?.id);
      expect(secondStarted?.execution?.id).not.toBe(
        firstStarted?.execution?.id,
      );

      for (const event of events) {
        expect(event.execution?.attributes["mcp.requestId"]).toBeDefined();
        expect(event.execution?.attributes["mcp.sessionId"]).toBe(
          "session-diagnostics",
        );
        expect(event.attributes[DiagnosticAttributeNames.ToolName]).toBe(
          "diagnostic-echo",
        );
      }

      expect(
        firstCompleted?.attributes[DiagnosticAttributeNames.DurationMs],
      ).toEqual(expect.any(Number));
      expect(
        secondCompleted?.attributes[DiagnosticAttributeNames.DurationMs],
      ).toEqual(expect.any(Number));

      const serializedDiagnostics = JSON.stringify(events);

      expect(serializedDiagnostics).not.toContain(firstSecret);
      expect(serializedDiagnostics).not.toContain(secondSecret);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps overlapping MCP calls independently correlated", async () => {
    const events: DiagnosticEvent[] = [];
    let enteredExecutions = 0;
    let releaseExecutions: (() => void) | undefined;

    const bothExecutionsEntered = new Promise<void>((resolve) => {
      releaseExecutions = resolve;
    });

    class ConcurrentModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "diagnostic-concurrent" },
          async execute() {
            enteredExecutions += 1;

            if (enteredExecutions === 2) {
              releaseExecutions?.();
            }

            await bothExecutionsEntered;
            return { value: "ok" };
          },
        });
      }
    }

    const server = await createForgeMcpServer({
      name: "forgemcp-diagnostics-concurrency-test",
      version: "0.3.0",
      createApplication: () =>
        ForgeApplicationBuilder.create()
          .observe({
            onEvent(event) {
              if (event.execution !== undefined) {
                events.push(event);
              }
            },
          })
          .use(ConcurrentModule)
          .build(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({
      name: "forgemcp-diagnostics-concurrency-client",
      version: "0.3.0",
    });

    await client.connect(clientTransport);

    try {
      await Promise.all([
        client.callTool({
          name: "diagnostic-concurrent",
          arguments: {},
        }),
        client.callTool({
          name: "diagnostic-concurrent",
          arguments: {},
        }),
      ]);

      const started = events.filter(
        (event) => event.name === DiagnosticEventNames.ExecutionStarted,
      );
      const completed = events.filter(
        (event) => event.name === DiagnosticEventNames.ExecutionCompleted,
      );

      expect(enteredExecutions).toBe(2);
      expect(started).toHaveLength(2);
      expect(completed).toHaveLength(2);

      const startedIds = started.map((event) => event.execution?.id);
      const completedIds = completed.map((event) => event.execution?.id);

      expect(new Set(startedIds).size).toBe(2);
      expect(new Set(completedIds)).toEqual(new Set(startedIds));

      for (const event of events) {
        expect(event.execution?.attributes["mcp.requestId"]).toBeDefined();
      }
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
