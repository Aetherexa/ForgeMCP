import {
  createServiceToken,
  LifecycleState,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";
import { ServiceDisposalError } from "../service/service-errors.js";

describe("ForgeApplication lifecycle-aware service disposal", () => {
  it("disposes already-created application services when later service resolution fails", async () => {
    const firstToken = createServiceToken<object>("first");
    const failingToken = createServiceToken<object>("failing");
    const failure = new Error("service construction failed");
    let disposals = 0;

    const application = ForgeApplicationBuilder.create()
      .provideFactory(firstToken, () => ({
        [Symbol.dispose]() {
          disposals += 1;
        },
      }))
      .provideFactory(failingToken, () => {
        throw failure;
      })
      .build();

    let thrown: unknown;

    try {
      await application.start();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(failure);
    expect(disposals).toBe(1);
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("disposes application services when module configuration fails", async () => {
    const serviceToken = createServiceToken<object>("service");
    let disposals = 0;

    class FailingModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        throw new Error("module configuration failed");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideFactory(serviceToken, () => ({
        [Symbol.dispose]() {
          disposals += 1;
        },
      }))
      .use(FailingModule)
      .build();

    await expect(application.start()).rejects.toThrow(
      "module configuration failed",
    );

    expect(disposals).toBe(1);
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("preserves startup and cleanup failures together", async () => {
    const serviceToken = createServiceToken<object>("service");
    const startupFailure = new Error("module configuration failed");
    const cleanupFailure = new Error("service cleanup failed");

    class FailingModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        throw startupFailure;
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideFactory(serviceToken, () => ({
        [Symbol.dispose]() {
          throw cleanupFailure;
        },
      }))
      .use(FailingModule)
      .build();

    let thrown: unknown;

    try {
      await application.start();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect(thrown).toMatchObject({
      message: "Application startup failed and service cleanup also failed.",
    });

    const errors = (thrown as AggregateError).errors;

    expect(errors[0]).toBe(startupFailure);
    expect(errors[1]).toBeInstanceOf(ServiceDisposalError);
    expect(errors[1]).toMatchObject({
      failures: [
        {
          serviceDescription: "service",
          error: cleanupFailure,
        },
      ],
    });
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("disposes execution-scoped services after successful execution", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    let disposals = 0;

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          async execute(context) {
            await context.services.require(scopedToken);
            return { value: "ok" };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        [Symbol.dispose]() {
          disposals += 1;
        },
      }))
      .use(TestModule)
      .build();

    await application.start();
    await expect(application.execute("run", undefined)).resolves.toEqual({
      value: "ok",
    });

    expect(disposals).toBe(1);
  });

  it("preserves the original execution failure when scope cleanup succeeds", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const executionFailure = new Error("tool failed");
    let disposals = 0;

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          async execute(context) {
            await context.services.require(scopedToken);
            throw executionFailure;
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        [Symbol.dispose]() {
          disposals += 1;
        },
      }))
      .use(TestModule)
      .build();

    await application.start();

    let thrown: unknown;

    try {
      await application.execute("run", undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(executionFailure);
    expect(disposals).toBe(1);
    expect(application.state).toBe(LifecycleState.Started);
  });

  it("preserves execution and cleanup failures together", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const executionFailure = new Error("tool failed");
    const cleanupFailure = new Error("scope cleanup failed");

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          async execute(context) {
            await context.services.require(scopedToken);
            throw executionFailure;
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        [Symbol.dispose]() {
          throw cleanupFailure;
        },
      }))
      .use(TestModule)
      .build();

    await application.start();

    let thrown: unknown;

    try {
      await application.execute("run", undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect(thrown).toMatchObject({
      message: "Tool execution failed and service cleanup also failed.",
    });

    const errors = (thrown as AggregateError).errors;

    expect(errors[0]).toBe(executionFailure);
    expect(errors[1]).toBeInstanceOf(ServiceDisposalError);
    expect(errors[1]).toMatchObject({
      failures: [
        {
          serviceDescription: "scoped",
          error: cleanupFailure,
        },
      ],
    });
  });

  it("reports scope cleanup failure after an otherwise successful execution", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const cleanupFailure = new Error("scope cleanup failed");

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          async execute(context) {
            await context.services.require(scopedToken);
            return { value: "ok" };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        [Symbol.dispose]() {
          throw cleanupFailure;
        },
      }))
      .use(TestModule)
      .build();

    await application.start();

    await expect(application.execute("run", undefined)).rejects.toMatchObject({
      name: "ServiceDisposalError",
      failures: [
        {
          serviceDescription: "scoped",
          error: cleanupFailure,
        },
      ],
    });
  });

  it("waits for active executions before disposing application services", async () => {
    const applicationToken = createServiceToken<{
      readonly disposed: boolean;
    }>("application");

    let disposed = false;
    let enteredExecution: (() => void) | undefined;
    let releaseExecution: (() => void) | undefined;

    const executionEntered = new Promise<void>((resolve) => {
      enteredExecution = resolve;
    });
    const executionRelease = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          async execute(context) {
            const service = await context.services.require(applicationToken);

            enteredExecution?.();
            expect(service.disposed).toBe(false);

            await executionRelease;

            expect(service.disposed).toBe(false);
            return { value: "finished" };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideFactory(applicationToken, () => ({
        get disposed() {
          return disposed;
        },
        [Symbol.dispose]() {
          disposed = true;
        },
      }))
      .use(TestModule)
      .build();

    await application.start();

    const execution = application.execute("run", undefined);

    await executionEntered;

    const stopping = application.stop();

    expect(application.state).toBe(LifecycleState.Stopping);
    expect(disposed).toBe(false);

    await expect(application.execute("run", undefined)).rejects.toThrow(
      "Application must be started before executing tools.",
    );

    releaseExecution?.();

    await expect(execution).resolves.toEqual({ value: "finished" });
    await stopping;

    expect(disposed).toBe(true);
    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("disposes application services exactly once across repeated stop calls", async () => {
    const applicationToken = createServiceToken<object>("application");
    let disposals = 0;

    const application = ForgeApplicationBuilder.create()
      .provideFactory(applicationToken, () => ({
        [Symbol.dispose]() {
          disposals += 1;
        },
      }))
      .build();

    await application.start();
    await application.stop();
    await application.stop();

    expect(disposals).toBe(1);
    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("ends in stopped state when application-service cleanup fails", async () => {
    const applicationToken = createServiceToken<object>("application");
    const cleanupFailure = new Error("application cleanup failed");

    const application = ForgeApplicationBuilder.create()
      .provideFactory(applicationToken, () => ({
        [Symbol.dispose]() {
          throw cleanupFailure;
        },
      }))
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
    });

    expect(application.state).toBe(LifecycleState.Stopped);
    await expect(application.stop()).resolves.toBeUndefined();
  });
});
