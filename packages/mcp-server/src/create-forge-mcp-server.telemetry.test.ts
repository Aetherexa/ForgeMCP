import {
  createExecutionTelemetryListener,
  ForgeApplicationBuilder,
} from "@forgemcp/application";
import {
  LifecycleState,
  createServiceToken,
  type ExecutionMetricRecord,
  type ExecutionSpanRecord,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import * as z from "zod/v4";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

describe("official MCP execution telemetry", () => {
  it.each([false, true])(
    "preserves results, cleanup and concurrency when provider fails: %s",
    async (failProvider) => {
      const spans: ExecutionSpanRecord[] = [];
      const metrics: ExecutionMetricRecord[] = [];
      const ids: string[] = [];
      const cleaned: string[] = [];
      const cleanupAtSpan: boolean[] = [];
      let entered = 0;
      let disposed = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      class TelemetryModule implements Module {
        configure(builder: ModuleBuilder): void {
          builder.tool({
            metadata: {
              name: "telemetry-tool",
              inputSchema: z.object({ fail: z.boolean(), secret: z.string() }),
            },
            async execute(context, input: { fail: boolean; secret: string }) {
              ids.push(context.execution.id);
              const resource = await context.services.require(scopedToken);
              resource.id = context.execution.id;
              entered += 1;
              if (entered === 2) release();
              await barrier;
              if (input.fail) throw new Error("private-error-secret");
              return { value: input.secret };
            },
          });
        }
      }
      const app = ForgeApplicationBuilder.create()
        .provideFactory(disposableToken, () => ({
          [Symbol.dispose]() {
            disposed += 1;
          },
        }))
        .provideScopedFactory(scopedToken, () => {
          const resource = {
            id: "",
            [Symbol.dispose]() {
              cleaned.push(resource.id);
            },
          };
          return resource;
        })
        .observe(
          createExecutionTelemetryListener({
            executionAttributeNames: ["mcp.requestId", "mcp.sessionId"],
            sink: {
              writeSpan(span) {
                spans.push(span);
                cleanupAtSpan.push(cleaned.includes(span.executionId));
                if (failProvider) throw new Error("span provider down");
              },
              recordMetric(metric) {
                metrics.push(metric);
                if (failProvider) throw new Error("metric provider down");
              },
            },
          }),
        )
        .use(TelemetryModule)
        .build();
      const server = await createForgeMcpServer({
        name: "telemetry-server",
        version: "0.3.0",
        createApplication: () => app,
      });
      const client = new Client({ name: "telemetry-client", version: "0.3.0" });
      try {
        const [clientTransport, serverTransport] =
          InMemoryTransport.createLinkedPair();
        serverTransport.sessionId = "telemetry-session";
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const results = await Promise.all(
          [false, true].map((fail) =>
            client.callTool({
              name: "telemetry-tool",
              arguments: { fail, secret: "private-payload-secret" },
              _meta: { privateMetadata: "private-metadata-secret" },
            }),
          ),
        );
        expect(results[0]?.isError).not.toBe(true);
        expect(results[0]?.content).toEqual([
          { type: "text", text: "private-payload-secret" },
        ]);
        expect(results[1]?.isError).toBe(true);
        expect(spans).toHaveLength(2);
        expect(cleaned).toHaveLength(2);
        expect(cleanupAtSpan).toEqual([true, true]);
        expect(new Set(spans.map((span) => span.executionId))).toEqual(
          new Set(ids),
        );
        expect(
          new Set(spans.map((span) => span.attributes["mcp.requestId"])).size,
        ).toBe(2);
        expect(spans.map((span) => span.status).sort()).toEqual([
          "error",
          "ok",
        ]);
        for (const span of spans) {
          expect(span.attributes["mcp.sessionId"]).toBe("telemetry-session");
          expect(span.durationMs).toBeGreaterThanOrEqual(0);
        }
        expect(metrics).toHaveLength(4);
        expect(
          metrics
            .filter((metric) => metric.name === "forge.execution.count")
            .reduce((sum, metric) => sum + metric.value, 0),
        ).toBe(2);
        for (const metric of metrics) {
          expect(Object.keys(metric.attributes).sort()).toEqual([
            "execution.status",
            "tool.name",
          ]);
        }
        const serialized = JSON.stringify({ spans, metrics });
        for (const secret of [
          "private-payload-secret",
          "private-metadata-secret",
          "private-error-secret",
        ]) {
          expect(serialized).not.toContain(secret);
        }
        await server.close();
        await server.close();
        expect(disposed).toBe(1);
        expect(app.state).toBe(LifecycleState.Stopped);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});

const disposableToken = createServiceToken<{ [Symbol.dispose](): void }>(
  "telemetry-resource",
);

const scopedToken = createServiceToken<{
  id: string;
  [Symbol.dispose](): void;
}>("telemetry-scoped-resource");
