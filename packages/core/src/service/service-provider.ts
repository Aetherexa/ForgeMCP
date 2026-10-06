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
 * Asynchronous resolver available while service factories are being built.
 *
 * A resolver may construct dependencies recursively before the final
 * read-only ServiceProvider is exposed to module composition.
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
