import {
  type ConfigurationSource,
  LifecycleState,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplication } from "./forge-application.js";

describe("ForgeApplication configuration lifecycle", () => {
  it("returns to created when configuration resolution fails", async () => {
    const source: ConfigurationSource = {
      load() {
        throw new Error("configuration unavailable");
      },
    };

    const application = new ForgeApplication([], [source]);

    await expect(application.start()).rejects.toThrow(
      "configuration unavailable",
    );

    expect(application.state).toBe(LifecycleState.Created);
  });

  it("can retry startup after a transient configuration failure", async () => {
    let attempts = 0;

    const source: ConfigurationSource = {
      load() {
        attempts += 1;

        if (attempts === 1) {
          throw new Error("temporary configuration failure");
        }

        return {
          "service.url": "https://example.com",
        };
      },
    };

    const application = new ForgeApplication([], [source]);

    await expect(application.start()).rejects.toThrow(
      "temporary configuration failure",
    );
    expect(application.state).toBe(LifecycleState.Created);

    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
    expect(attempts).toBe(2);
  });
});
