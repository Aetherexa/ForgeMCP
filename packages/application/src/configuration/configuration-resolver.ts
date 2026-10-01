import {
  type Configuration,
  type ConfigurationSource,
  normalizeConfigurationKey,
} from "@forgemcp/core";

import { ForgeConfiguration } from "./forge-configuration.js";

/**
 * Resolves configuration sources in registration order.
 *
 * Later sources override earlier sources.
 */
export async function resolveConfiguration(
  sources: readonly ConfigurationSource[],
): Promise<Configuration> {
  const resolved: Record<string, string> = {};

  for (const source of sources) {
    const values = await source.load();
    const sourceKeys = new Set<string>();

    for (const [key, value] of Object.entries(values)) {
      const normalizedKey = normalizeConfigurationKey(key);

      if (sourceKeys.has(normalizedKey)) {
        throw new Error(
          `Configuration source produced duplicate normalized key '${normalizedKey}'.`,
        );
      }

      sourceKeys.add(normalizedKey);
      resolved[normalizedKey] = value;
    }
  }

  return new ForgeConfiguration(resolved);
}
