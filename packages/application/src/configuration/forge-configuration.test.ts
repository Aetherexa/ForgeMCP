import { ConfigurationKeyNotFoundError } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeConfiguration } from "./forge-configuration.js";

describe("ForgeConfiguration", () => {
  it("normalizes keys for lookup", () => {
    const configuration = new ForgeConfiguration({
      "Database.URL": "postgres://localhost",
    });

    expect(configuration.get("database.url")).toBe("postgres://localhost");
    expect(configuration.get(" DATABASE.URL ")).toBe("postgres://localhost");
    expect(configuration.has("database.url")).toBe(true);
  });

  it("returns undefined for an optional missing value", () => {
    const configuration = new ForgeConfiguration();

    expect(configuration.get("missing.value")).toBeUndefined();
    expect(configuration.has("missing.value")).toBe(false);
  });

  it("throws a stable error for a required missing value", () => {
    const configuration = new ForgeConfiguration();

    expect(() => configuration.require("Database.URL")).toThrow(
      ConfigurationKeyNotFoundError,
    );
    expect(() => configuration.require("Database.URL")).toThrow(
      "Configuration key 'database.url' is required but was not provided.",
    );
  });

  it("returns immutable snapshots without exposing internal state", () => {
    const configuration = new ForgeConfiguration({
      "feature.enabled": "true",
    });

    const first = configuration.toObject();
    const second = configuration.toObject();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("rejects duplicate normalized keys", () => {
    expect(
      () =>
        new ForgeConfiguration({
          "database.url": "first",
          "DATABASE.URL": "second",
        }),
    ).toThrow(
      "Configuration contains duplicate normalized key 'database.url'.",
    );
  });
});
