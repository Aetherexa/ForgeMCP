import { LifecycleState, type HealthCheck } from "@forgemcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApplicationHealth } from "./application-health.js";

const started = () => ({ state: LifecycleState.Started });

describe("application health", () => {
  afterEach(() => vi.useRealTimers());

  it.each(Object.values(LifecycleState))(
    "derives availability from %s without probing inactive applications",
    async (state) => {
      const check = vi.fn(() => "up" as const);
      const provider = createApplicationHealth(
        { state },
        { checks: [{ name: "dependency", check }] },
      );
      expect(provider.liveness()).toEqual({
        kind: "liveness",
        state,
        status:
          state === LifecycleState.Created || state === LifecycleState.Stopped
            ? "down"
            : "up",
        checks: [],
      });
      expect(check).not.toHaveBeenCalled();
      const readiness = await provider.readiness();
      expect(readiness.status).toBe(
        state === LifecycleState.Started ? "up" : "down",
      );
      expect(check).toHaveBeenCalledTimes(
        state === LifecycleState.Started ? 1 : 0,
      );
    },
  );

  it("is ready with no dependencies and freezes report snapshots", async () => {
    const provider = createApplicationHealth(started());
    const ready = await provider.readiness();
    expect(ready.status).toBe("up");
    expect(ready.checks).toEqual([]);
    expect(Object.isFrozen(ready)).toBe(true);
    expect(Object.isFrozen(ready.checks)).toBe(true);
    expect(Object.isFrozen(provider.liveness())).toBe(true);
  });

  it("isolates failed/invalid checks, omits raw errors and preserves configured order", async () => {
    const checks: HealthCheck[] = [
      { name: "up", check: async () => "up" as const },
      { name: "down", check: () => "down" },
      {
        name: "sync-error",
        check: () => {
          throw new Error("private-sync-secret");
        },
      },
      {
        name: "async-error",
        check: async () => {
          throw new Error("private-async-secret");
        },
      },
      {
        name: "invalid",
        check: () => ({ secret: "private-result-secret" }) as unknown as "up",
      },
    ];
    const provider = createApplicationHealth(started(), { checks });
    const result = await provider.readiness();
    expect(result.status).toBe("down");
    expect(result.checks).toEqual([
      { name: "up", status: "up" },
      { name: "down", status: "down" },
      { name: "sync-error", status: "down", reason: "failed" },
      { name: "async-error", status: "down", reason: "failed" },
      { name: "invalid", status: "down", reason: "invalid-result" },
    ]);
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(result.checks.every(Object.isFrozen)).toBe(true);
    expect(provider.liveness().status).toBe("up");
  });

  it("runs checks concurrently but reports them in registration order", async () => {
    let finishFirst!: (value: "up") => void;
    const first = new Promise<"up">((resolve) => {
      finishFirst = resolve;
    });
    const second = vi.fn(() => {
      finishFirst("up");
      return "up" as const;
    });
    const provider = createApplicationHealth(started(), {
      checks: [
        { name: "first", check: () => first },
        { name: "second", check: second },
      ],
    });
    expect(
      (await provider.readiness()).checks.map((check) => check.name),
    ).toEqual(["first", "second"]);
    expect(second).toHaveBeenCalledOnce();
  });

  it("bounds hung checks with the default deadline and absorbs late rejection", async () => {
    vi.useFakeTimers();
    let rejectLate!: (reason: Error) => void;
    const hung = new Promise<"up">((_, reject) => {
      rejectLate = reject;
    });
    const provider = createApplicationHealth(started(), {
      checks: [{ name: "hung", check: () => hung }],
    });
    const pending = provider.readiness();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(result.checks).toEqual([
      { name: "hung", status: "down", reason: "timeout" },
    ]);
    expect(result.status).toBe("down");
    expect(vi.getTimerCount()).toBe(0);
    rejectLate(new Error("private-late-secret"));
    await vi.advanceTimersByTimeAsync(0);
  });

  it("clears probe timers on normal completion and uses the configured deadline", async () => {
    vi.useFakeTimers();
    const fast = createApplicationHealth(started(), {
      checks: [{ name: "fast", check: () => "up" }],
      timeoutMs: 25,
    });
    await fast.readiness();
    expect(vi.getTimerCount()).toBe(0);
    const slow = createApplicationHealth(started(), {
      checks: [{ name: "slow", check: () => new Promise(() => {}) }],
      timeoutMs: 25,
    });
    const pending = slow.readiness();
    await vi.advanceTimersByTimeAsync(25);
    expect((await pending).checks[0]?.reason).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rechecks lifecycle after probes so shutdown cannot restore readiness", async () => {
    const app = started();
    let release!: (value: "up") => void;
    const check = new Promise<"up">((resolve) => {
      release = resolve;
    });
    const provider = createApplicationHealth(app, {
      checks: [{ name: "slow", check: () => check }],
    });
    const pending = provider.readiness();
    app.state = LifecycleState.Stopping;
    release("up");
    const report = await pending;
    expect(report.state).toBe(LifecycleState.Stopping);
    expect(report.status).toBe("down");
    expect(report.checks[0]?.status).toBe("up");
  });

  it("captures definitions, binds provider methods and keeps concurrent observations independent", async () => {
    const definition = {
      name: "bound",
      value: "up" as const,
      check() {
        return this.value;
      },
    };
    const checks = [definition];
    const app = started();
    const provider = createApplicationHealth(app, { checks });
    definition.name = "changed";
    definition.check = () => {
      throw new Error("replacement must not run");
    };
    checks.length = 0;
    const other = createApplicationHealth({ state: LifecycleState.Stopped });
    const results = await Promise.all([
      provider.readiness(),
      provider.readiness(),
      other.readiness(),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "up",
      "up",
      "down",
    ]);
    expect(results[0]?.checks).toEqual([{ name: "bound", status: "up" }]);
    expect(results[0]).not.toBe(results[1]);
  });

  it.each([0, -1, 0.5, NaN, Infinity, 2147483648])(
    "rejects invalid deadline %s",
    (timeoutMs) => {
      expect(() => createApplicationHealth(started(), { timeoutMs })).toThrow(
        "timeoutMs",
      );
    },
  );

  it.each(["", "   "])("rejects empty probe name '%s'", (name) => {
    expect(() =>
      createApplicationHealth(started(), {
        checks: [{ name, check: () => "up" }],
      }),
    ).toThrow("nonempty");
  });

  it("rejects duplicate probe names", () => {
    const check: HealthCheck = { name: "duplicate", check: () => "up" };
    expect(() =>
      createApplicationHealth(started(), { checks: [check, check] }),
    ).toThrow("unique");
  });
});
