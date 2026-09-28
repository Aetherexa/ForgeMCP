import type { Middleware, ModuleBuilder, Tool } from "@forgemcp/core";

import { ToolRegistry } from "../registry/tool-registry.js";

/**
 * Default collector for contributions made by application modules.
 */
export class ForgeModuleBuilder implements ModuleBuilder {
  private readonly tools = new ToolRegistry();
  private readonly registeredMiddleware: Middleware[] = [];

  /**
   * Registers a tool contribution.
   */
  public tool(tool: Tool): this {
    this.tools.register(tool);
    return this;
  }

  /**
   * Registers a middleware contribution.
   */
  public middleware(middleware: Middleware): this {
    this.registeredMiddleware.push(middleware);
    return this;
  }

  /**
   * Returns the tools contributed by configured modules.
   */
  public getTools(): readonly Tool[] {
    return this.tools.getAll();
  }

  /**
   * Returns the middleware contributed by configured modules.
   */
  public getMiddleware(): readonly Middleware[] {
    return [...this.registeredMiddleware];
  }
}
