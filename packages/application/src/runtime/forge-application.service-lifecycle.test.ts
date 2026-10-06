import { createServiceToken, LifecycleState } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";

describe("ForgeApplication service lifecycle", () => {
  it("returns to created when service construction fails", async () => {
    const token = createServiceToken<string>("unstable");

    const application = ForgeApplicationBuilder.create()
      .provideFactory(token, () => {
        throw new Error("service unavailable");
      })
      .build();

    await expect(application.start()).rejects.toThrow("service unavailable");

    expect(application.state).toBe(LifecycleState.Created);
  });

  it("can retry startup after a transient service factory failure", async () => {
    const token = createServiceToken<string>("unstable");
    let attempts = 0;

    const application = ForgeApplicationBuilder.create()
      .provideFactory(token, () => {
        attempts += 1;

        if (attempts === 1) {
          throw new Error("temporary service failure");
        }

        return "ready";
      })
      .build();

    await expect(application.start()).rejects.toThrow(
      "temporary service failure",
    );
    expect(application.state).toBe(LifecycleState.Created);

    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
    expect(attempts).toBe(2);
  });

  it("does not reconstruct services on repeated start after success", async () => {
    const token = createServiceToken<object>("singleton");
    let constructions = 0;

    const application = ForgeApplicationBuilder.create()
      .provideFactory(token, () => {
        constructions += 1;
        return {};
      })
      .build();

    await application.start();
    await application.start();

    expect(constructions).toBe(1);
  });
});
