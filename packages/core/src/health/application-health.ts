import type { LifecycleState } from "../lifecycle/index.js";
import type { MaybePromise } from "../types/index.js";

export type HealthStatus = "up" | "down";

/** Explicit dependency check; names should be safe for operator-facing reports. */
export interface HealthCheck {
  readonly name: string;
  check(): MaybePromise<HealthStatus>;
}

export interface HealthCheckResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly reason?: "failed" | "timeout" | "invalid-result";
}

/** Snapshot of application health, without raw errors or arbitrary provider data. */
export interface HealthReport {
  readonly kind: "liveness" | "readiness";
  readonly status: HealthStatus;
  readonly state: LifecycleState;
  readonly checks: readonly HealthCheckResult[];
}

export interface ApplicationHealth {
  /** Lifecycle availability only; does not prove process or event-loop health. */
  liveness(): HealthReport;
  readiness(): Promise<HealthReport>;
}

export interface ApplicationHealthOptions {
  readonly checks?: readonly HealthCheck[];
  /** Per-check observation deadline, default 1000 ms. Does not cancel provider I/O. */
  readonly timeoutMs?: number;
}
