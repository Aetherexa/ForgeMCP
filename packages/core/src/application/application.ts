import type { Dictionary } from "../types/dictionary.js";
import type { Lifecycle } from "../lifecycle/lifecycle.js";
import type { ToolResult } from "../tool/tool-result.js";

/**
 * Represents a running Forge application.
 */
export interface Application extends Lifecycle {
  /**
   * Executes a registered tool through the application pipeline.
   */
  execute<TInput = unknown, TResult = unknown>(
    toolName: string,
    input: TInput,
    attributes?: Readonly<Dictionary<unknown>>,
  ): Promise<ToolResult<TResult>>;
}
