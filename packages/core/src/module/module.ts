import type { MaybePromise } from "../types/index.js";
import type { ModuleBuilder } from "./module-builder.js";

/**
 * Represents a ForgeMCP module.
 *
 * Modules contribute tools and middleware to an application during
 * application startup.
 */
export interface Module {
  /**
   * Contributes this module's capabilities to the application.
   */
  configure(builder: ModuleBuilder): MaybePromise<void>;
}

/**
 * Constructor type for modules that can be instantiated by the runtime.
 */
export type ModuleConstructor = new () => Module;
