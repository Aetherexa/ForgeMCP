/**
 * Normalizes a configuration key into its canonical form.
 *
 * Canonical keys are lowercase dot-separated path segments.
 */
export function normalizeConfigurationKey(key: string): string {
  const segments = key
    .trim()
    .split(".")
    .map((segment) => segment.trim().toLowerCase());

  if (
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0)
  ) {
    throw new Error(
      `Configuration key '${key}' is invalid. Keys must contain non-empty dot-separated segments.`,
    );
  }

  return segments.join(".");
}
