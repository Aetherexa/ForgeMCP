import type { ModuleConstructor } from "./module.js";

/**
 * Represents a module class that can be instantiated by the runtime.
 *
 * Dependencies are explicit static metadata. Declaring a dependency does not
 * register it with an application.
 */
export type ModuleType = ModuleConstructor & {
  readonly dependencies?: readonly ModuleType[];
};
