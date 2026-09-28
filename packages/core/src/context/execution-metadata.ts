import type { Dictionary } from "../types/index.js";

/**
 * Metadata associated with a single execution.
 */
export interface ExecutionMetadata {
  /**
   * Unique identifier for this execution.
   */
  readonly id: string;

  /**
   * UTC timestamp when execution started.
   */
  readonly startedAt: Date;

  /**
   * Arbitrary metadata contributed by transports,
   * middleware, or plugins.
   */
  readonly attributes: Readonly<Dictionary<unknown>>;
}
