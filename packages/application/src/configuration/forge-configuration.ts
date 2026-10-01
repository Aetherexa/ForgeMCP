import {
  ConfigurationKeyNotFoundError,
  type Configuration,
  type ConfigurationValues,
  normalizeConfigurationKey,
} from "@forgemcp/core";

/**
 * Immutable resolved application configuration.
 */
export class ForgeConfiguration implements Configuration {
  private readonly values: ConfigurationValues;

  public constructor(values: ConfigurationValues = {}) {
    this.values = Object.freeze(normalizeValues(values));
  }

  public get(key: string): string | undefined {
    return this.values[normalizeConfigurationKey(key)];
  }

  public require(key: string): string {
    const normalizedKey = normalizeConfigurationKey(key);
    const value = this.values[normalizedKey];

    if (value === undefined) {
      throw new ConfigurationKeyNotFoundError(normalizedKey);
    }

    return value;
  }

  public has(key: string): boolean {
    return Object.hasOwn(this.values, normalizeConfigurationKey(key));
  }

  public toObject(): ConfigurationValues {
    return Object.freeze({ ...this.values });
  }
}

function normalizeValues(values: ConfigurationValues): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    const normalizedKey = normalizeConfigurationKey(key);

    if (Object.hasOwn(normalized, normalizedKey)) {
      throw new Error(
        `Configuration contains duplicate normalized key '${normalizedKey}'.`,
      );
    }

    normalized[normalizedKey] = value;
  }

  return normalized;
}
