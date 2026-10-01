import { normalizeConfigurationKey } from "./configuration-key.js";

/**
 * Raised when required application configuration is missing.
 */
export class ConfigurationKeyNotFoundError extends Error {
  public readonly key: string;

  public constructor(key: string) {
    const normalizedKey = normalizeConfigurationKey(key);

    super(
      `Configuration key '${normalizedKey}' is required but was not provided.`,
    );

    this.name = "ConfigurationKeyNotFoundError";
    this.key = normalizedKey;
  }
}
