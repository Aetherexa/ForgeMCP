import {
  createExecutionTelemetryListener,
  createRuntimeDiagnostics,
  ForgeApplicationBuilder,
} from "@forgemcp/application";
import {
  createServiceToken,
  LifecycleState,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { createForgeMcpServer } from "@forgemcp/mcp-server";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import {
  AlwaysOnSampler,
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { expect, it } from "vitest";
import * as z from "zod/v4";
import { createOpenTelemetrySink } from "./execution-telemetry-sink.js";

it.each([false, true])(
  "correlates concurrent official MCP calls with opt-in context: %s",
  async (captureTraceContext) => {
    const exporter = new InMemorySpanExporter();
    const tracing = new BasicTracerProvider({
      sampler: new AlwaysOnSampler(),
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const metrics = new MeterProvider();
    const diagnostics = createRuntimeDiagnostics();
    const ids: string[] = [];
    const cleaned: string[] = [];
    const scoped = createServiceToken<{ id: string; [Symbol.dispose](): void }>(
      "scoped",
    );
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    class Tools implements Module {
      configure(builder: ModuleBuilder) {
        builder.tool({
          metadata: {
            name: "echo",
            inputSchema: z.object({ fail: z.boolean() }),
          },
          async execute(context, input: { fail: boolean }) {
            const resource = await context.services.require(scoped);
            resource.id = context.execution.id;
            ids.push(context.execution.id);
            if (ids.length === 2) release();
            await barrier;
            if (input.fail) throw new Error("private-error");
            return { value: "ok" };
          },
        });
      }
    }
    const app = ForgeApplicationBuilder.create()
      .provideScopedFactory(scoped, () => {
        const resource = {
          id: "",
          [Symbol.dispose]() {
            cleaned.push(resource.id);
          },
        };
        return resource;
      })
      .observe(diagnostics.listener)
      .observe(
        createExecutionTelemetryListener({
          executionAttributeNames: [
            "traceparent",
            "tracestate",
            "mcp.requestId",
            "mcp.sessionId",
          ],
          sink: createOpenTelemetrySink({
            tracer: tracing.getTracer("mcp"),
            meter: metrics.getMeter("mcp"),
            acceptRemoteParent: true,
          }),
        }),
      )
      .use(Tools)
      .build();
    const server = await createForgeMcpServer({
      name: "test",
      version: "0.3.0",
      captureTraceContext,
      createApplication: () => app,
    });
    const client = new Client({ name: "test", version: "0.3.0" });
    try {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      st.sessionId = "session";
      await server.connect(st);
      await client.connect(ct);
      const parents = [
        "0123456789abcdef0123456789abcdef",
        "abcdef0123456789abcdef0123456789",
      ];
      const results = await Promise.all(
        parents.map((traceId, i) =>
          client.callTool({
            name: "echo",
            arguments: { fail: i === 1 },
            _meta: {
              traceparent: `00-${traceId}-0123456789abcdef-01`,
              tracestate: "vendor=value",
              secret: "private-meta",
            },
          }),
        ),
      );
      expect(results[0]?.isError).not.toBe(true);
      expect(results[1]?.isError).toBe(true);
      await tracing.forceFlush();
      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(2);
      expect(
        new Set(spans.map((s) => s.attributes["forge.execution.id"])),
      ).toEqual(new Set(ids));
      expect(
        new Set(spans.map((s) => s.attributes["mcp.requestId"])).size,
      ).toBe(2);
      expect(new Set(cleaned)).toEqual(new Set(ids));
      for (const span of spans)
        expect(span.attributes["mcp.sessionId"]).toBe("session");
      if (captureTraceContext)
        expect(new Set(spans.map((s) => s.spanContext().traceId))).toEqual(
          new Set(parents),
        );
      else
        for (const span of spans)
          expect(span.parentSpanContext).toBeUndefined();
      expect(JSON.stringify(spans.map((s) => s.attributes))).not.toContain(
        "private",
      );
      expect(diagnostics.snapshot()).toMatchObject({
        activeExecutions: 0,
        completedExecutions: 1,
        failedExecutions: 1,
      });
      await server.close();
      await server.close();
      expect(app.state).toBe(LifecycleState.Stopped);
    } finally {
      await client.close();
      await server.close();
      await tracing.shutdown();
      await metrics.shutdown();
    }
  },
);
