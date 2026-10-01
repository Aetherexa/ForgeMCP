import { describe, expect, it } from "vitest";

import { ConfigurationKeyNotFoundError } from "./configuration-error.js";
import { normalizeConfigurationKey } from "./configuration-key.js";

describe("normalizeConfigurationKey", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeConfigurationKey(" Database.URL ")).toBe("database.url");
  });

  it("normalizes whitespace around path segments", () => {
    expect(normalizeConfigurationKey("database . primary . url")).toBe(
      "database.primary.url",
    );
  });

  it("rejects empty keys and empty path segments", () => {
    expect(() => normalizeConfigurationKey(" ")).toThrow(
      "Configuration key ' ' is invalid.",
    );
    expect(() => normalizeConfigurationKey("database..url")).toThrow(
      "Configuration key 'database..url' is invalid.",
    );
  });
});

describe("ConfigurationKeyNotFoundError", () => {
  it("stores the canonical missing key", () => {
    const error = new ConfigurationKeyNotFoundError(" Database.URL ");

    expect(error.name).toBe("ConfigurationKeyNotFoundError");
    expect(error.key).toBe("database.url");
    expect(error.message).toBe(
      "Configuration key 'database.url' is required but was not provided.",
    );
  });
});
