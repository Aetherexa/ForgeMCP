import type { Middleware } from "../interceptor/index.js";
import type { Tool } from "../tool/tool.js";

/**
 * Collects contributions made by a module.
 */
export interface ModuleBuilder {
  /**
   * Registers a tool.
   */
  tool(tool: Tool): this;

  /**
   * Registers middleware.
   */
  middleware(middleware: Middleware): this;
}
