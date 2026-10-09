import {
  createServiceToken,
  LifecycleState,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";
import { createApplicationHealth } from "./application-health.js";

const failingResource = createServiceToken<{ [Symbol.dispose](): void }>(
  "failing-health-resource",
);

describe("health lifecycle failures", () => {
  it("keeps readiness down after failed startup and permits the existing retry lifecycle", async () => {
    let fail = true;
    class StartupModule implements Module {
      configure(_builder: ModuleBuilder): void {
        if (fail) throw new Error("private-startup-secret");
      }
    }
    const app = ForgeApplicationBuilder.create().use(StartupModule).build();
    const health = createApplicationHealth(app);
    await expect(app.start()).rejects.toThrow("private-startup-secret");
    const result = await health.readiness();
    expect(result.status).toBe("down");
    expect(result.state).toBe(LifecycleState.Created);
    expect(JSON.stringify(result)).not.toContain("private-startup-secret");
    fail = false;
    await app.start();
    expect((await health.readiness()).status).toBe("up");
    await app.stop();
  });

  it("remains unavailable after failed disposal without hiding the lifecycle error", async () => {
    const app = ForgeApplicationBuilder.create()
      .provideFactory(failingResource, () => ({
        [Symbol.dispose]() {
          throw new Error("private-disposal-secret");
        },
      }))
      .build();
    const health = createApplicationHealth(app);
    await app.start();
    await expect(app.stop()).rejects.toThrow();
    expect(app.state).toBe(LifecycleState.Stopped);
    expect(health.liveness().status).toBe("down");
    const result = await health.readiness();
    expect(result.status).toBe("down");
    expect(JSON.stringify(result)).not.toContain("private-disposal-secret");
    await app.stop();
  });
});
