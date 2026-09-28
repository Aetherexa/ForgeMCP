import {
  LifecycleState,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplication } from "./forge-application.js";

describe("ForgeApplication lifecycle", () => {
  it("starts in the created state", () => {
    const application = new ForgeApplication([]);

    expect(application.state).toBe(LifecycleState.Created);
  });

  it("transitions from created to started", async () => {
    const application = new ForgeApplication([]);

    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
  });

  it("treats repeated start calls as idempotent", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
  });

  it("transitions from started to stopped", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("allows an application to stop before it is started", async () => {
    const application = new ForgeApplication([]);

    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("treats repeated stop calls as idempotent", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();
    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("does not allow a stopped application to be started again", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();

    await expect(application.start()).rejects.toThrow(
      "Cannot start application while lifecycle state is 'stopped'.",
    );

    expect(application.state).toBe(LifecycleState.Stopped);
  });
});

describe("ForgeApplication module composition", () => {
  it("configures registered modules during startup", async () => {
    let configured = false;

    class TestModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        configured = true;
      }
    }

    const application = new ForgeApplication([TestModule]);

    await application.start();

    expect(configured).toBe(true);
    expect(application.state).toBe(LifecycleState.Started);
  });

  it("awaits asynchronous module configuration", async () => {
    const calls: string[] = [];

    class FirstModule implements Module {
      public async configure(_builder: ModuleBuilder): Promise<void> {
        await Promise.resolve();
        calls.push("first");
      }
    }

    class SecondModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("second");
      }
    }

    const application = new ForgeApplication([FirstModule, SecondModule]);

    await application.start();

    expect(calls).toEqual(["first", "second"]);
  });

  it("returns to created state when module configuration fails", async () => {
    class FailingModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        throw new Error("module configuration failed");
      }
    }

    const application = new ForgeApplication([FailingModule]);

    await expect(application.start()).rejects.toThrow(
      "module configuration failed",
    );

    expect(application.state).toBe(LifecycleState.Created);
  });
});
