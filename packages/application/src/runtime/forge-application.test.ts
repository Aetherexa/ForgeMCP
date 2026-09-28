import { LifecycleState } from "@forgemcp/core";
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
