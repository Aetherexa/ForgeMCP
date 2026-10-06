import type { ServiceFactory, ServiceToken } from "@forgemcp/core";

export interface ValueServiceRegistration {
  readonly kind: "value";
  readonly token: ServiceToken<unknown>;
  readonly value: unknown;
}

export interface FactoryServiceRegistration {
  readonly kind: "factory";
  readonly token: ServiceToken<unknown>;
  readonly factory: ServiceFactory<unknown>;
}

export type ServiceRegistration =
  | ValueServiceRegistration
  | FactoryServiceRegistration;
