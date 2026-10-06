import type { ModuleType } from "@forgemcp/core";

import {
  CircularModuleDependencyError,
  MissingModuleDependencyError,
} from "./module-dependency-errors.js";

type VisitState = "visiting" | "visited";

/**
 * Produces a stable dependency-first configuration plan for selected modules.
 *
 * Module selection remains explicit: every dependency must already be present
 * in the selected module set.
 */
export function planModuleComposition(
  modules: readonly ModuleType[],
): readonly ModuleType[] {
  const selected = new Set(modules);
  const states = new Map<ModuleType, VisitState>();
  const result: ModuleType[] = [];
  const path: ModuleType[] = [];

  const visit = (module: ModuleType): void => {
    const state = states.get(module);

    if (state === "visited") {
      return;
    }

    if (state === "visiting") {
      const cycleStart = path.findIndex((current) => current === module);

      throw new CircularModuleDependencyError([
        ...path.slice(cycleStart),
        module,
      ]);
    }

    states.set(module, "visiting");
    path.push(module);

    for (const dependency of module.dependencies ?? []) {
      if (!selected.has(dependency)) {
        throw new MissingModuleDependencyError(module, dependency);
      }

      visit(dependency);
    }

    path.pop();
    states.set(module, "visited");
    result.push(module);
  };

  for (const module of modules) {
    visit(module);
  }

  return result;
}
