import type {
  ConfigurationSource,
  ConfigurationValues,
} from "../configuration/index.js";
import type { ModuleType } from "../module/index.js";
import type { MaybePromise } from "../types/maybe-promise.js";
import type { Application } from "./application.js";

export interface ApplicationBuilder {
  use(module: ModuleType): this;

  configure(values: ConfigurationValues): this;

  configureFrom(source: ConfigurationSource): this;

  build(): MaybePromise<Application>;
}
