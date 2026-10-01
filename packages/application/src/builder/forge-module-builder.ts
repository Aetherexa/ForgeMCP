import type {
  Configuration,
  Middleware,
  ModuleBuilder,
  Tool,
} from "@forgemcp/core";

import { ForgeConfiguration } from "../configuration/forge-configuration.js";
import { ToolRegistry } from "../registry/tool-registry.js";

/**
 * Default collector for contributions made by application modules.
 */
export class ForgeModuleBuilder implements ModuleBuilder {
  private readonly tools = new ToolRegistry();
  private readonly registeredMiddleware: Middleware[] = [];

  public constructor(
    public readonly configuration: Configuration = new ForgeConfiguration(),
  ) {}

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
