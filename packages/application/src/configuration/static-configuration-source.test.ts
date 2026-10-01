import { describe, expect, it } from "vitest";

import { StaticConfigurationSource } from "./static-configuration-source.js";

describe("StaticConfigurationSource", () => {
  it("captures values at construction time", () => {
    const values: Record<string, string> = {
      "feature.mode": "safe",
    };
    const source = new StaticConfigurationSource(values);

    values["feature.mode"] = "mutated";

    expect(source.load()).toEqual({
      "feature.mode": "safe",
    });
    expect(Object.isFrozen(source.load())).toBe(true);
  });
});
