import type { ServiceToken } from "./service-token.js";

/**
 * Read-only access to resolved application services.
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
