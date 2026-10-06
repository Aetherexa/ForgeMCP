import type { ServiceToken } from "./service-token.js";

/**
 * Read-only access to fully resolved application services.
 */
export interface ServiceProvider {
  /**
   * Returns a resolved service when present.
   */
  get<TService>(token: ServiceToken<TService>): TService | undefined;

  /**
   * Returns a required resolved service.
   *
   * Throws when the token is not registered.
   */
  require<TService>(token: ServiceToken<TService>): TService;
}

/**
 * Asynchronous service resolver used while factories are being constructed.
 *
 * The active lifetime boundary determines which registrations may be resolved.
 */
export interface ServiceResolver {
  /**
   * Resolves a service when registered.
   */
  get<TService>(token: ServiceToken<TService>): Promise<TService | undefined>;

  /**
   * Resolves a required service.
   *
   * Throws when the token is not registered.
   */
  require<TService>(token: ServiceToken<TService>): Promise<TService>;
}
