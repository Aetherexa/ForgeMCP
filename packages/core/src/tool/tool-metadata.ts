import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "@standard-schema/spec";

/**
 * Schema contract used by ForgeMCP tools.
 *
 * Any schema library implementing both Standard Schema and Standard JSON Schema
 * can be used, including Zod, ArkType, and compatible Valibot schemas.
 */
export type ToolInputSchema<TInput = unknown> = StandardSchemaV1<
  TInput,
  TInput
> &
  StandardJSONSchemaV1<TInput, TInput>;

/**
 * Describes a tool.
 */
export interface ToolMetadata<TInput = unknown> {
  /**
   * Unique tool name.
   */
  readonly name: string;

  /**
   * Human-readable description.
   */
  readonly description?: string;

  /**
   * Optional schema used to validate and describe tool input.
   */
  readonly inputSchema?: ToolInputSchema<TInput>;

  /**
   * Tool version.
   */
  readonly version?: string;

  /**
   * Optional tags for discovery.
   */
  readonly tags?: readonly string[];
}
