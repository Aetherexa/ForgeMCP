import type { StructuredLogSink } from "./structured-log-sink.js";

/**
 * Provider-neutral options used when projecting diagnostics into structured
 * logs.
 */
export interface StructuredLoggingOptions {
  /**
   * Destination for projected records.
   */
  readonly sink: StructuredLogSink;

  /**
   * Explicit execution-attribute names that may be copied into log records.
   *
   * Arbitrary execution attributes are excluded by default.
   */
  readonly executionAttributeNames?: readonly string[];
}
