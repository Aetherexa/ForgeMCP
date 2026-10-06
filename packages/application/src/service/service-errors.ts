import type { ServiceToken } from "@forgemcp/core";

/**
 * Raised when the same service token is registered more than once.
 */
export class DuplicateServiceRegistrationError extends Error {
  public readonly tokenDescription: string;

  public constructor(token: ServiceToken<unknown>) {
    super(`Service '${token.description}' is already registered.`);

    this.name = "DuplicateServiceRegistrationError";
    this.tokenDescription = token.description;
  }
}

/**
 * Raised when service factories form a dependency cycle.
 */
export class CircularServiceDependencyError extends Error {
  public readonly dependencyPath: readonly string[];

  public constructor(tokens: readonly ServiceToken<unknown>[]) {
    const dependencyPath = tokens.map((token) => token.description);

    super(
      `Circular service dependency detected: ${dependencyPath
        .map((description) => `'${description}'`)
        .join(" -> ")}.`,
    );

    this.name = "CircularServiceDependencyError";
    this.dependencyPath = Object.freeze([...dependencyPath]);
  }
}
