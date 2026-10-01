import type { MaybePromise } from "../types/index.js";
import type { ConfigurationValues } from "./configuration.js";

/**
 * Produces application configuration values.
 *
 * Sources are resolved in registration order. Later sources may override
 * values produced by earlier sources.
 */
export interface ConfigurationSource {
  load(): MaybePromise<ConfigurationValues>;
}
