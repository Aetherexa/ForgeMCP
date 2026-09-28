import type { ExecutionContext, Middleware, Tool } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeModuleBuilder } from "./forge-module-builder.js";

function createTool(name: string): Tool {
  return {
    metadata: { name },
    execute(_context: ExecutionContext, input: unknown) {
      return { value: input };
    },
  };
}

describe("ForgeModuleBuilder", () => {
  it("collects tools in registration order", () => {
    const builder = new ForgeModuleBuilder();

    builder.tool(createTool("first")).tool(createTool("second"));

    expect(builder.getTools().map((tool) => tool.metadata.name)).toEqual([
      "first",
      "second",
    ]);
  });

  it("rejects duplicate tool names during module composition", () => {
    const builder = new ForgeModuleBuilder();

    builder.tool(createTool("echo"));

    expect(() => builder.tool(createTool("echo"))).toThrow(
      "Tool 'echo' is already registered.",
    );
  });

  it("collects middleware in registration order", () => {
    const builder = new ForgeModuleBuilder();

    const first: Middleware = {
      invoke(_context, input, next) {
        return next(input);
      },
    };

    const second: Middleware = {
      invoke(_context, input, next) {
        return next(input);
      },
    };

    builder.middleware(first).middleware(second);

    expect(builder.getMiddleware()).toEqual([first, second]);
  });

  it("returns snapshots instead of exposing mutable internal arrays", () => {
    const builder = new ForgeModuleBuilder();
    const middleware: Middleware = {
      invoke(_context, input, next) {
        return next(input);
      },
    };

    builder.middleware(middleware);

    const firstRead = builder.getMiddleware();
    const secondRead = builder.getMiddleware();

    expect(firstRead).not.toBe(secondRead);
    expect(firstRead).toEqual(secondRead);
  });
});
