import type {
  Application,
  ApplicationBuilder,
  ModuleType,
} from "@forgemcp/core";

import { ModuleRegistry } from "../registry/module-registry.js";
import { ForgeApplication } from "../runtime/forge-application.js";

/**
 * Default implementation of the Forge application builder.
 */
export class ForgeApplicationBuilder implements ApplicationBuilder {
  private readonly modules = new ModuleRegistry();

  /**
   * Prevent direct instantiation.
   */
  private constructor() {}

  /**
   * Creates a new application builder.
   */
  public static create(): ForgeApplicationBuilder {
    return new ForgeApplicationBuilder();
  }

  /**
   * Registers a module.
   */
  public use(module: ModuleType): this {
    if (this.modules.has(module)) {
      throw new Error(
        `Module '${module.name}' is already registered.`,
      );
    }

    this.modules.register(module);

    return this;
  }

  /**
   * Builds the application.
   */
  public build(): Application {
    return new ForgeApplication(this.modules.getAll());
  }
}
