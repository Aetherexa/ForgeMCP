import {
  ServiceNotFoundError,
  type ServiceProvider,
  type ServiceToken,
} from "@forgemcp/core";

/**
 * Immutable read-only view of resolved application services.
 */
export class ResolvedServiceProvider implements ServiceProvider {
  private readonly values: ReadonlyMap<symbol, unknown>;

  public constructor(values: ReadonlyMap<symbol, unknown> = new Map()) {
    this.values = new Map(values);
  }

  public get<TService>(token: ServiceToken<TService>): TService | undefined {
    return this.values.get(token.id) as TService | undefined;
  }

  public require<TService>(token: ServiceToken<TService>): TService {
    if (!this.values.has(token.id)) {
      throw new ServiceNotFoundError(token);
    }

    return this.values.get(token.id) as TService;
  }
}
