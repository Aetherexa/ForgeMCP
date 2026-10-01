import type { ConfigurationSource } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { resolveConfiguration } from "./configuration-resolver.js";
import { StaticConfigurationSource } from "./static-configuration-source.js";

describe("resolveConfiguration", () => {
  it("lets later sources override earlier sources", async () => {
    const configuration = await resolveConfiguration([
      new StaticConfigurationSource({
        "service.url": "https://default.example",
        "service.timeout": "10",
      }),
      new StaticConfigurationSource({
        "SERVICE.URL": "https://override.example",
      }),
    ]);

    expect(configuration.require("service.url")).toBe(
      "https://override.example",
    );
    expect(configuration.require("service.timeout")).toBe("10");
  });

  it("awaits asynchronous configuration sources in registration order", async () => {
    const calls: string[] = [];

    const first: ConfigurationSource = {
      async load() {
        await Promise.resolve();
        calls.push("first");
        return { value: "one" };
      },
    };

    const second: ConfigurationSource = {
      load() {
        calls.push("second");
        return { value: "two" };
      },
    };

    const configuration = await resolveConfiguration([first, second]);

    expect(calls).toEqual(["first", "second"]);
    expect(configuration.require("value")).toBe("two");
  });

  it("rejects duplicate normalized keys from one source", async () => {
    const source: ConfigurationSource = {
      load() {
        return {
          "service.url": "one",
          "SERVICE.URL": "two",
        };
      },
    };

    await expect(resolveConfiguration([source])).rejects.toThrow(
      "Configuration source produced duplicate normalized key 'service.url'.",
    );
  });

  it("propagates source failures", async () => {
    const source: ConfigurationSource = {
      load() {
        throw new Error("configuration unavailable");
      },
    };

    await expect(resolveConfiguration([source])).rejects.toThrow(
      "configuration unavailable",
    );
  });
});
