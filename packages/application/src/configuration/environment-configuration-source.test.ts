import { describe, expect, it } from "vitest";

import { EnvironmentConfigurationSource } from "./environment-configuration-source.js";

describe("EnvironmentConfigurationSource", () => {
  it("maps prefixed variables to canonical dot-separated keys", () => {
    const environment = {
      APP_DATABASE__URL: "postgres://localhost",
      APP_FEATURE__ENABLED: "true",
      OTHER_VALUE: "ignored",
    };

    const source = new EnvironmentConfigurationSource({
      prefix: "APP_",
      environment,
    });

    expect(source.load()).toEqual({
      "database.url": "postgres://localhost",
      "feature.enabled": "true",
    });
  });

  it("supports a custom separator", () => {
    const source = new EnvironmentConfigurationSource({
      prefix: "APP_",
      separator: "___",
      environment: {
        APP_SERVICE___URL: "https://example.com",
      },
    });

    expect(source.load()).toEqual({
      "service.url": "https://example.com",
    });
  });

  it("ignores undefined values and the bare prefix", () => {
    const source = new EnvironmentConfigurationSource({
      prefix: "APP_",
      environment: {
        APP_: "ignored",
        APP_DEFINED: "value",
        APP_MISSING: undefined,
      },
    });

    expect(source.load()).toEqual({
      defined: "value",
    });
  });

  it("does not mutate the supplied environment dictionary", () => {
    const environment: Record<string, string | undefined> = {
      APP_VALUE: "original",
    };
    const source = new EnvironmentConfigurationSource({
      prefix: "APP_",
      environment,
    });

    source.load();

    expect(environment).toEqual({
      APP_VALUE: "original",
    });
  });

  it("rejects empty prefix and separator values", () => {
    expect(
      () =>
        new EnvironmentConfigurationSource({
          prefix: "",
          environment: {},
        }),
    ).toThrow("Environment configuration prefix must not be empty.");

    expect(
      () =>
        new EnvironmentConfigurationSource({
          prefix: "APP_",
          separator: "",
          environment: {},
        }),
    ).toThrow("Environment configuration separator must not be empty.");
  });

  it("rejects environment variables that normalize to the same key", () => {
    const source = new EnvironmentConfigurationSource({
      prefix: "APP_",
      environment: {
        APP_DATABASE__URL: "first",
        APP_database__url: "second",
      },
    });

    expect(() => source.load()).toThrow(
      "Environment variables contain duplicate normalized key 'database.url'.",
    );
  });
});
