import type {
  ConfigurationSource,
  ConfigurationValues,
} from "@forgemcp/core";

/**
 * Configuration source backed by explicit in-memory values.
 */
export class StaticConfigurationSource implements ConfigurationSource {
  private readonly values: ConfigurationValues;

  public constructor(values: ConfigurationValues) {
    this.values = Object.freeze({ ...values });
  }

  public load(): ConfigurationValues {
    return this.values;
  }
}
