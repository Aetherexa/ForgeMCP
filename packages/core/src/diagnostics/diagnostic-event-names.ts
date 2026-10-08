/**
 * Stable machine-readable names for framework diagnostic events.
 */
export const DiagnosticEventNames = Object.freeze({
  ApplicationStarting: "application.starting",
  ApplicationStarted: "application.started",
  ApplicationStartFailed: "application.start.failed",
  ApplicationStopping: "application.stopping",
  ApplicationStopped: "application.stopped",
  ApplicationStopFailed: "application.stop.failed",
  ExecutionStarted: "execution.started",
  ExecutionCompleted: "execution.completed",
  ExecutionFailed: "execution.failed",
} as const);

/**
 * Name of a framework diagnostic event.
 */
export type DiagnosticEventName =
  (typeof DiagnosticEventNames)[keyof typeof DiagnosticEventNames];
