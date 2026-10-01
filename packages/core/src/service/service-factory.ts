import type { Configuration } from "../configuration/index.js";
import type { MaybePromise } from "../types/index.js";
import type { ServiceProvider } from "./service-provider.js";

/**
 * Inputs available while constructing an application service.
 */
export interface ServiceFactoryContext {
  /**
   * Resolved application configuration.
   */
  readonly configuration: Configuration;

  /**
   * Access to other application services.
   */
  readonly services: ServiceProvider;
}

/**
 * Constructs an application service.
 */
export type ServiceFactory<TService> = (
  context: ServiceFactoryContext,
) => MaybePromise<TService>;
