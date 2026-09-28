import type { ExecutionContext, Tool } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ToolRegistry } from "./tool-registry.js";

function createTool(name: string): Tool {
  return {
    metadata: { name },
    execute(_context: ExecutionContext, input: unknown) {
      return { value: input };
    },
  };
}

describe("ToolRegistry", () => {
  it("registers and resolves tools by name", () => {
    const registry = new ToolRegistry();
    const tool = createTool("echo");

    registry.register(tool);

    expect(registry.size).toBe(1);
    expect(registry.has("echo")).toBe(true);
    expect(registry.get("echo")).toBe(tool);
    expect(registry.require("echo")).toBe(tool);
  });

  it("preserves registration order", () => {
    const registry = new ToolRegistry();

    registry.register(createTool("first"));
    registry.register(createTool("second"));

    expect(registry.getAll().map((tool) => tool.metadata.name)).toEqual([
      "first",
      "second",
    ]);
  });

  it("rejects empty tool names", () => {
    const registry = new ToolRegistry();

    expect(() => registry.register(createTool("   "))).toThrow(
      "Tool name must not be empty.",
    );
  });

  it("rejects duplicate tool names", () => {
    const registry = new ToolRegistry();

    registry.register(createTool("echo"));

    expect(() => registry.register(createTool("echo"))).toThrow(
      "Tool 'echo' is already registered.",
    );
  });

  it("throws when requiring an unknown tool", () => {
    const registry = new ToolRegistry();

    expect(() => registry.require("missing")).toThrow(
      "Tool 'missing' is not registered.",
    );
  });

  it("clears all registered tools", () => {
    const registry = new ToolRegistry();

    registry.register(createTool("echo"));
    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });
});
