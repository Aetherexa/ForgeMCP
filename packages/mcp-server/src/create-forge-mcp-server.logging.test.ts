import {
  createStderrJsonLogSink,
  createStructuredLogListener,
  ForgeApplicationBuilder,
} from "@forgemcp/application";
import {
  DiagnosticEventNames,
  LifecycleState,
  type ExecutionMetadata,
  type Module,
  type ModuleBuilder,
  type StructuredLogRecord,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("official MCP structured logging", () => {
  it.each([false, true])(
    "validates concurrent calls, privacy and lifecycle (explicit identifiers: %s)",
    async (includeIdentifiers) => {
      const executions: ExecutionMetadata[] = [];
      const records: StructuredLogRecord[] = [];
      const lines: string[] = [];
      let release!: () => void;
      const bothEntered = new Promise<void>((resolve) => {
        release = resolve;
      });
      class LoggingModule implements Module {
        configure(builder: ModuleBuilder): void {
          builder.tool({
            metadata: {
              name: "logging-echo",
              inputSchema: z.object({ message: z.string() }),
            },
            async execute(context, input: { message: string }) {
              executions.push(context.execution);
              if (executions.length === 2) release();
              await bothEntered;
              return { value: input.message };
            },
          });
        }
      }

      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation((chunk) => {
          lines.push(String(chunk));
          return true;
        });
      const stdout = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const jsonSink = createStderrJsonLogSink();
      const application = ForgeApplicationBuilder.create()
        .observe(
          createStructuredLogListener({
            sink: {
              write(record) {
                records.push(record);
                jsonSink.write(record);
              },
            },
            ...(includeIdentifiers
              ? { executionAttributeNames: ["mcp.requestId", "mcp.sessionId"] }
              : {}),
          }),
        )
        .use(LoggingModule)
        .build();
      const client = new Client({ name: "logging-client", version: "0.3.0" });
      let server: Awaited<ReturnType<typeof createForgeMcpServer>> | undefined;
      try {
        server = await createForgeMcpServer({
          name: "logging-server",
          version: "0.3.0",
          createApplication: () => application,
        });
        const [clientTransport, serverTransport] =
          InMemoryTransport.createLinkedPair();
        serverTransport.sessionId = "logging-session";
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        expect(application.state).toBe(LifecycleState.Started);
        const secrets = ["payload-secret-one", "payload-secret-two"];
        const results = await Promise.all(
          secrets.map((message) =>
            client.callTool({
              name: "logging-echo",
              arguments: { message },
              _meta: { privateMetadata: "metadata-secret" },
            }),
          ),
        );
        results.forEach((result, index) => {
          expect(result.isError).not.toBe(true);
          expect(result.content).toEqual([
            { type: "text", text: secrets[index] },
          ]);
        });

        expect(executions).toHaveLength(2);
        expect(new Set(executions.map((execution) => execution.id)).size).toBe(
          2,
        );
        expect(
          new Set(
            executions.map(
              (execution) => execution.attributes["mcp.requestId"],
            ),
          ).size,
        ).toBe(2);
        for (const execution of executions) {
          expect(execution.attributes["mcp.meta"]).toEqual({
            privateMetadata: "metadata-secret",
          });
          const correlated = records.filter(
            (record) => record.executionId === execution.id,
          );
          expect(correlated.map((record) => record.event)).toEqual([
            DiagnosticEventNames.ExecutionStarted,
            DiagnosticEventNames.ExecutionCompleted,
          ]);
          for (const record of correlated) {
            expect(record.executionId).not.toBe(
              String(execution.attributes["mcp.requestId"]),
            );
            if (includeIdentifiers) {
              expect(record.attributes["mcp.requestId"]).toBe(
                execution.attributes["mcp.requestId"],
              );
              expect(record.attributes["mcp.sessionId"]).toBe(
                "logging-session",
              );
            } else {
              expect(record.attributes).not.toHaveProperty("mcp.requestId");
              expect(record.attributes).not.toHaveProperty("mcp.sessionId");
            }
            expect(record.attributes).not.toHaveProperty("mcp.meta");
          }
        }
        await server.close();
        await server.close();
        expect(application.state).toBe(LifecycleState.Stopped);
        const lifecycle = records.filter(
          (record) => record.executionId === undefined,
        );
        expect(lifecycle.map((record) => record.event)).toEqual([
          DiagnosticEventNames.ApplicationStarting,
          DiagnosticEventNames.ApplicationStarted,
          DiagnosticEventNames.ApplicationStopping,
          DiagnosticEventNames.ApplicationStopped,
        ]);
        expect(lines).toHaveLength(records.length);
        lines.forEach((line, index) => {
          expect(line.endsWith("\n")).toBe(true);
          expect(line.split("\n")).toHaveLength(2);
          expect(JSON.parse(line)).toEqual({
            ...records[index],
            timestamp: records[index]!.timestamp.toISOString(),
          });
        });
        for (const secret of [...secrets, "metadata-secret"]) {
          expect(lines.join("")).not.toContain(secret);
        }
        expect(stdout).not.toHaveBeenCalled();
      } finally {
        try {
          await client.close();
          await server?.close();
        } finally {
          stderr.mockRestore();
          stdout.mockRestore();
        }
      }
    },
  );
});
