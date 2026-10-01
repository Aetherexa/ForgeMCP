/**
 * Immutable string configuration values keyed by canonical configuration keys.
 */
export type ConfigurationValues = Readonly<Record<string, string>>;

/**
 * Read-only application configuration.
 */
export interface Configuration {
  /**
   * Returns a configuration value when present.
   */
  get(key: string): string | undefined;

  /**
   * Returns a required configuration value.
   *
   * Throws when the key is missing.
   */
  require(key: string): string;

  /**
   * Determines whether a configuration key exists.
   */
  has(key: string): boolean;

  /**
   * Returns an immutable snapshot of all resolved values.
   */
  toObject(): ConfigurationValues;
}
