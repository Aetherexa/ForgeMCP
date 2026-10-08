/**
 * Stable severity levels used by ForgeMCP structured log records.
 */
export const StructuredLogLevels = Object.freeze({
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error",
} as const);

/**
 * Severity of one structured log record.
 */
export type StructuredLogLevel =
  (typeof StructuredLogLevels)[keyof typeof StructuredLogLevels];
