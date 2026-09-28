import type { ExecutionMetadata } from "./execution-metadata.js";

/**
 * Represents a single execution within the Forge runtime.
 */
export interface ExecutionContext {
  /**
   * Information about the current execution.
   */
  readonly execution: ExecutionMetadata;
}
