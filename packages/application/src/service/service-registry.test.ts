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
    expect(() => registry.registerFactory(token, () => "factory")).toThrow(
      "Service 'value' is already registered.",
    );
    expect(() => registry.registerScopedFactory(token, () => "scoped")).toThrow(
      "Service 'value' is already registered.",
    );
    expect(() =>
      registry.registerTransientFactory(token, () => "transient"),
    ).toThrow("Service 'value' is already registered.");
  });

  it("records explicit service lifetimes", () => {
    const applicationToken = createServiceToken<string>("application");
    const scopedToken = createServiceToken<string>("scoped");
    const transientToken = createServiceToken<string>("transient");
    const registry = new ServiceRegistry();

    registry.registerFactory(applicationToken, () => "application");
    registry.registerScopedFactory(scopedToken, () => "scoped");
    registry.registerTransientFactory(transientToken, () => "transient");

    expect(
      registry
        .getAll()
        .map(({ token, lifetime }) => [token.description, lifetime]),
    ).toEqual([
      ["application", "application"],
      ["scoped", "execution"],
      ["transient", "transient"],
    ]);
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

  it("awaits asynchronous dependencies and constructs each application service once", async () => {
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

  it("does not construct shorter-lived services during application resolution", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const transientToken = createServiceToken<object>("transient");
    let constructions = 0;
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(scopedToken, () => {
      constructions += 1;
      return {};
    });
    registry.registerTransientFactory(transientToken, () => {
      constructions += 1;
      return {};
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());

    expect(runtime.services.get(scopedToken)).toBeUndefined();
    expect(runtime.services.get(transientToken)).toBeUndefined();
    expect(constructions).toBe(0);
  });

  it("returns undefined for optional unregistered dependencies", async () => {
    const serviceToken = createServiceToken<string>("service");
    const missingToken = createServiceToken<string>("missing");
    const registry = new ServiceRegistry();

    registry.registerFactory(
      serviceToken,
      async ({ services }) => (await services.get(missingToken)) ?? "fallback",
    );

    const provider = await registry.resolve(new ForgeConfiguration());

    expect(provider.require(serviceToken)).toBe("fallback");
  });

  it("fails when a required application dependency is missing", async () => {
    const serviceToken = createServiceToken<string>("service");
    const missingToken = createServiceToken<string>("missing");
    const registry = new ServiceRegistry();

    registry.registerFactory(serviceToken, async ({ services }) =>
      services.require(missingToken),
    );

    await expect(registry.resolve(new ForgeConfiguration())).rejects.toThrow(
      "Service 'missing' is required but was not registered.",
    );
  });

  it("rejects application services that capture scoped dependencies", async () => {
    const applicationToken = createServiceToken<string>("application");
    const scopedToken = createServiceToken<string>("scoped");
    const registry = new ServiceRegistry();

    registry.registerFactory(applicationToken, async ({ services }) =>
      services.require(scopedToken),
    );
    registry.registerScopedFactory(scopedToken, () => "scoped");

    await expect(
      registry.resolveRuntime(new ForgeConfiguration()),
    ).rejects.toMatchObject({
      name: "CaptiveServiceDependencyError",
      consumerDescription: "application",
      dependencyDescription: "scoped",
      dependencyLifetime: "execution",
    });

    await expect(
      registry.resolveRuntime(new ForgeConfiguration()),
    ).rejects.toThrow(
      "Application service 'application' cannot depend on execution service 'scoped'.",
    );
  });

  it("rejects application services that capture transient dependencies", async () => {
    const applicationToken = createServiceToken<string>("application");
    const transientToken = createServiceToken<string>("transient");
    const registry = new ServiceRegistry();

    registry.registerFactory(applicationToken, async ({ services }) =>
      services.require(transientToken),
    );
    registry.registerTransientFactory(transientToken, () => "transient");

    await expect(
      registry.resolveRuntime(new ForgeConfiguration()),
    ).rejects.toThrow(
      "Application service 'application' cannot depend on transient service 'transient'.",
    );
  });

  it("detects circular application service dependencies with the dependency path", async () => {
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

    await expect(registry.resolve(new ForgeConfiguration())).rejects.toThrow(
      "Circular service dependency detected: 'first' -> 'second' -> 'first'.",
    );
  });

  it("reuses scoped services inside one scope and isolates concurrent scopes", async () => {
    const token = createServiceToken<object>("scoped");
    let constructions = 0;
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(token, async () => {
      constructions += 1;
      await Promise.resolve();
      return {};
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const firstScope = runtime.createScope();
    const secondScope = runtime.createScope();

    const [[firstA, firstB], [secondA, secondB]] = await Promise.all([
      Promise.all([firstScope.require(token), firstScope.require(token)]),
      Promise.all([secondScope.require(token), secondScope.require(token)]),
    ]);

    expect(firstA).toBe(firstB);
    expect(secondA).toBe(secondB);
    expect(firstA).not.toBe(secondA);
    expect(constructions).toBe(2);
  });

  it("constructs transient services for every resolution request", async () => {
    const token = createServiceToken<object>("transient");
    let constructions = 0;
    const registry = new ServiceRegistry();

    registry.registerTransientFactory(token, () => {
      constructions += 1;
      return {};
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    const first = await scope.require(token);
    const second = await scope.require(token);

    expect(first).not.toBe(second);
    expect(constructions).toBe(2);
  });

  it("allows scoped services to resolve application and transient dependencies", async () => {
    const applicationToken = createServiceToken<object>("application");
    const transientToken = createServiceToken<object>("transient");
    const scopedToken = createServiceToken<{
      application: object;
      transient: object;
    }>("scoped");
    const application = {};
    let transientConstructions = 0;
    const registry = new ServiceRegistry();

    registry.registerValue(applicationToken, application);
    registry.registerTransientFactory(transientToken, () => {
      transientConstructions += 1;
      return {};
    });
    registry.registerScopedFactory(scopedToken, async ({ services }) => ({
      application: await services.require(applicationToken),
      transient: await services.require(transientToken),
    }));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    const scoped = await scope.require(scopedToken);
    const repeated = await scope.require(scopedToken);
    const directTransient = await scope.require(transientToken);

    expect(scoped).toBe(repeated);
    expect(scoped.application).toBe(application);
    expect(scoped.transient).not.toBe(directTransient);
    expect(transientConstructions).toBe(2);
  });

  it("preserves missing dependency diagnostics inside a scope", async () => {
    const serviceToken = createServiceToken<string>("scoped");
    const missingToken = createServiceToken<string>("missing");
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(serviceToken, async ({ services }) =>
      services.require(missingToken),
    );

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await expect(scope.require(serviceToken)).rejects.toThrow(
      "Service 'missing' is required but was not registered.",
    );
  });

  it("detects circular dependencies across shorter-lived services", async () => {
    const scopedToken = createServiceToken<string>("scoped");
    const transientToken = createServiceToken<string>("transient");
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(scopedToken, async ({ services }) => {
      await services.require(transientToken);
      return "scoped";
    });
    registry.registerTransientFactory(transientToken, async ({ services }) => {
      await services.require(scopedToken);
      return "transient";
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await expect(scope.require(scopedToken)).rejects.toMatchObject({
      name: "CircularServiceDependencyError",
      dependencyPath: ["scoped", "transient", "scoped"],
    });
  });

  it("retries a failed scoped construction without poisoning the scope", async () => {
    const token = createServiceToken<string>("unstable");
    let attempts = 0;
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(token, () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("temporary failure");
      }

      return "ready";
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await expect(scope.require(token)).rejects.toThrow("temporary failure");
    await expect(scope.require(token)).resolves.toBe("ready");
    await expect(scope.require(token)).resolves.toBe("ready");
    expect(attempts).toBe(2);
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
