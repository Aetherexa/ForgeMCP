import type { Lifecycle } from "../lifecycle/lifecycle.js";
import type { ToolMetadata } from "../tool/tool-metadata.js";
import type { ToolResult } from "../tool/tool-result.js";
import type { Dictionary } from "../types/dictionary.js";

/**
 * Represents a running Forge application.
 */
export interface Application extends Lifecycle {
  /**
   * Returns the tools exposed by the running application.
   */
  listTools(): readonly ToolMetadata[];

  /**
   * Executes a registered tool through the application pipeline.
   */
  execute<TInput = unknown, TResult = unknown>(
    toolName: string,
    input: TInput,
    attributes?: Readonly<Dictionary<unknown>>,
  ): Promise<ToolResult<TResult>>;
}
