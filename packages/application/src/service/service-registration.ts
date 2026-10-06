import type {
  ServiceFactory,
  ServiceLifetime,
  ServiceToken,
} from "@forgemcp/core";

export interface ValueServiceRegistration {
  readonly kind: "value";
  readonly lifetime: "application";
  readonly token: ServiceToken<unknown>;
  readonly value: unknown;
}

export interface FactoryServiceRegistration {
  readonly kind: "factory";
  readonly lifetime: ServiceLifetime;
  readonly token: ServiceToken<unknown>;
  readonly factory: ServiceFactory<unknown>;
}

export type ServiceRegistration =
  ValueServiceRegistration | FactoryServiceRegistration;
