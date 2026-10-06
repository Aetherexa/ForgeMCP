import type { ServiceLifetime, ServiceToken } from "@forgemcp/core";

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

/**
 * Raised when an application-lifetime service captures a shorter-lived service.
 */
export class CaptiveServiceDependencyError extends Error {
  public readonly consumerDescription: string;
  public readonly dependencyDescription: string;
  public readonly dependencyLifetime: ServiceLifetime;

  public constructor(
    consumer: ServiceToken<unknown>,
    dependency: ServiceToken<unknown>,
    dependencyLifetime: ServiceLifetime,
  ) {
    super(
      `Application service '${consumer.description}' cannot depend on ${dependencyLifetime} service '${dependency.description}'.`,
    );

    this.name = "CaptiveServiceDependencyError";
    this.consumerDescription = consumer.description;
    this.dependencyDescription = dependency.description;
    this.dependencyLifetime = dependencyLifetime;
  }
}
