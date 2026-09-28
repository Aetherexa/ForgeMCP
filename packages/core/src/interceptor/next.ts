import type { ToolResult } from "../tool/tool-result.js";
import type { MaybePromise } from "../types/maybe-promise.js";

/**
 * Represents the next delegate in the execution pipeline.
 */
export type Next<TInput = unknown, TResult = unknown> = (
  input: TInput,
) => MaybePromise<ToolResult<TResult>>;
