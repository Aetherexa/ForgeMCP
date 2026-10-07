import { createServiceToken } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeConfiguration } from "../configuration/forge-configuration.js";
import { ServiceDisposalError } from "./service-errors.js";
import { ServiceRegistry } from "./service-registry.js";

describe("service disposal", () => {
  it("disposes factory-created application services but not provided values", async () => {
    const providedToken = createServiceToken<object>("provided");
    const factoryToken = createServiceToken<object>("factory");
    let providedDisposals = 0;
    let factoryDisposals = 0;

    const provided = {
      [Symbol.dispose]() {
        providedDisposals += 1;
      },
    };

    const registry = new ServiceRegistry();

    registry.registerValue(providedToken, provided);
    registry.registerFactory(factoryToken, () => ({
      [Symbol.dispose]() {
        factoryDisposals += 1;
      },
    }));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());

    await runtime[Symbol.asyncDispose]();

    expect(providedDisposals).toBe(0);
    expect(factoryDisposals).toBe(1);
  });

  it("disposes application factories in reverse construction order and prefers async disposal", async () => {
    const dependencyToken = createServiceToken<object>("dependency");
    const dependentToken = createServiceToken<object>("dependent");
    const calls: string[] = [];
    const registry = new ServiceRegistry();

    registry.registerFactory(dependentToken, async ({ services }) => {
      await services.require(dependencyToken);

      return {
        [Symbol.dispose]() {
          calls.push("dependent");
        },
      };
    });

    registry.registerFactory(dependencyToken, () => ({
      async [Symbol.asyncDispose]() {
        calls.push("dependency:async");
      },
      [Symbol.dispose]() {
        calls.push("dependency:sync");
      },
    }));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());

    await runtime[Symbol.asyncDispose]();

    expect(calls).toEqual(["dependent", "dependency:async"]);
  });

  it("tracks scoped and every transient factory result per execution scope", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const transientToken = createServiceToken<object>("transient");
    const calls: string[] = [];
    let transientId = 0;
    const registry = new ServiceRegistry();

    registry.registerTransientFactory(transientToken, () => {
      const id = ++transientId;

      return {
        [Symbol.dispose]() {
          calls.push(`transient:${id}`);
        },
      };
    });

    registry.registerScopedFactory(scopedToken, async ({ services }) => {
      await services.require(transientToken);

      return {
        [Symbol.dispose]() {
          calls.push("scoped");
        },
      };
    });

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await scope.require(scopedToken);
    await scope.require(transientToken);
    await scope[Symbol.asyncDispose]();

    expect(calls).toEqual(["transient:2", "scoped", "transient:1"]);
  });

  it("makes scope and runtime disposal idempotent", async () => {
    const applicationToken = createServiceToken<object>("application");
    const scopedToken = createServiceToken<object>("scoped");
    let applicationDisposals = 0;
    let scopedDisposals = 0;
    const registry = new ServiceRegistry();

    registry.registerFactory(applicationToken, () => ({
      [Symbol.dispose]() {
        applicationDisposals += 1;
      },
    }));

    registry.registerScopedFactory(scopedToken, () => ({
      [Symbol.dispose]() {
        scopedDisposals += 1;
      },
    }));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await scope.require(scopedToken);

    const firstScopeDisposal = scope[Symbol.asyncDispose]();
    const secondScopeDisposal = scope[Symbol.asyncDispose]();

    expect(firstScopeDisposal).toBe(secondScopeDisposal);

    await firstScopeDisposal;
    await secondScopeDisposal;

    const firstRuntimeDisposal = runtime[Symbol.asyncDispose]();
    const secondRuntimeDisposal = runtime[Symbol.asyncDispose]();

    expect(firstRuntimeDisposal).toBe(secondRuntimeDisposal);

    await firstRuntimeDisposal;
    await secondRuntimeDisposal;

    expect(scopedDisposals).toBe(1);
    expect(applicationDisposals).toBe(1);
  });

  it("attempts every cleanup and reports failures in disposal order", async () => {
    const firstToken = createServiceToken<object>("first");
    const secondToken = createServiceToken<object>("second");
    const calls: string[] = [];
    const firstFailure = new Error("first failed");
    const secondFailure = new Error("second failed");
    const registry = new ServiceRegistry();

    registry.registerTransientFactory(firstToken, () => ({
      [Symbol.dispose]() {
        calls.push("first");
        throw firstFailure;
      },
    }));

    registry.registerTransientFactory(secondToken, () => ({
      async [Symbol.asyncDispose]() {
        calls.push("second");
        throw secondFailure;
      },
    }));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await scope.require(firstToken);
    await scope.require(secondToken);

    let disposalError: unknown;

    try {
      await scope[Symbol.asyncDispose]();
    } catch (error) {
      disposalError = error;
    }

    expect(calls).toEqual(["second", "first"]);
    expect(disposalError).toBeInstanceOf(ServiceDisposalError);
    expect(disposalError).toMatchObject({
      name: "ServiceDisposalError",
      message: "Failed to dispose 2 services: 'second', 'first'.",
      failures: [
        {
          serviceDescription: "second",
          error: secondFailure,
        },
        {
          serviceDescription: "first",
          error: firstFailure,
        },
      ],
    });
  });

  it("rejects service resolution after scope disposal and new scopes after runtime disposal", async () => {
    const token = createServiceToken<object>("scoped");
    const registry = new ServiceRegistry();

    registry.registerScopedFactory(token, () => ({}));

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await scope.require(token);
    await scope[Symbol.asyncDispose]();

    await expect(scope.get(token)).rejects.toThrow(
      "Service scope has already been disposed.",
    );
    await expect(scope.require(token)).rejects.toThrow(
      "Service scope has already been disposed.",
    );

    await runtime[Symbol.asyncDispose]();

    expect(() => runtime.createScope()).toThrow(
      "Service runtime has already been disposed.",
    );
  });

  it("ignores non-disposable factory results", async () => {
    const applicationToken = createServiceToken<string>("application");
    const scopedToken = createServiceToken<number>("scoped");
    const registry = new ServiceRegistry();

    registry.registerFactory(applicationToken, () => "value");
    registry.registerScopedFactory(scopedToken, () => 42);

    const runtime = await registry.resolveRuntime(new ForgeConfiguration());
    const scope = runtime.createScope();

    await expect(scope.require(scopedToken)).resolves.toBe(42);
    await expect(scope[Symbol.asyncDispose]()).resolves.toBeUndefined();
    await expect(runtime[Symbol.asyncDispose]()).resolves.toBeUndefined();
  });
});
