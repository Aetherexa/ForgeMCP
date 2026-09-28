import type { ExecutionContext } from "../context/execution-context.js";
import type { ToolResult } from "../tool/tool-result.js";
import type { MaybePromise } from "../types/maybe-promise.js";
import type { Next } from "./next.js";

/**
 * Represents a middleware component in the execution pipeline.
 *
 * Middleware can inspect, transform, or short-circuit a request before
 * passing control to the next middleware or the target tool.
 */
export interface Middleware<TInput = unknown, TResult = unknown> {
  /**
   * Invokes the middleware.
   *
   * @param context The current execution context.
   * @param input The current input value.
   * @param next Delegate that invokes the next middleware in the pipeline.
   */
  invoke(
    context: ExecutionContext,
    input: TInput,
    next: Next<TInput, TResult>,
  ): MaybePromise<ToolResult<TResult>>;
}
