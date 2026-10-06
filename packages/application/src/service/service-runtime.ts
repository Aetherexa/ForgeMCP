import {
  ServiceNotFoundError,
  type Configuration,
  type ServiceProvider,
  type ServiceResolver,
  type ServiceToken,
} from "@forgemcp/core";

import { CircularServiceDependencyError } from "./service-errors.js";
import type { ServiceRegistration } from "./service-registration.js";

/**
 * Resolved application services plus the registrations required to create
 * isolated execution scopes.
 */
export class ServiceRuntime {
  private readonly registrations = new Map<symbol, ServiceRegistration>();

  public constructor(
    registrations: readonly ServiceRegistration[],
    private readonly configuration: Configuration,
    public readonly services: ServiceProvider,
  ) {
    for (const registration of registrations) {
      this.registrations.set(registration.token.id, registration);
    }
  }

  /**
   * Creates an independent resolver for one execution boundary.
   */
  public createScope(): ServiceResolver {
    return new ExecutionServiceScope(
      this.registrations,
      this.configuration,
      this.services,
    );
  }
}

class ExecutionServiceScope implements ServiceResolver {
  private readonly resolved = new Map<symbol, unknown>();
  private readonly inFlight = new Map<symbol, Promise<unknown>>();

  public constructor(
    private readonly registrations: ReadonlyMap<symbol, ServiceRegistration>,
    private readonly configuration: Configuration,
    private readonly applicationServices: ServiceProvider,
  ) {}

  public async get<TService>(
    token: ServiceToken<TService>,
  ): Promise<TService | undefined> {
    if (!this.registrations.has(token.id)) {
      return undefined;
    }

    return this.resolveToken(token, []);
  }

  public async require<TService>(
    token: ServiceToken<TService>,
  ): Promise<TService> {
    if (!this.registrations.has(token.id)) {
      throw new ServiceNotFoundError(token);
    }

    return this.resolveToken(token, []);
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
    const cycleStart = path.findIndex((current) => current.id === token.id);

    if (cycleStart >= 0) {
      throw new CircularServiceDependencyError([
        ...path.slice(cycleStart),
        token as ServiceToken<unknown>,
      ]);
    }

    const registration = this.registrations.get(token.id);

    if (registration === undefined) {
      throw new ServiceNotFoundError(token);
    }

    if (registration.lifetime === "application") {
      return this.applicationServices.require(token);
    }

    const nextPath = [...path, token as ServiceToken<unknown>] as const;

    if (registration.lifetime === "transient") {
      return (await this.construct(registration, nextPath)) as TService;
    }

    if (this.resolved.has(token.id)) {
      return this.resolved.get(token.id) as TService;
    }

    const existing = this.inFlight.get(token.id);

    if (existing !== undefined) {
      return (await existing) as TService;
    }

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
