import type { DiagnosticEventName } from "../diagnostics/index.js";
import type { Dictionary } from "../types/index.js";
import type { StructuredLogLevel } from "./structured-log-level.js";

/**
 * Provider-neutral structured representation of one ForgeMCP runtime log.
 */
export interface StructuredLogRecord {
  /**
   * Timestamp of the source diagnostic event.
   */
  readonly timestamp: Date;

  /**
   * Stable structured logging severity.
   */
  readonly level: StructuredLogLevel;

  /**
   * Source diagnostic event name.
   */
  readonly event: DiagnosticEventName;

  /**
   * Deterministic human-readable summary.
   */
  readonly message: string;

  /**
   * Canonical Forge execution correlation ID when this record belongs to an
   * execution.
   */
  readonly executionId?: string;

  /**
   * Projected framework/application attributes selected for logging.
   */
  readonly attributes: Readonly<Dictionary<unknown>>;
}
