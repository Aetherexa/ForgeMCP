import type { Application, MaybePromise } from "@forgemcp/core";

/**
 * Options used to create an MCP server backed by a ForgeMCP application.
 */
export interface ForgeMcpServerOptions {
  /**
   * MCP implementation name advertised to clients.
   */
  readonly name: string;

  /**
   * MCP implementation version advertised to clients.
   */
  readonly version: string;

  /**
   * Optional human-readable server description.
   */
  readonly description?: string;

  /**
   * Creates a fresh ForgeMCP application for one MCP server instance.
   */
  /** Opt in to copying string W3C context fields from request _meta. */
  readonly captureTraceContext?: boolean;

  readonly createApplication: () => MaybePromise<Application>;
}
