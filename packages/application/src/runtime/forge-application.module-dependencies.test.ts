import {
  createServiceToken,
  LifecycleState,
  type Module,
  type ModuleBuilder,
  type ModuleType,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";

describe("ForgeApplication module dependencies", () => {
  it("configures dependencies before dependents regardless of selection order", async () => {
    const calls: string[] = [];

    class FoundationModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("foundation");
      }
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        calls.push("feature");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .use(FeatureModule)
      .use(FoundationModule)
      .build();

    await application.start();

    expect(calls).toEqual(["foundation", "feature"]);
    expect(application.state).toBe(LifecycleState.Started);
  });

  it("preserves stable selection order for otherwise independent modules", async () => {
    const calls: string[] = [];

    class FoundationModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("foundation");
      }
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        calls.push("feature");
      }
    }

    class IndependentModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("independent");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .use(FeatureModule)
      .use(IndependentModule)
      .use(FoundationModule)
      .build();

    await application.start();

    expect(calls).toEqual(["foundation", "feature", "independent"]);
  });

  it("configures a shared diamond dependency exactly once", async () => {
    const calls: string[] = [];

    class FoundationModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("foundation");
      }
    }

    class LeftModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        calls.push("left");
      }
    }

    class RightModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        calls.push("right");
      }
    }

    class RootModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        LeftModule,
        RightModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        calls.push("root");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .use(RootModule)
      .use(RightModule)
      .use(LeftModule)
      .use(FoundationModule)
      .build();

    await application.start();

    expect(calls).toEqual(["foundation", "left", "right", "root"]);
  });

  it("fails a missing dependency before modules or services are constructed", async () => {
    const serviceToken = createServiceToken<object>("service");
    let serviceConstructions = 0;
    let moduleConfigurations = 0;

    class MissingModule implements Module {
      public configure(_builder: ModuleBuilder): void {}
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        MissingModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        moduleConfigurations += 1;
      }
    }

    class IndependentModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        moduleConfigurations += 1;
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideFactory(serviceToken, () => {
        serviceConstructions += 1;
        return {};
      })
      .use(IndependentModule)
      .use(FeatureModule)
      .build();

    await expect(application.start()).rejects.toThrow(
      "Module 'FeatureModule' requires module 'MissingModule', but it is not registered.",
    );

    expect(moduleConfigurations).toBe(0);
    expect(serviceConstructions).toBe(0);
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("fails a circular graph before any module is configured", async () => {
    const calls: string[] = [];

    class FirstModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [SecondModule];
      }

      public configure(_builder: ModuleBuilder): void {
        calls.push("first");
      }
    }

    class SecondModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [FirstModule];
      }

      public configure(_builder: ModuleBuilder): void {
        calls.push("second");
      }
    }

    const application = ForgeApplicationBuilder.create()
      .use(FirstModule)
      .use(SecondModule)
      .build();

    await expect(application.start()).rejects.toThrow(
      "Circular module dependency detected: 'FirstModule' -> 'SecondModule' -> 'FirstModule'.",
    );

    expect(calls).toEqual([]);
    expect(application.state).toBe(LifecycleState.Created);
  });

  it("keeps repeated start idempotent after dependency-aware startup", async () => {
    let foundationConfigurations = 0;
    let featureConfigurations = 0;

    class FoundationModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        foundationConfigurations += 1;
      }
    }

    class FeatureModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {
        featureConfigurations += 1;
      }
    }

    const application = ForgeApplicationBuilder.create()
      .use(FeatureModule)
      .use(FoundationModule)
      .build();

    await application.start();
    await application.start();

    expect(foundationConfigurations).toBe(1);
    expect(featureConfigurations).toBe(1);
  });
});
