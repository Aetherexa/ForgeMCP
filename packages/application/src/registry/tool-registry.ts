import type { Tool } from "@forgemcp/core";

/**
 * Maintains the tools available to a Forge application.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Registers a tool.
   *
   * Tool names must be non-empty and unique within an application.
   */
  public register(tool: Tool): void {
    const name = tool.metadata.name.trim();

    if (name.length === 0) {
      throw new Error("Tool name must not be empty.");
    }

    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered.`);
    }

    this.tools.set(name, tool);
  }

  /**
   * Determines whether a tool is registered.
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Gets a registered tool when present.
   */
  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Gets a registered tool or throws when the name is unknown.
   */
  public require(name: string): Tool {
    const tool = this.tools.get(name);

    if (tool === undefined) {
      throw new Error(`Tool '${name}' is not registered.`);
    }

    return tool;
  }

  /**
   * Returns all registered tools in registration order.
   */
  public getAll(): readonly Tool[] {
    return [...this.tools.values()];
  }

  /**
   * Number of registered tools.
   */
  public get size(): number {
    return this.tools.size;
  }

  /**
   * Removes every registered tool.
   */
  public clear(): void {
    this.tools.clear();
  }
}
