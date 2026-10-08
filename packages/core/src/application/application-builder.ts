import type {
  ConfigurationSource,
  ConfigurationValues,
} from "../configuration/index.js";
import type { DiagnosticListener } from "../diagnostics/index.js";
import type { ModuleType } from "../module/index.js";
import type { ServiceFactory, ServiceToken } from "../service/index.js";
import type { MaybePromise } from "../types/maybe-promise.js";
import type { Application } from "./application.js";

export interface ApplicationBuilder {
  use(module: ModuleType): this;

  configure(values: ConfigurationValues): this;

  configureFrom(source: ConfigurationSource): this;

  observe(listener: DiagnosticListener): this;

  provide<TService>(token: ServiceToken<TService>, value: TService): this;

  provideFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this;

  provideScopedFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this;

  provideTransientFactory<TService>(
    token: ServiceToken<TService>,
    factory: ServiceFactory<TService>,
  ): this;

  build(): MaybePromise<Application>;
}
