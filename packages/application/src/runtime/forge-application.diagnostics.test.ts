import {
  createServiceToken,
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  LifecycleState,
  type DiagnosticEvent,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";
import { ServiceDisposalError } from "../service/service-errors.js";

describe("ForgeApplication diagnostics", () => {
  it("notifies listeners in registration order for application lifecycle events", async () => {
    const calls: string[] = [];

    const application = ForgeApplicationBuilder.create()
      .observe({
        onEvent(event) {
          calls.push(`first:${event.name}`);
        },
      })
      .observe({
        onEvent(event) {
          calls.push(`second:${event.name}`);
        },
      })
      .build();

    await application.start();
    await application.stop();

    expect(calls).toEqual([
      "first:application.starting",
      "second:application.starting",
      "first:application.started",
      "second:application.started",
      "first:application.stopping",
      "second:application.stopping",
      "first:application.stopped",
      "second:application.stopped",
    ]);
  });

  it("isolates listener failures from application and tool behavior", async () => {
    const observed: string[] = [];

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "echo" },
          execute(_context, input) {
            return { value: input };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .observe({
        onEvent() {
          throw new Error("diagnostic listener failed");
        },
      })
      .observe({
        onEvent(event) {
          observed.push(event.name);
        },
      })
      .use(TestModule)
      .build();

    await application.start();
    await expect(application.execute("echo", "ok")).resolves.toEqual({
      value: "ok",
    });
    await application.stop();

    expect(observed).toEqual([
      DiagnosticEventNames.ApplicationStarting,
      DiagnosticEventNames.ApplicationStarted,
      DiagnosticEventNames.ExecutionStarted,
      DiagnosticEventNames.ExecutionCompleted,
      DiagnosticEventNames.ApplicationStopping,
      DiagnosticEventNames.ApplicationStopped,
    ]);
  });

  it("correlates execution diagnostics without emitting raw input or result payloads", async () => {
    const events: DiagnosticEvent[] = [];

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "inspect" },
          execute(_context, input) {
            return { value: input };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .observe({
        onEvent(event) {
          if (event.execution !== undefined) {
            events.push(event);
          }
        },
      })
      .use(TestModule)
      .build();

    await application.start();

    const input = { secret: "never-log-this" };

    await expect(
      application.execute("inspect", input, {
        "external.correlation": "customer-request-42",
      }),
    ).resolves.toEqual({ value: input });

    const [started, completed] = events;

    expect(started?.name).toBe(DiagnosticEventNames.ExecutionStarted);
    expect(completed?.name).toBe(DiagnosticEventNames.ExecutionCompleted);
    expect(started?.execution?.id).toBeTruthy();
    expect(completed?.execution?.id).toBe(started?.execution?.id);
    expect(started?.execution?.attributes).toEqual({
      "external.correlation": "customer-request-42",
    });
    expect(started?.attributes).toEqual({
      [DiagnosticAttributeNames.ToolName]: "inspect",
    });
    expect(completed?.attributes[DiagnosticAttributeNames.ToolName]).toBe(
      "inspect",
    );
    expect(
      completed?.attributes[DiagnosticAttributeNames.DurationMs],
    ).toEqual(expect.any(Number));
    expect(JSON.stringify(started?.attributes)).not.toContain(
      "never-log-this",
    );
    expect(JSON.stringify(completed?.attributes)).not.toContain(
      "never-log-this",
    );
    expect(Object.isFrozen(started)).toBe(true);
    expect(Object.isFrozen(started?.attributes)).toBe(true);
    expect(Object.isFrozen(started?.execution)).toBe(true);
    expect(Object.isFrozen(started?.execution?.attributes)).toBe(true);
    expect(started?.timestamp).toBeInstanceOf(Date);
  });

  it("emits execution failure only after request-owned cleanup finishes", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const order: string[] = [];
    const failure = new Error("tool failed");

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "fail" },
          async execute(context) {
            await context.services.require(scopedToken);
            throw failure;
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        [Symbol.dispose]() {
          order.push("scope.disposed");
        },
      }))
      .observe({
        onEvent(event) {
          if (event.name === DiagnosticEventNames.ExecutionFailed) {
            order.push("execution.failed");
          }
        },
      })
      .use(TestModule)
      .build();

    await application.start();

    let thrown: unknown;

    try {
      await application.execute("fail", undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(failure);
    expect(order).toEqual(["scope.disposed", "execution.failed"]);
  });

  it("preserves unique execution correlation across concurrent calls", async () => {
    const executionIds: string[] = [];
    let releaseFirst: (() => void) | undefined;
    let releaseSecond: (() => void) | undefined;

    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "wait" },
          async execute(_context, input) {
            const request = input as {
              gate: Promise<void>;
              value: string;
            };

            await request.gate;
            return { value: request.value };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .observe({
        onEvent(event) {
          if (
            event.name === DiagnosticEventNames.ExecutionStarted &&
            event.execution !== undefined
          ) {
            executionIds.push(event.execution.id);
          }
        },
      })
      .use(TestModule)
      .build();

    await application.start();

    const first = application.execute("wait", {
      gate: firstGate,
      value: "first",
    });
    const second = application.execute("wait", {
      gate: secondGate,
      value: "second",
    });

    expect(executionIds).toHaveLength(2);
    expect(new Set(executionIds).size).toBe(2);

    releaseSecond?.();
    releaseFirst?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: "first" },
      { value: "second" },
    ]);
  });

  it("emits startup failure after rollback cleanup finishes", async () => {
    const serviceToken = createServiceToken<object>("application");
    const order: string[] = [];

    class FailingModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        throw new Error("module failed");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideFactory(serviceToken, () => ({
        [Symbol.dispose]() {
          order.push("application.disposed");
        },
      }))
      .observe({
        onEvent(event) {
          if (event.name === DiagnosticEventNames.ApplicationStartFailed) {
            order.push("application.start.failed");
          }
        },
      })
      .use(FailingModule)
      .build();

    await expect(application.start()).rejects.toThrow("module failed");

    expect(order).toEqual([
      "application.disposed",
      "application.start.failed",
    ]);
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("emits stop failure after best-effort application cleanup", async () => {
    const serviceToken = createServiceToken<object>("application");
    const cleanupFailure = new Error("cleanup failed");
    const events: string[] = [];

    const application = ForgeApplicationBuilder.create()
      .provideFactory(serviceToken, () => ({
        [Symbol.dispose]() {
          throw cleanupFailure;
        },
      }))
      .observe({
        onEvent(event) {
          events.push(event.name);
        },
      })
      .build();

    await application.start();

    await expect(application.stop()).rejects.toMatchObject({
      name: "ServiceDisposalError",
      failures: [
        {
          serviceDescription: "application",
          error: cleanupFailure,
        },
      ],
    } satisfies Partial<ServiceDisposalError>);

    expect(events).toEqual([
      DiagnosticEventNames.ApplicationStarting,
      DiagnosticEventNames.ApplicationStarted,
      DiagnosticEventNames.ApplicationStopping,
      DiagnosticEventNames.ApplicationStopFailed,
    ]);
    expect(application.state).toBe(LifecycleState.Stopped);
  });
});
