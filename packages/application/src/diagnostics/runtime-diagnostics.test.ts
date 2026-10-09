import {
  DiagnosticEventNames as E,
  LifecycleState,
  type DiagnosticEvent,
  type DiagnosticEventName,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";
import { createRuntimeDiagnostics } from "./runtime-diagnostics.js";

function event(name: DiagnosticEventName, id?: string): DiagnosticEvent {
  return {
    name,
    timestamp: new Date(),
    attributes: { secret: "private" },
    ...(id === undefined
      ? {}
      : {
          execution: {
            id,
            startedAt: new Date(),
            attributes: { secret: "private" },
          },
        }),
  };
}
describe("runtime snapshots", () => {
  it("separates overlapping calls and counts each terminal event once", () => {
    const provider = createRuntimeDiagnostics();
    const initial = provider.snapshot();
    expect(initial.state).toBe(LifecycleState.Created);
    provider.listener.onEvent(event(E.ApplicationStarted));
    provider.listener.onEvent(event(E.ExecutionStarted, "a"));
    provider.listener.onEvent(event(E.ExecutionStarted, "a"));
    provider.listener.onEvent(event(E.ExecutionStarted, "b"));
    provider.listener.onEvent(event(E.ExecutionCompleted, "unknown"));
    provider.listener.onEvent(event(E.ExecutionCompleted));
    expect(provider.snapshot().activeExecutions).toBe(2);
    provider.listener.onEvent(event(E.ExecutionFailed, "b"));
    provider.listener.onEvent(event(E.ExecutionFailed, "b"));
    provider.listener.onEvent(event(E.ExecutionCompleted, "a"));
    expect(provider.snapshot()).toEqual({
      state: LifecycleState.Started,
      activeExecutions: 0,
      completedExecutions: 1,
      failedExecutions: 1,
    });
    expect(initial.state).toBe(LifecycleState.Created);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(JSON.stringify(provider.snapshot())).not.toContain("private");
  });
  it.each([
    [E.ApplicationStarting, LifecycleState.Starting],
    [E.ApplicationStarted, LifecycleState.Started],
    [E.ApplicationStopping, LifecycleState.Stopping],
    [E.ApplicationStopped, LifecycleState.Stopped],
    [E.ApplicationStopFailed, LifecycleState.Stopped],
    [E.ApplicationStartFailed, LifecycleState.Created],
  ] as const)(
    "observes %s and clears active calls only on lifecycle termination",
    (name, state) => {
      const provider = createRuntimeDiagnostics();
      provider.listener.onEvent(event(E.ExecutionStarted, "a"));
      provider.listener.onEvent(event(name));
      expect(provider.snapshot().state).toBe(state);
      expect(provider.snapshot().activeExecutions).toBe(
        state === LifecycleState.Created || state === LifecycleState.Stopped
          ? 0
          : 1,
      );
    },
  );
});

it("keeps a call active through request cleanup and graceful drain", async () => {
  const { ForgeApplicationBuilder } = await import("../builder/index.js");
  const { createServiceToken } = await import("@forgemcp/core");
  let release!: () => void;
  let entered!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const admission = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const diagnostics = createRuntimeDiagnostics();
  const token = createServiceToken<{ [Symbol.asyncDispose](): Promise<void> }>(
    "resource",
  );
  class Tools {
    configure(builder: import("@forgemcp/core").ModuleBuilder) {
      builder.tool({
        metadata: { name: "wait" },
        async execute(context: import("@forgemcp/core").ExecutionContext) {
          await context.services.require(token);
          return { value: "done" };
        },
      });
    }
  }
  const app = ForgeApplicationBuilder.create()
    .observe(diagnostics.listener)
    .provideScopedFactory(token, () => ({
      async [Symbol.asyncDispose]() {
        entered();
        await barrier;
      },
    }))
    .use(Tools)
    .build();
  await app.start();
  const execution = app.execute("wait", undefined);
  await admission;
  const stop = app.stop();
  expect(diagnostics.snapshot()).toMatchObject({
    state: LifecycleState.Stopping,
    activeExecutions: 1,
    completedExecutions: 0,
  });
  release();
  await execution;
  await stop;
  expect(diagnostics.snapshot()).toEqual({
    state: LifecycleState.Stopped,
    activeExecutions: 0,
    completedExecutions: 1,
    failedExecutions: 0,
  });
});
