import type { Dictionary } from "../types/index.js";

/** Completed Forge execution; a provider may translate this into its own span. */
export interface ExecutionSpanRecord {
  readonly executionId: string;
  readonly name: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly durationMs: number;
  readonly status: "ok" | "error";
  readonly attributes: Readonly<Dictionary<unknown>>;
}

/** Low-cardinality execution measurements; execution/request IDs are not labels. */
export interface ExecutionMetricRecord {
  readonly name: "forge.execution.count" | "forge.execution.duration";
  readonly value: number;
  readonly unit: "1" | "ms";
  readonly attributes: Readonly<{
    "tool.name": string;
    "execution.status": "ok" | "error";
  }>;
}

/** Synchronous handoff; exporter buffering and lifecycle belong to the caller. */
export interface ExecutionTelemetrySink {
  writeSpan(span: ExecutionSpanRecord): void;
  recordMetric(metric: ExecutionMetricRecord): void;
}

export interface ExecutionTelemetryOptions {
  readonly sink: ExecutionTelemetrySink;
  /** Explicit supporting span attributes; never used as metric labels. */
  readonly executionAttributeNames?: readonly string[];
}
