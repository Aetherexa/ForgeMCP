import {
  DiagnosticEventNames,
  StructuredLogLevels,
  type DiagnosticEvent,
  type DiagnosticEventName,
  type DiagnosticListener,
  type StructuredLogLevel,
  type StructuredLogRecord,
  type StructuredLoggingOptions,
} from "@forgemcp/core";

interface EventPolicy {
  readonly level: StructuredLogLevel;
  readonly message: string;
}

const EventPolicies: Readonly<Record<DiagnosticEventName, EventPolicy>> =
  Object.freeze({
    [DiagnosticEventNames.ApplicationStarting]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Application starting.",
    }),
    [DiagnosticEventNames.ApplicationStarted]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Application started.",
    }),
    [DiagnosticEventNames.ApplicationStartFailed]: Object.freeze({
      level: StructuredLogLevels.Error,
      message: "Application start failed.",
    }),
    [DiagnosticEventNames.ApplicationStopping]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Application stopping.",
    }),
    [DiagnosticEventNames.ApplicationStopped]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Application stopped.",
    }),
    [DiagnosticEventNames.ApplicationStopFailed]: Object.freeze({
      level: StructuredLogLevels.Error,
      message: "Application stop failed.",
    }),
    [DiagnosticEventNames.ExecutionStarted]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Execution started.",
    }),
    [DiagnosticEventNames.ExecutionCompleted]: Object.freeze({
      level: StructuredLogLevels.Info,
      message: "Execution completed.",
    }),
    [DiagnosticEventNames.ExecutionFailed]: Object.freeze({
      level: StructuredLogLevels.Error,
      message: "Execution failed.",
    }),
  });

/**
 * Creates a diagnostic listener that projects ForgeMCP diagnostic events into
 * provider-neutral structured log records.
 */
export function createStructuredLogListener(
  options: StructuredLoggingOptions,
): DiagnosticListener {
  const executionAttributeNames = Object.freeze([
    ...new Set(options.executionAttributeNames ?? []),
  ]);

  return {
    onEvent(event) {
      options.sink.write(toStructuredLogRecord(event, executionAttributeNames));
    },
  };
}

function toStructuredLogRecord(
  event: DiagnosticEvent,
  executionAttributeNames: readonly string[],
): StructuredLogRecord {
  const policy = EventPolicies[event.name];
  const attributes = projectAttributes(event, executionAttributeNames);

  return Object.freeze({
    timestamp: new Date(event.timestamp.getTime()),
    level: policy.level,
    event: event.name,
    message: policy.message,
    ...(event.execution === undefined
      ? {}
      : { executionId: event.execution.id }),
    attributes,
  });
}

function projectAttributes(
  event: DiagnosticEvent,
  executionAttributeNames: readonly string[],
): Readonly<Record<string, unknown>> {
  const projected = new Map<string, unknown>();

  if (event.execution !== undefined) {
    for (const name of executionAttributeNames) {
      if (Object.hasOwn(event.execution.attributes, name)) {
        projected.set(name, event.execution.attributes[name]);
      }
    }
  }

  for (const [name, value] of Object.entries(event.attributes)) {
    projected.set(name, value);
  }

  return Object.freeze(Object.fromEntries(projected));
}
