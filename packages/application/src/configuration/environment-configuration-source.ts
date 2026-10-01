import {
  type ConfigurationSource,
  type ConfigurationValues,
  normalizeConfigurationKey,
} from "@forgemcp/core";

export interface EnvironmentConfigurationSourceOptions {
  /**
   * Prefix used to select environment variables, for example `MYAPP_`.
   */
  readonly prefix: string;

  /**
   * Segment separator used after the prefix. Defaults to `__`.
   */
  readonly separator?: string;

  /**
   * Environment dictionary used for loading. Defaults to `process.env`.
   *
   * Supplying this value makes tests deterministic.
   */
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

/**
 * Maps environment variables into canonical ForgeMCP configuration keys.
 *
 * Example:
 * `MYAPP_DATABASE__URL` with prefix `MYAPP_` becomes `database.url`.
 */
export class EnvironmentConfigurationSource implements ConfigurationSource {
  private readonly prefix: string;
  private readonly separator: string;
  private readonly environment: Readonly<Record<string, string | undefined>>;

  public constructor(options: EnvironmentConfigurationSourceOptions) {
    if (options.prefix.length === 0) {
      throw new Error("Environment configuration prefix must not be empty.");
    }

    const separator = options.separator ?? "__";

    if (separator.length === 0) {
      throw new Error("Environment configuration separator must not be empty.");
    }

    this.prefix = options.prefix;
    this.separator = separator;
    this.environment = options.environment ?? process.env;
  }

  public load(): ConfigurationValues {
    const values: Record<string, string> = {};
    const normalizedKeys = new Set<string>();

    for (const name of Object.keys(this.environment).sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (!name.startsWith(this.prefix)) {
        continue;
      }

      const value = this.environment[name];

      if (value === undefined) {
        continue;
      }

      const rawKey = name.slice(this.prefix.length);

      if (rawKey.length === 0) {
        continue;
      }

      const normalizedKey = normalizeConfigurationKey(
        rawKey.split(this.separator).join("."),
      );

      if (normalizedKeys.has(normalizedKey)) {
        throw new Error(
          `Environment variables contain duplicate normalized key '${normalizedKey}'.`,
        );
      }

      normalizedKeys.add(normalizedKey);
      values[normalizedKey] = value;
    }

    return Object.freeze(values);
  }
}
