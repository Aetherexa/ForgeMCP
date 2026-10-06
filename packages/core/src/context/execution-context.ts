import type { ServiceResolver } from "../service/index.js";
import type { ExecutionMetadata } from "./execution-metadata.js";

/**
 * Represents a single execution within the Forge runtime.
 */
export interface ExecutionContext {
  /**
   * Information about the current execution.
   */
  readonly execution: ExecutionMetadata;

  /**
   * Service resolver scoped to the current execution.
   */
  readonly services: ServiceResolver;
}
