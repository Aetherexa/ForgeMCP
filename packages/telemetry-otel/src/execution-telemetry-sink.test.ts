import { createExecutionTelemetryListener } from "@forgemcp/application";
import {
  DiagnosticEventNames as E,
  type ExecutionSpanRecord,
} from "@forgemcp/core";
import { SpanStatusCode, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import {
  AlwaysOnSampler,
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  MeterProvider,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from "@opentelemetry/sdk-metrics";
import { describe, expect, it, vi } from "vitest";
import { createOpenTelemetrySink } from "./execution-telemetry-sink.js";

const parent = "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01";
const record: ExecutionSpanRecord = {
  executionId: "forge-id",
  name: "echo",
  startedAt: new Date(100),
  endedAt: new Date(125),
  durationMs: 25,
  status: "ok",
  attributes: {
    "tool.name": "echo",
    traceparent: parent,
    tracestate: "vendor=value",
    secretObject: { secret: "private" },
    array: ["private"],
    bad: NaN,
    allowed: true,
    number: 1,
    "forge.execution.id": "spoof",
  },
};

function providers() {
  const spans = new InMemorySpanExporter();
  const tracerProvider = new BasicTracerProvider({
    sampler: new AlwaysOnSampler(),
    spanProcessors: [new SimpleSpanProcessor(spans)],
  });
  const metrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({
    exporter: metrics,
    exportIntervalMillis: 60000,
  });
  const meterProvider = new MeterProvider({ readers: [reader] });
  return {
    spans,
    metrics,
    tracerProvider,
    meterProvider,
    tracer: tracerProvider.getTracer("test"),
    meter: meterProvider.getMeter("test"),
    async close() {
      await tracerProvider.shutdown();
      await meterProvider.shutdown();
    },
  };
}

describe("OpenTelemetry sink", () => {
  it.each([false, true])(
    "exports real spans/metrics with explicit parent trust: %s",
    async (acceptRemoteParent) => {
      const p = providers();
      try {
        const sink = createOpenTelemetrySink({
          tracer: p.tracer,
          meter: p.meter,
          acceptRemoteParent,
        });
        sink.writeSpan(record);
        sink.writeSpan({
          ...record,
          executionId: "failed-id",
          status: "error",
          attributes: {},
        });
        sink.recordMetric({
          name: "forge.execution.count",
          value: 1,
          unit: "1",
          attributes: { "tool.name": "echo", "execution.status": "ok" },
        });
        sink.recordMetric({
          name: "forge.execution.duration",
          value: 25,
          unit: "ms",
          attributes: { "tool.name": "echo", "execution.status": "ok" },
        });
        await p.tracerProvider.forceFlush();
        const [span, failed] = p.spans.getFinishedSpans();
        expect(span?.attributes).toEqual({
          "tool.name": "echo",
          allowed: true,
          number: 1,
          "forge.execution.id": "forge-id",
        });
        expect(span?.status.code).toBe(SpanStatusCode.OK);
        expect(failed?.status.code).toBe(SpanStatusCode.ERROR);
        expect(span?.duration).toEqual([0, 25000000]);
        if (acceptRemoteParent) {
          expect(span?.spanContext().traceId).toBe(parent.split("-")[1]);
          expect(span?.parentSpanContext?.spanId).toBe(parent.split("-")[2]);
          expect(span?.spanContext().traceState?.serialize()).toBe(
            "vendor=value",
          );
        } else expect(span?.parentSpanContext).toBeUndefined();
        expect(failed?.parentSpanContext).toBeUndefined();
        await p.meterProvider.forceFlush();
        const measurements =
          p.metrics.getMetrics()[0]?.scopeMetrics[0]?.metrics;
        expect(
          measurements?.map((m) => [m.descriptor.name, m.descriptor.unit]),
        ).toEqual([
          ["forge.execution.count", "1"],
          ["forge.execution.duration", "ms"],
        ]);
        expect(measurements?.[0]?.dataPoints[0]?.value).toBe(1);
        expect(measurements?.[1]?.dataPoints[0]?.value).toMatchObject({
          count: 1,
          sum: 25,
        });
        expect(JSON.stringify(measurements)).not.toContain("forge-id");
      } finally {
        await p.close();
      }
    },
  );
  it.each([
    "invalid",
    "00-00000000000000000000000000000000-0123456789abcdef-01",
    "00-0123456789abcdef0123456789abcdef-0000000000000000-01",
  ])("rejects malformed/zero remote parent: %s", async (traceparent) => {
    const p = providers();
    try {
      createOpenTelemetrySink({
        tracer: p.tracer,
        meter: p.meter,
        acceptRemoteParent: true,
      }).writeSpan({ ...record, attributes: { traceparent, tracestate: 42 } });
      await p.tracerProvider.forceFlush();
      expect(p.spans.getFinishedSpans()).toHaveLength(1);
      expect(p.spans.getFinishedSpans()[0]?.parentSpanContext).toBeUndefined();
      expect(trace.getSpan(ROOT_CONTEXT)).toBeUndefined();
    } finally {
      await p.close();
    }
  });
  it("ends a span even if status delivery throws and listener still delivers metrics", async () => {
    const p = providers();
    try {
      const end = vi.fn();
      const tracer = {
        startSpan: vi.fn(() => ({
          setStatus() {
            throw new Error("private");
          },
          end,
        })),
      } as unknown as typeof p.tracer;
      const sink = createOpenTelemetrySink({ tracer, meter: p.meter });
      const listener = createExecutionTelemetryListener({ sink });
      for (const name of [E.ExecutionStarted, E.ExecutionCompleted])
        listener.onEvent({
          name,
          timestamp: new Date(),
          execution: { id: "id", startedAt: new Date(), attributes: {} },
          attributes: { "tool.name": "echo", "duration.ms": 5 },
        });
      expect(end).toHaveBeenCalledOnce();
      await p.meterProvider.forceFlush();
      expect(p.metrics.getMetrics()[0]?.scopeMetrics[0]?.metrics).toHaveLength(
        2,
      );
    } finally {
      await p.close();
    }
  });
});
