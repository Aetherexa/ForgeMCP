import type { DiagnosticListener } from "./diagnostic-listener.js";
import type { LifecycleState } from "../lifecycle/lifecycle-state.js";

/** Aggregate observations since this provider was created; no payloads or IDs. */
export interface RuntimeDiagnosticSnapshot {
  readonly state: LifecycleState;
  readonly activeExecutions: number;
  readonly completedExecutions: number;
  readonly failedExecutions: number;
}

/** Attach the listener before startup; read fresh immutable snapshots on demand. */
export interface RuntimeDiagnostics {
  readonly listener: DiagnosticListener;
  snapshot(): RuntimeDiagnosticSnapshot;
}
