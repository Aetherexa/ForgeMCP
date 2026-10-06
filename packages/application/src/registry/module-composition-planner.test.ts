import type {
  Module,
  ModuleBuilder,
  ModuleType,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import {
  CircularModuleDependencyError,
  MissingModuleDependencyError,
} from "./module-dependency-errors.js";
import { planModuleComposition } from "./module-composition-planner.js";

class FoundationModule implements Module {
  public configure(_builder: ModuleBuilder): void {}
}

class FeatureModule implements Module {
  public static readonly dependencies: readonly ModuleType[] = [
    FoundationModule,
  ];

  public configure(_builder: ModuleBuilder): void {}
}

class IndependentModule implements Module {
  public configure(_builder: ModuleBuilder): void {}
}

describe("planModuleComposition", () => {
  it("preserves registration order when modules have no dependencies", () => {
    expect(
      planModuleComposition([
        FoundationModule,
        FeaturelessModule,
        IndependentModule,
      ]),
    ).toEqual([FoundationModule, FeaturelessModule, IndependentModule]);
  });

  it("orders a dependency before a dependent selected earlier", () => {
    expect(
      planModuleComposition([FeatureModule, FoundationModule]),
    ).toEqual([FoundationModule, FeatureModule]);
  });

  it("preserves registration order among otherwise independent modules", () => {
    expect(
      planModuleComposition([
        FeatureModule,
        IndependentModule,
        FoundationModule,
      ]),
    ).toEqual([FoundationModule, FeatureModule, IndependentModule]);
  });

  it("orders transitive dependencies before their dependents", () => {
    class RepositoryModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {}
    }

    class ApiModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        RepositoryModule,
      ];

      public configure(_builder: ModuleBuilder): void {}
    }

    expect(
      planModuleComposition([
        ApiModule,
        RepositoryModule,
        FoundationModule,
      ]),
    ).toEqual([FoundationModule, RepositoryModule, ApiModule]);
  });

  it("configures a shared diamond dependency exactly once", () => {
    class LeftModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {}
    }

    class RightModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        FoundationModule,
      ];

      public configure(_builder: ModuleBuilder): void {}
    }

    class RootModule implements Module {
      public static readonly dependencies: readonly ModuleType[] = [
        LeftModule,
        RightModule,
      ];

      public configure(_builder: ModuleBuilder): void {}
    }

    expect(
      planModuleComposition([
        RootModule,
        RightModule,
        LeftModule,
        FoundationModule,
      ]),
    ).toEqual([FoundationModule, LeftModule, RightModule, RootModule]);
  });

  it("rejects a dependency that was not explicitly selected", () => {
    expect(() => planModuleComposition([FeatureModule])).toThrow(
      MissingModuleDependencyError,
    );

    expect(() => planModuleComposition([FeatureModule])).toThrow(
      "Module 'FeatureModule' requires module 'FoundationModule', but it is not registered.",
    );

    try {
      planModuleComposition([FeatureModule]);
    } catch (error) {
      expect(error).toMatchObject({
        name: "MissingModuleDependencyError",
        dependentModuleName: "FeatureModule",
        missingModuleName: "FoundationModule",
      });
    }
  });

  it("detects a transitive circular dependency with its path", () => {
    class FirstModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [SecondModule];
      }

      public configure(_builder: ModuleBuilder): void {}
    }

    class SecondModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [ThirdModule];
      }

      public configure(_builder: ModuleBuilder): void {}
    }

    class ThirdModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [FirstModule];
      }

      public configure(_builder: ModuleBuilder): void {}
    }

    try {
      planModuleComposition([FirstModule, SecondModule, ThirdModule]);
    } catch (error) {
      expect(error).toBeInstanceOf(CircularModuleDependencyError);
      expect(error).toMatchObject({
        name: "CircularModuleDependencyError",
        dependencyPath: [
          "FirstModule",
          "SecondModule",
          "ThirdModule",
          "FirstModule",
        ],
      });
      expect((error as Error).message).toBe(
        "Circular module dependency detected: 'FirstModule' -> 'SecondModule' -> 'ThirdModule' -> 'FirstModule'.",
      );
    }
  });

  it("detects a self dependency", () => {
    class SelfModule implements Module {
      public static get dependencies(): readonly ModuleType[] {
        return [SelfModule];
      }

      public configure(_builder: ModuleBuilder): void {}
    }

    expect(() => planModuleComposition([SelfModule])).toThrow(
      "Circular module dependency detected: 'SelfModule' -> 'SelfModule'.",
    );
  });

  it("uses constructor identity rather than module names", () => {
    const FirstDuplicate = class DuplicateModule implements Module {
      public configure(_builder: ModuleBuilder): void {}
    };
    const SecondDuplicate = class DuplicateModule implements Module {
      public configure(_builder: ModuleBuilder): void {}
    };

    expect(
      planModuleComposition([FirstDuplicate, SecondDuplicate]),
    ).toEqual([FirstDuplicate, SecondDuplicate]);
  });
});

class FeaturelessModule implements Module {
  public configure(_builder: ModuleBuilder): void {}
}
