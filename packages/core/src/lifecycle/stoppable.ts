import type { MaybePromise } from "../types/index.js";

/**
 * Represents a component that can be stopped.
 */
export interface Stoppable {
  stop(): MaybePromise<void>;
}
