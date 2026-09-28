import { LifecycleState } from "./lifecycle-state.js";
import type { Startable } from "./startable.js";
import type { Stoppable } from "./stoppable.js";

/**
 * Represents a component with a managed lifecycle.
 */
export interface Lifecycle extends Startable, Stoppable {
  /**
   * Gets the current lifecycle state.
   */
  readonly state: LifecycleState;
}
