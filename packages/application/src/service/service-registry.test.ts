import { createServiceToken } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeConfiguration } from "../configuration/forge-configuration.js";
import { DuplicateServiceRegistrationError } from "./service-errors.js";
import { ServiceRegistry } from "./service-registry.js";

describe("ServiceRegistry", () => {
  it("resolves registered service values", async () => {
    const token = createServiceToken<{ name: string }>("apiClient");
    const value = { name: "client" };
    const registry = new ServiceRegistry();

    registry.registerValue(token, value);

    const provider = await registry.resolve(new ForgeConfiguration());

    expect(provider.get(token)).toBe(value);
    expect(provider.require(token)).toBe(value);
  });

  it("rejects duplicate registrations for the same token", () => {
    const token = createServiceToken<string>("value");
    const registry = new ServiceRegistry();

    registry.registerValue(token, "first");

    expect(() => registry.registerValue(token, "second")).toThrow(
      DuplicateServiceRegistrationError,
    );
    expect(() =>
      registry.registerFactory(token, () => "factory"),
    ).toThrow("Service 'value' is already registered.");
  });

  it("constructs factories from resolved configuration", async () => {
    const token = createServiceToken<string>("apiUrl");
    const registry = new ServiceRegistry();

    registry.registerFactory(token, ({ configuration }) =>
      configuration.require("api.url"),
    );

    const provider = await registry.resolve(
      new ForgeConfiguration({
        "api.url": "https://example.test",
      }),
    );

    expect(provider.require(token)).toBe("https://example.test");
  });

  it("resolves dependencies registered later", async () => {
    const clientToken = createServiceToken<{ baseUrl: string }>("apiClient");
    const baseUrlToken = createServiceToken<string>("baseUrl");
    const registry = new ServiceRegistry();

    registry.registerFactory(clientToken, async ({ services }) => ({
      baseUrl: await services.require(baseUrlToken),
    }));
    registry.registerValue(baseUrlToken, "https://example.test");

    const provider = await registry.resolve(new ForgeConfiguration());

    expect(provider.require(clientToken)).toEqual({
      baseUrl: "https://example.test",
    });
  });

  it("awaits asynchronous dependencies and constructs each service once", async () => {
    const dependencyToken = createServiceToken<object>("dependency");
    const firstToken = createServiceToken<object>("first");
    const secondToken = createServiceToken<object>("second");
    const dependency = {};
    let constructions = 0;
    const registry = new ServiceRegistry();

    registry.registerFactory(dependencyToken, async () => {
      constructions += 1;
      await Promise.resolve();
      return dependency;
    });

    registry.registerFactory(firstToken, async ({ services }) => ({
      dependency: await services.require(dependencyToken),
    }));

    registry.registerFactory(secondToken, async ({ services }) => ({
      dependency: await services.require(dependencyToken),
    }));

    const provider = await registry.resolve(new ForgeConfiguration());

    expect(provider.require(firstToken)).toEqual({ dependency });
    expect(provider.require(secondToken)).toEqual({ dependency });
    expect(provider.require(dependencyToken)).toBe(dependency);
    expect(constructions).toBe(1);
  });

  it("returns undefined for optional unregistered dependencies", async () => {
    const serviceToken = createServiceToken<string>("service");
    const missingToken = createServiceToken<string>("missing");
    const registry = new ServiceRegistry();

    registry.registerFactory(serviceToken, async ({ services }) =>
      (await services.get(missingToken)) ?? "fallback",
    );

    const provider = await registry.resolve(new ForgeConfiguration());

    expect(provider.require(serviceToken)).toBe("fallback");
  });

  it("fails when a required dependency is missing", async () => {
    const serviceToken = createServiceToken<string>("service");
    const missingToken = createServiceToken<string>("missing");
    const registry = new ServiceRegistry();

    registry.registerFactory(serviceToken, async ({ services }) =>
      services.require(missingToken),
    );

    await expect(
      registry.resolve(new ForgeConfiguration()),
    ).rejects.toThrow(
      "Service 'missing' is required but was not registered.",
    );
  });

  it("detects circular service dependencies with the dependency path", async () => {
    const firstToken = createServiceToken<string>("first");
    const secondToken = createServiceToken<string>("second");
    const registry = new ServiceRegistry();

    registry.registerFactory(firstToken, async ({ services }) => {
      await services.require(secondToken);
      return "first";
    });

    registry.registerFactory(secondToken, async ({ services }) => {
      await services.require(firstToken);
      return "second";
    });

    await expect(
      registry.resolve(new ForgeConfiguration()),
    ).rejects.toMatchObject({
      name: "CircularServiceDependencyError",
      dependencyPath: ["first", "second", "first"],
    });

    await expect(
      registry.resolve(new ForgeConfiguration()),
    ).rejects.toThrow(
      "Circular service dependency detected: 'first' -> 'second' -> 'first'.",
    );
  });

  it("returns registration snapshots", () => {
    const token = createServiceToken<string>("value");
    const registry = new ServiceRegistry();

    registry.registerValue(token, "one");

    const first = registry.getAll();
    const second = registry.getAll();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
