import type { ExecutionContext } from "../context/execution-context.js";
import type { MaybePromise } from "../types/maybe-promise.js";
import type { ToolMetadata } from "./tool-metadata.js";
import type { ToolResult } from "./tool-result.js";

/**
 * Represents executable business capability.
 */
export interface Tool<TInput = unknown, TResult = unknown> {
  /**
   * Tool metadata.
   */
  readonly metadata: ToolMetadata;

  /**
   * Executes the tool.
   */
  execute(
    context: ExecutionContext,
    input: TInput,
  ): MaybePromise<ToolResult<TResult>>;
}
