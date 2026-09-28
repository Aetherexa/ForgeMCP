/**
 * Describes a tool.
 */
export interface ToolMetadata {
  /**
   * Unique tool name.
   */
  readonly name: string;

  /**
   * Human-readable description.
   */
  readonly description?: string;

  /**
   * Tool version.
   */
  readonly version?: string;

  /**
   * Optional tags for discovery.
   */
  readonly tags?: readonly string[];
}
