import type { ExecutionContext } from "../context/index.js";
import type { ToolResult } from "../tool/tool-result.js";
import type { MaybePromise } from "../types/index.js";

/**
 * Represents an executable middleware pipeline.
 */
export interface MiddlewarePipeline<TInput = unknown, TResult = unknown> {
  execute(context: ExecutionContext, input: TInput): MaybePromise<ToolResult<TResult>>;
}
