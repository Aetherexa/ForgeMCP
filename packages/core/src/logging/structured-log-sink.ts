import type { StructuredLogRecord } from "./structured-log-record.js";

/**
 * Provider-neutral destination for ForgeMCP structured log records.
 *
 * Implementations should keep writes lightweight and hand asynchronous
 * buffering/export to their chosen logging provider.
 */
export interface StructuredLogSink {
  /**
   * Writes one structured log record.
   */
  write(record: StructuredLogRecord): void;
}
