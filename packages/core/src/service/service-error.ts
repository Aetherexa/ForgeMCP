import type { ServiceToken } from "./service-token.js";

/**
 * Raised when a required application service is unavailable.
 */
export class ServiceNotFoundError extends Error {
  public readonly tokenDescription: string;

  public constructor(token: ServiceToken<unknown>) {
    super(`Service '${token.description}' is required but was not registered.`);

    this.name = "ServiceNotFoundError";
    this.tokenDescription = token.description;
  }
}
