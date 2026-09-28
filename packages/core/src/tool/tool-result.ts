/**
 * Represents the result produced by a tool.
 */
export interface ToolResult<TResult = unknown> {
  readonly value: TResult;
}
