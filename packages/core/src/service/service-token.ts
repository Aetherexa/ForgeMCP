declare const serviceTokenType: unique symbol;

/**
 * Opaque typed identifier for an application service.
 *
 * Tokens compare by identity, not by description.
 */
export interface ServiceToken<TService> {
  /**
   * Human-readable token description used for diagnostics.
   */
  readonly description: string;

  /**
   * Runtime identity for this token.
   */
  readonly id: symbol;

  /**
   * Compile-time type marker.
   */
  readonly [serviceTokenType]?: TService;
}

/**
 * Creates a unique typed service token.
 */
export function createServiceToken<TService>(
  description: string,
): ServiceToken<TService> {
  const normalizedDescription = description.trim();

  if (normalizedDescription.length === 0) {
    throw new Error("Service token description must not be empty.");
  }

  return Object.freeze({
    description: normalizedDescription,
    id: Symbol(normalizedDescription),
  }) as ServiceToken<TService>;
}
