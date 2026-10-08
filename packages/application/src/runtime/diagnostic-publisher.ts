import type { DiagnosticEvent, DiagnosticListener } from "@forgemcp/core";

/**
 * Delivers runtime diagnostics to application-local listeners.
 */
export class DiagnosticPublisher {
  private readonly listeners: readonly DiagnosticListener[];

  public constructor(listeners: readonly DiagnosticListener[] = []) {
    this.listeners = [...listeners];
  }

  /**
   * Notifies every listener in registration order.
   *
   * Diagnostics are observational, so listener failures never change the
   * application operation being observed.
   */
  public publish(event: DiagnosticEvent): void {
    for (const listener of this.listeners) {
      try {
        listener.onEvent(event);
      } catch {
        // Listener failures are intentionally isolated from runtime behavior.
      }
    }
  }
}
