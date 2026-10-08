import type {
  Application,
  ApplicationBuilder,
  ConfigurationSource,
  ConfigurationValues,
  type DiagnosticListener,
  ModuleType,
  ServiceFactory,
  ServiceToken,
} from "@forgemcp/core";

import { StaticConfigurationSource } from "../configuration/static-configuration-source.js";
import { ModuleRegistry } from "../registry/module-registry.js";
import { ForgeApplication } from "../runtime/forge-application.js";
import { ServiceRegistry } from "../service/service-registry.js";

/**
 * Default implementation of the Forge application builder.
 */
export class ForgeApplicationBuilder implements ApplicationBuilder {
  private readonly modules = new ModuleRegistry();
  private readonly configurationSources: ConfigurationSource[] = [];
  private readonly services = new ServiceRegistry();
  private readonly diagnosticListeners: DiagnosticListener[] = [];

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
   * Registers a diagnostic listener for this application.
   */
  public observe(listener: DiagnosticListener): this {
    this.diagnosticListeners.push(listener);
    return this;
  }

  /**
   * Registers an already-created application service.
   */
  public provide<TService>(
    token: ServiceToken<TService>,
    value: TService,
  ): this {
    this.services.registerValue(token, value);
    return this;
  }

  /**
   * Registers a factory used to construct one application service instance.
   */
  public provideFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this {
    this.services.registerFactory(token, factory);
    return this;
  }

  /**
   * Registers a factory resolved once for each execution scope.
   */
  public provideScopedFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this {
    this.services.registerScopedFactory(token, factory);
    return this;
  }

  /**
   * Registers a factory resolved for every request inside an execution scope.
   */
  public provideTransientFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this {
    this.services.registerTransientFactory(token, factory);
    return this;
  }

  /**
   * Builds the application.
   */
  public build(): Application {
    return new ForgeApplication(
      this.modules.getAll(),
      [...this.configurationSources],
      this.services.getAll(),
      [...this.diagnosticListeners],
    );
  }
}
