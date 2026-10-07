import {
  ServiceNotFoundError,
  type Configuration,
  type ServiceFactory,
  type ServiceLifetime,
  type ServiceProvider,
  type ServiceResolver,
  type ServiceToken,
} from "@forgemcp/core";

import {
  CaptiveServiceDependencyError,
  CircularServiceDependencyError,
  DuplicateServiceRegistrationError,
} from "./service-errors.js";
import { OwnedServiceTracker } from "./owned-service-tracker.js";
import type { ServiceRegistration } from "./service-registration.js";
import { ResolvedServiceProvider } from "./resolved-service-provider.js";
import { ServiceRuntime } from "./service-runtime.js";

/**
 * Collects service registrations and resolves application services for startup.
 */
export class ServiceRegistry {
  private readonly registrations = new Map<symbol, ServiceRegistration>();

  public constructor(registrations: readonly ServiceRegistration[] = []) {
    for (const registration of registrations) {
      this.registerRegistration(registration);
    }
  }

  public registerValue<TService>(
    token: ServiceToken<TService>,
    value: TService,
  ): void {
    this.registerRegistration({
      kind: "value",
      lifetime: "application",
      token: token as ServiceToken<unknown>,
      value,
    });
  }

  public registerFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.registerFactoryWithLifetime(token, factory, "application");
  }

  public registerScopedFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.registerFactoryWithLifetime(token, factory, "execution");
  }

  public registerTransientFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.registerFactoryWithLifetime(token, factory, "transient");
  }

  public has<TService>(token: ServiceToken<TService>): boolean {
    return this.registrations.has(token.id);
  }

  public getAll(): readonly ServiceRegistration[] {
    return [...this.registrations.values()];
  }

  public async resolve(configuration: Configuration): Promise<ServiceProvider> {
    return (await this.resolveRuntime(configuration)).services;
  }

  public async resolveRuntime(
    configuration: Configuration,
  ): Promise<ServiceRuntime> {
    const engine = new ApplicationServiceResolutionEngine(
      this.getAll(),
      configuration,
    );
    try {
      const resolution = await engine.resolveAll();

      return new ServiceRuntime(
        this.getAll(),
        configuration,
        resolution.services,
        resolution.ownedServices,
      );
    } catch (error) {
      try {
        await engine[Symbol.asyncDispose]();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Application service resolution failed and cleanup also failed.",
        );
      }

      throw error;
    }
  }

  private registerFactoryWithLifetime<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
    lifetime: ServiceLifetime,
  ): void {
    this.registerRegistration({
      kind: "factory",
      lifetime,
      token: token as ServiceToken<unknown>,
      factory: factory as ServiceFactory<unknown>,
    });
  }

  private registerRegistration(registration: ServiceRegistration): void {
    if (this.registrations.has(registration.token.id)) {
      throw new DuplicateServiceRegistrationError(registration.token);
    }

    this.registrations.set(registration.token.id, registration);
  }
}

interface ApplicationServiceResolution {
  readonly services: ServiceProvider;
  readonly ownedServices: OwnedServiceTracker;
}

class ApplicationServiceResolutionEngine {
  private readonly registrations = new Map<symbol, ServiceRegistration>();
  private readonly resolved = new Map<symbol, unknown>();
  private readonly inFlight = new Map<symbol, Promise<unknown>>();
  private readonly ownedServices = new OwnedServiceTracker();

  public constructor(
    registrations: readonly ServiceRegistration[],
    private readonly configuration: Configuration,
  ) {
    for (const registration of registrations) {
      this.registrations.set(registration.token.id, registration);
    }
  }

  public [Symbol.asyncDispose](): Promise<void> {
    return this.ownedServices[Symbol.asyncDispose]();
  }

  public async resolveAll(): Promise<ApplicationServiceResolution> {
    for (const registration of this.registrations.values()) {
      if (registration.lifetime === "application") {
        await this.resolveToken(registration.token, []);
      }
    }

    return {
      services: new ResolvedServiceProvider(this.resolved),
      ownedServices: this.ownedServices,
    };
  }

  private createResolver(
    path: readonly ServiceToken<unknown>[],
  ): ServiceResolver {
    return {
      get: <TService>(token: ServiceToken<TService>) =>
        this.resolveOptional(token, path),
      require: <TService>(token: ServiceToken<TService>) =>
        this.resolveRequired(token, path),
    };
  }

  private async resolveOptional<TService>(
    token: ServiceToken<TService>,
    path: readonly ServiceToken<unknown>[],
  ): Promise<TService | undefined> {
    const registration = this.registrations.get(token.id);

    if (registration === undefined) {
      return undefined;
    }

    this.ensureApplicationDependency(registration, path);
    return this.resolveToken(token, path);
  }

  private async resolveRequired<TService>(
    token: ServiceToken<TService>,
    path: readonly ServiceToken<unknown>[],
  ): Promise<TService> {
    const registration = this.registrations.get(token.id);

    if (registration === undefined) {
      throw new ServiceNotFoundError(token);
    }

    this.ensureApplicationDependency(registration, path);
    return this.resolveToken(token, path);
  }

  private async resolveToken<TService>(
    token: ServiceToken<TService>,
    path: readonly ServiceToken<unknown>[],
  ): Promise<TService> {
    const cycleStart = path.findIndex((current) => current.id === token.id);

    if (cycleStart >= 0) {
      throw new CircularServiceDependencyError([
        ...path.slice(cycleStart),
        token as ServiceToken<unknown>,
      ]);
    }

    if (this.resolved.has(token.id)) {
      return this.resolved.get(token.id) as TService;
    }

    const existing = this.inFlight.get(token.id);

    if (existing !== undefined) {
      return (await existing) as TService;
    }

    const registration = this.registrations.get(token.id);

    if (registration === undefined) {
      throw new ServiceNotFoundError(token);
    }

    this.ensureApplicationDependency(registration, path);

    const nextPath = [...path, token as ServiceToken<unknown>] as const;
    const construction = this.construct(registration, nextPath);
    this.inFlight.set(token.id, construction);

    try {
      const value = await construction;
      this.resolved.set(token.id, value);
      return value as TService;
    } finally {
      this.inFlight.delete(token.id);
    }
  }

  private ensureApplicationDependency(
    registration: ServiceRegistration,
    path: readonly ServiceToken<unknown>[],
  ): void {
    if (registration.lifetime === "application") {
      return;
    }

    const consumer = path.at(-1);

    if (consumer !== undefined) {
      throw new CaptiveServiceDependencyError(
        consumer,
        registration.token,
        registration.lifetime,
      );
    }
  }

  private async construct(
    registration: ServiceRegistration,
    path: readonly ServiceToken<unknown>[],
  ): Promise<unknown> {
    if (registration.kind === "value") {
      return registration.value;
    }

    const value = await registration.factory({
      configuration: this.configuration,
      services: this.createResolver(path),
    });

    this.ownedServices.track(registration.token, value);
    return value;
  }
}
