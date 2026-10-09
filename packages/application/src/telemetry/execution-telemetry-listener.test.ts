import {
  DiagnosticEventNames as Events,
  type DiagnosticEvent,
  type DiagnosticEventName,
  type ExecutionMetricRecord,
  type ExecutionSpanRecord,
} from "@forgemcp/core";
import { describe, expect, it, vi } from "vitest";

import { createExecutionTelemetryListener } from "./execution-telemetry-listener.js";

function event(
  name: DiagnosticEventName,
  id = "forge-one",
  duration: unknown = 12,
): DiagnosticEvent {
  return {
    name,
    timestamp: new Date(name === Events.ExecutionStarted ? 100 : 120),
    execution: {
      id,
      startedAt: new Date(100),
      attributes: { "mcp.requestId": 7, "mcp.meta": { secret: "private" } },
    },
    attributes: { "tool.name": "echo", "duration.ms": duration },
  };
}

function harness(selected?: readonly string[]) {
  const spans: ExecutionSpanRecord[] = [];
  const metrics: ExecutionMetricRecord[] = [];
  const listener = createExecutionTelemetryListener({
    sink: {
      writeSpan: (span) => {
        spans.push(span);
      },
      recordMetric: (metric) => {
        metrics.push(metric);
      },
    },
    ...(selected === undefined ? {} : { executionAttributeNames: selected }),
  });
  return { listener, spans, metrics };
}

describe("execution telemetry projection", () => {
  it.each([false, true])(
    "keeps overlapping calls private and correlated (selection: %s)",
    (selected) => {
      const { listener, spans, metrics } = harness(
        selected ? ["mcp.requestId", "missing", "mcp.requestId"] : undefined,
      );
      listener.onEvent(event(Events.ExecutionStarted));
      listener.onEvent(event(Events.ExecutionStarted, "forge-two"));
      listener.onEvent(event(Events.ExecutionCompleted, "forge-two"));
      listener.onEvent(event(Events.ExecutionFailed));
      expect(spans.map((span) => [span.executionId, span.status])).toEqual([
        ["forge-two", "ok"],
        ["forge-one", "error"],
      ]);
      for (const span of spans) {
        expect(span.durationMs).toBe(12);
        expect(span.startedAt).toEqual(new Date(100));
        expect(span.endedAt).toEqual(new Date(120));
        expect(Object.isFrozen(span)).toBe(true);
        expect(Object.isFrozen(span.attributes)).toBe(true);
        expect(span.attributes).not.toHaveProperty("mcp.meta");
        expect(span.attributes).not.toHaveProperty("missing");
        expect(span.attributes["mcp.requestId"]).toBe(selected ? 7 : undefined);
      }
      expect(metrics).toHaveLength(4);
      expect(
        metrics.map((metric) => [metric.name, metric.value, metric.unit]),
      ).toEqual([
        ["forge.execution.count", 1, "1"],
        ["forge.execution.duration", 12, "ms"],
        ["forge.execution.count", 1, "1"],
        ["forge.execution.duration", 12, "ms"],
      ]);
      for (const metric of metrics) {
        expect(Object.keys(metric.attributes).sort()).toEqual([
          "execution.status",
          "tool.name",
        ]);
        expect(Object.isFrozen(metric)).toBe(true);
        expect(Object.isFrozen(metric.attributes)).toBe(true);
      }
    },
  );

  it("ignores unmatched, duplicate and unrelated events", () => {
    const { listener, spans } = harness();
    listener.onEvent({
      name: Events.ApplicationStarted,
      timestamp: new Date(),
      attributes: {},
    });
    listener.onEvent(event(Events.ApplicationStarted));
    listener.onEvent(event(Events.ExecutionCompleted));
    const started = event(Events.ExecutionStarted);
    listener.onEvent(started);
    listener.onEvent({ ...started, timestamp: new Date(110) });
    listener.onEvent(event(Events.ExecutionCompleted));
    listener.onEvent(event(Events.ExecutionFailed));
    expect(spans).toHaveLength(1);
    expect(spans[0]?.startedAt).toEqual(new Date(100));
  });

  it.each([undefined, NaN, -1, "invalid"])(
    "falls back to timestamps for invalid duration %s",
    (duration) => {
      const { listener, spans } = harness();
      listener.onEvent(event(Events.ExecutionStarted));
      const terminal = event(Events.ExecutionCompleted);
      listener.onEvent({
        ...terminal,
        attributes: { "tool.name": "echo", "duration.ms": duration },
      });
      expect(spans[0]?.durationMs).toBe(20);
    },
  );

  it.each([
    Events.ApplicationStopped,
    Events.ApplicationStopFailed,
    Events.ApplicationStartFailed,
  ])("clears incomplete executions on %s", (name) => {
    const { listener, spans } = harness();
    listener.onEvent(event(Events.ExecutionStarted));
    listener.onEvent({ name, timestamp: new Date(), attributes: {} });
    listener.onEvent(event(Events.ExecutionCompleted));
    expect(spans).toHaveLength(0);
    listener.onEvent(event(Events.ExecutionStarted));
    listener.onEvent(event(Events.ExecutionCompleted));
    expect(spans).toHaveLength(1);
  });

  it("keeps application listeners independent and snapshots selected names", () => {
    const selected = ["mcp.requestId"];
    const first = harness(selected);
    const second = harness();
    selected.push("mcp.meta");
    first.listener.onEvent(event(Events.ExecutionStarted));
    second.listener.onEvent(event(Events.ExecutionStarted));
    first.listener.onEvent(event(Events.ExecutionCompleted));
    expect(first.spans).toHaveLength(1);
    expect(second.spans).toHaveLength(0);
    expect(first.spans[0]?.attributes).not.toHaveProperty("mcp.meta");
    second.listener.onEvent(event(Events.ExecutionFailed));
    expect(second.spans[0]?.status).toBe("error");
  });

  it("isolates each provider callback and removes state before delivery", () => {
    const writeSpan = vi.fn(() => {
      throw new Error("provider down");
    });
    const recordMetric = vi.fn(() => {
      throw new Error("provider down");
    });
    const listener = createExecutionTelemetryListener({
      sink: { writeSpan, recordMetric },
    });
    listener.onEvent(event(Events.ExecutionStarted));
    expect(() =>
      listener.onEvent(event(Events.ExecutionCompleted)),
    ).not.toThrow();
    listener.onEvent(event(Events.ExecutionCompleted));
    expect(writeSpan).toHaveBeenCalledTimes(1);
    expect(recordMetric).toHaveBeenCalledTimes(2);
  });
});
