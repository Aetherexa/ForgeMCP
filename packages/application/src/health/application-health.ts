import {
  LifecycleState,
  type ApplicationHealth,
  type ApplicationHealthOptions,
  type HealthCheck,
  type HealthCheckResult,
  type HealthReport,
  type Lifecycle,
} from "@forgemcp/core";

/** Creates an explicit health provider without changing application lifecycle. */
export function createApplicationHealth(
  application: Pick<Lifecycle, "state">,
  options: ApplicationHealthOptions = {},
): ApplicationHealth {
  const timeoutMs = options.timeoutMs ?? 1000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) {
    throw new Error(
      "Health timeoutMs must be an integer between 1 and 2147483647.",
    );
  }
  const checks = captureChecks(options.checks ?? []);
  return {
    liveness() {
      const state = application.state;
      const status =
        state === LifecycleState.Created || state === LifecycleState.Stopped
          ? "down"
          : "up";
      return report("liveness", state, status, []);
    },
    async readiness() {
      if (application.state !== LifecycleState.Started) {
        return report("readiness", application.state, "down", []);
      }
      const results = await Promise.all(
        checks.map((check) => runCheck(check, timeoutMs)),
      );
      // A dependency success must not revive readiness after shutdown begins.
      const state = application.state;
      const status =
        state === LifecycleState.Started &&
        results.every((check) => check.status === "up")
          ? "up"
          : "down";
      return report("readiness", state, status, results);
    },
  };
}

function captureChecks(checks: readonly HealthCheck[]): readonly HealthCheck[] {
  const names = new Set<string>();
  return checks.map((check) => {
    if (check.name.trim().length === 0 || names.has(check.name)) {
      throw new Error("Health check names must be nonempty and unique.");
    }
    names.add(check.name);
    return Object.freeze({ name: check.name, check: check.check.bind(check) });
  });
}

async function runCheck(
  check: HealthCheck,
  timeoutMs: number,
): Promise<HealthCheckResult> {
  let timer!: ReturnType<typeof setTimeout>;
  const deadline = new Promise<HealthCheckResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ name: check.name, status: "down", reason: "timeout" }),
      timeoutMs,
    );
  });
  const result = Promise.resolve()
    .then(() => check.check())
    .then(
      (status): HealthCheckResult =>
        status === "up" || status === "down"
          ? { name: check.name, status }
          : { name: check.name, status: "down", reason: "invalid-result" },
      (): HealthCheckResult => ({
        name: check.name,
        status: "down",
        reason: "failed",
      }),
    );
  try {
    return Object.freeze(await Promise.race([result, deadline]));
  } finally {
    clearTimeout(timer);
  }
}

function report(
  kind: HealthReport["kind"],
  state: LifecycleState,
  status: HealthReport["status"],
  checks: readonly HealthCheckResult[],
): HealthReport {
  return Object.freeze({
    kind,
    state,
    status,
    checks: Object.freeze([...checks]),
  });
}
