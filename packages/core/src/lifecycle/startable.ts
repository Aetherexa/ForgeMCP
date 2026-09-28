import type { MaybePromise } from "../types/index.js";

/**
 * Represents a component that can be started.
 */
export interface Startable {
  start(): MaybePromise<void>;
}
