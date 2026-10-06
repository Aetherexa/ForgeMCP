import {
  ServiceNotFoundError,
  type Configuration,
  type ServiceFactory,
  type ServiceProvider,
  type ServiceResolver,
  type ServiceToken,
} from "@forgemcp/core";

import {
  CircularServiceDependencyError,
  DuplicateServiceRegistrationError,
} from "./service-errors.js";
import type { ServiceRegistration } from "./service-registration.js";
import { ResolvedServiceProvider } from "./resolved-service-provider.js";

/**
 * Collects application service registrations and resolves them for startup.
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
      token: token as ServiceToken<unknown>,
      value,
    });
  }

  public registerFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.registerRegistration({
      kind: "factory",
      token: token as ServiceToken<unknown>,
      factory: factory as ServiceFactory<unknown>,
    });
  }

  public has<TService>(token: ServiceToken<TService>): boolean {
    return this.registrations.has(token.id);
  }

  public getAll(): readonly ServiceRegistration[] {
    return [...this.registrations.values()];
  }

  public async resolve(
    configuration: Configuration,
  ): Promise<ServiceProvider> {
    const engine = new ServiceResolutionEngine(
      this.getAll(),
      configuration,
    );

    return engine.resolveAll();
  }

  private registerRegistration(registration: ServiceRegistration): void {
    if (this.registrations.has(registration.token.id)) {
      throw new DuplicateServiceRegistrationError(registration.token);
    }

    this.registrations.set(registration.token.id, registration);
  }
}

class ServiceResolutionEngine {
  private readonly registrations = new Map<symbol, ServiceRegistration>();
  private readonly resolved = new Map<symbol, unknown>();
  private readonly inFlight = new Map<symbol, Promise<unknown>>();

  public constructor(
    registrations: readonly ServiceRegistration[],
    private readonly configuration: Configuration,
  ) {
    for (const registration of registrations) {
      this.registrations.set(registration.token.id, registration);
    }
  }

  public async resolveAll(): Promise<ServiceProvider> {
    for (const registration of this.registrations.values()) {
      await this.resolveToken(registration.token, []);
    }

    return new ResolvedServiceProvider(this.resolved);
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
    if (!this.registrations.has(token.id)) {
      return undefined;
    }

    return this.resolveToken(token, path);
  }

  private async resolveRequired<TService>(
    token: ServiceToken<TService>,
    path: readonly ServiceToken<unknown>[],
  ): Promise<TService> {
    if (!this.registrations.has(token.id)) {
      throw new ServiceNotFoundError(token);
    }

    return this.resolveToken(token, path);
  }

  private async resolveToken<TService>(
    token: ServiceToken<TService>,
    path: readonly ServiceToken<unknown>[],
  ): Promise<TService> {
    const cycleStart = path.findIndex(
      (current) => current.id === token.id,
    );

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

    const nextPath = [
      ...path,
      token as ServiceToken<unknown>,
    ] as const;

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

  private async construct(
    registration: ServiceRegistration,
    path: readonly ServiceToken<unknown>[],
  ): Promise<unknown> {
    if (registration.kind === "value") {
      return registration.value;
    }

    return registration.factory({
      configuration: this.configuration,
      services: this.createResolver(path),
    });
  }
}
