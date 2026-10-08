import type { DiagnosticEvent } from "./diagnostic-event.js";

/**
 * Observes ForgeMCP runtime diagnostics.
 *
 * Implementations should keep this callback lightweight and hand off
 * asynchronous exporting or buffering to their chosen operations provider.
 */
export interface DiagnosticListener {
  /**
   * Receives one runtime diagnostic event.
   */
  onEvent(event: DiagnosticEvent): void;
}
