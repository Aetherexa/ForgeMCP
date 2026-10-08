/**
 * Stable attribute names emitted by the ForgeMCP runtime.
 */
export const DiagnosticAttributeNames = Object.freeze({
  ToolName: "tool.name",
  DurationMs: "duration.ms",
} as const);

/**
 * Name of a framework-owned diagnostic attribute.
 */
export type DiagnosticAttributeName =
  (typeof DiagnosticAttributeNames)[keyof typeof DiagnosticAttributeNames];
