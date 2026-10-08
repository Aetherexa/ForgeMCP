import type { ExecutionMetadata } from "../context/index.js";
import type { Dictionary } from "../types/index.js";
import type { DiagnosticEventName } from "./diagnostic-event-names.js";

/**
 * Immutable runtime fact emitted by ForgeMCP.
 *
 * Framework events intentionally exclude raw tool input and result values.
 */
export interface DiagnosticEvent {
  /**
   * Stable machine-readable event name.
   */
  readonly name: DiagnosticEventName;

  /**
   * UTC timestamp when the event was emitted.
   */
  readonly timestamp: Date;

  /**
   * Framework-controlled event attributes.
   */
  readonly attributes: Readonly<Dictionary<unknown>>;

  /**
   * Execution metadata when the event belongs to one tool execution.
   */
  readonly execution?: ExecutionMetadata;
}
