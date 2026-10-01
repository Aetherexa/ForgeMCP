import type {
  Application,
  ApplicationBuilder,
  ConfigurationSource,
  ConfigurationValues,
  ModuleType,
} from "@forgemcp/core";

import { StaticConfigurationSource } from "../configuration/static-configuration-source.js";
import { ModuleRegistry } from "../registry/module-registry.js";
import { ForgeApplication } from "../runtime/forge-application.js";

/**
 * Default implementation of the Forge application builder.
 */
export class ForgeApplicationBuilder implements ApplicationBuilder {
  private readonly modules = new ModuleRegistry();
  private readonly configurationSources: ConfigurationSource[] = [];

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
      throw new Error(`Module '${module.name}' is already registered.`);
    }

    this.modules.register(module);

    return this;
  }

  /**
   * Adds explicit configuration values.
   *
   * Values are captured when they are registered so later caller mutation
   * cannot change application startup behavior.
   */
  public configure(values: ConfigurationValues): this {
    this.configurationSources.push(new StaticConfigurationSource(values));
    return this;
  }

  /**
   * Adds a configuration source.
   *
   * Sources are resolved in registration order. Later sources override
   * earlier sources.
   */
  public configureFrom(source: ConfigurationSource): this {
    this.configurationSources.push(source);
    return this;
  }

  /**
   * Builds the application.
   */
  public build(): Application {
    return new ForgeApplication(this.modules.getAll(), [
      ...this.configurationSources,
    ]);
  }
}
