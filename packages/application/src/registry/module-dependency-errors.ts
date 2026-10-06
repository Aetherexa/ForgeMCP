import type { ModuleType } from "@forgemcp/core";

/**
 * Raised when a selected module requires a module that was not selected.
 */
export class MissingModuleDependencyError extends Error {
  public readonly dependentModuleName: string;
  public readonly missingModuleName: string;

  public constructor(dependent: ModuleType, missing: ModuleType) {
    super(
      `Module '${dependent.name}' requires module '${missing.name}', but it is not registered.`,
    );

    this.name = "MissingModuleDependencyError";
    this.dependentModuleName = dependent.name;
    this.missingModuleName = missing.name;
  }
}

/**
 * Raised when selected modules form a circular dependency path.
 */
export class CircularModuleDependencyError extends Error {
  public readonly dependencyPath: readonly string[];

  public constructor(path: readonly ModuleType[]) {
    const dependencyPath = path.map((module) => module.name);

    super(
      `Circular module dependency detected: ${dependencyPath
        .map((name) => `'${name}'`)
        .join(" -> ")}.`,
    );

    this.name = "CircularModuleDependencyError";
    this.dependencyPath = Object.freeze([...dependencyPath]);
  }
}
