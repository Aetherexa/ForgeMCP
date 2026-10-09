import {
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  type DiagnosticEvent,
  type DiagnosticListener,
  type ExecutionSpanRecord,
  type ExecutionTelemetryOptions,
} from "@forgemcp/core";

/**
 * Projects existing execution diagnostics into completed spans and measurements.
 * Create one listener per application; attach before startup and execution.
 */
export function createExecutionTelemetryListener(
  options: ExecutionTelemetryOptions,
): DiagnosticListener {
  const selectedNames = [...new Set(options.executionAttributeNames ?? [])];
  const active = new Map<string, DiagnosticEvent>();

  return {
    onEvent(event) {
      if (
        event.name === DiagnosticEventNames.ApplicationStopped ||
        event.name === DiagnosticEventNames.ApplicationStopFailed ||
        event.name === DiagnosticEventNames.ApplicationStartFailed
      ) {
        active.clear();
        return;
      }
      if (event.execution === undefined) return;
      const id = event.execution.id;
      if (event.name === DiagnosticEventNames.ExecutionStarted) {
        if (!active.has(id)) active.set(id, event);
        return;
      }
      if (
        event.name !== DiagnosticEventNames.ExecutionCompleted &&
        event.name !== DiagnosticEventNames.ExecutionFailed
      )
        return;
      const started = active.get(id);
      if (started === undefined) return;
      // Remove before callbacks so throwing/reentrant providers cannot retain state.
      active.delete(id);
      const span = projectSpan(event, started, selectedNames);
      const { name: toolName, status, durationMs } = span;
      const labels = Object.freeze({
        "tool.name": toolName,
        "execution.status": status,
      });
      observe(() => options.sink.writeSpan(span));
      observe(() =>
        options.sink.recordMetric(
          Object.freeze({
            name: "forge.execution.count",
            value: 1,
            unit: "1",
            attributes: labels,
          }),
        ),
      );
      observe(() =>
        options.sink.recordMetric(
          Object.freeze({
            name: "forge.execution.duration",
            value: durationMs,
            unit: "ms",
            attributes: labels,
          }),
        ),
      );
    },
  };
}

function projectSpan(
  event: DiagnosticEvent,
  started: DiagnosticEvent,
  selectedNames: readonly string[],
): ExecutionSpanRecord {
  const attributes = new Map<string, unknown>();
  for (const name of selectedNames) {
    if (Object.hasOwn(event.execution!.attributes, name)) {
      attributes.set(name, event.execution!.attributes[name]);
    }
  }
  for (const [name, value] of Object.entries(event.attributes)) {
    attributes.set(name, value);
  }
  const toolName = String(event.attributes[DiagnosticAttributeNames.ToolName]);
  const measured = event.attributes[DiagnosticAttributeNames.DurationMs];
  const durationMs =
    typeof measured === "number" && Number.isFinite(measured) && measured >= 0
      ? measured
      : Math.max(0, event.timestamp.getTime() - started.timestamp.getTime());
  const status =
    event.name === DiagnosticEventNames.ExecutionFailed ? "error" : "ok";
  const span: ExecutionSpanRecord = Object.freeze({
    executionId: event.execution!.id,
    name: toolName,
    startedAt: new Date(started.timestamp.getTime()),
    endedAt: new Date(event.timestamp.getTime()),
    durationMs,
    status,
    attributes: Object.freeze(Object.fromEntries(attributes)),
  });
  return span;
}

function observe(deliver: () => void): void {
  try {
    deliver();
  } catch {
    // Telemetry is observational; one provider failure does not skip other signals.
  }
}
