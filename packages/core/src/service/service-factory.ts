import type { Configuration } from "../configuration/index.js";
import type { MaybePromise } from "../types/index.js";
import type { ServiceResolver } from "./service-provider.js";

/**
 * Inputs available while constructing a service.
 */
export interface ServiceFactoryContext {
  /**
   * Resolved application configuration.
   */
  readonly configuration: Configuration;

  /**
   * Access to dependencies valid for the current service lifetime.
   */
  readonly services: ServiceResolver;
}

/**
 * Constructs a service instance.
 */
export type ServiceFactory<TService> = (
  context: ServiceFactoryContext,
) => MaybePromise<TService>;
