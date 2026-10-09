import type { ExecutionTelemetrySink } from "@forgemcp/core";
import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  defaultTextMapGetter,
  type Attributes,
  type Meter,
  type Tracer,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

export interface OpenTelemetrySinkOptions {
  readonly tracer: Tracer;
  readonly meter: Meter;
  /** Explicit trust decision. Disabled by default; accepts selected traceparent/tracestate. */
  readonly acceptRemoteParent?: boolean;
}

/** Caller owns providers, exporters, flushing and shutdown. No global registration. */
export function createOpenTelemetrySink(
  options: OpenTelemetrySinkOptions,
): ExecutionTelemetrySink {
  const counter = options.meter.createCounter("forge.execution.count", {
    unit: "1",
  });
  const histogram = options.meter.createHistogram("forge.execution.duration", {
    unit: "ms",
  });
  const propagator = new W3CTraceContextPropagator();
  return {
    writeSpan(record) {
      const { traceparent, tracestate, ...selected } = record.attributes;
      const carrier = {
        ...(typeof traceparent === "string" ? { traceparent } : {}),
        ...(typeof tracestate === "string" ? { tracestate } : {}),
      };
      const parent =
        options.acceptRemoteParent === true
          ? propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
          : ROOT_CONTEXT;
      const attributes: Attributes = {};
      for (const [key, value] of Object.entries(selected)) {
        if (
          typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          attributes[key] = value;
      }
      attributes["forge.execution.id"] = record.executionId;
      const span = options.tracer.startSpan(
        record.name,
        {
          kind: SpanKind.SERVER,
          startTime: record.startedAt,
          attributes,
        },
        parent,
      );
      try {
        span.setStatus({
          code:
            record.status === "error"
              ? SpanStatusCode.ERROR
              : SpanStatusCode.OK,
        });
      } finally {
        span.end(record.endedAt);
      }
    },
    recordMetric(record) {
      if (record.name === "forge.execution.count")
        counter.add(record.value, record.attributes, ROOT_CONTEXT);
      else histogram.record(record.value, record.attributes, ROOT_CONTEXT);
    },
  };
}
