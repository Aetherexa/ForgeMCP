import type {
  ExecutionContext,
  Middleware,
  ToolResult,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeMiddlewarePipeline } from "./forge-middleware-pipeline.js";

const context: ExecutionContext = {
  execution: {
    id: "test-execution",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    attributes: {},
  },
};

describe("ForgeMiddlewarePipeline", () => {
  it("invokes middleware in registration order", async () => {
    const calls: string[] = [];

    const first: Middleware<string, string> = {
      async invoke(_executionContext, input, next) {
        calls.push("first:before");
        const result = await next(`${input}:first`);
        calls.push("first:after");
        return result;
      },
    };

    const second: Middleware<string, string> = {
      async invoke(_executionContext, input, next) {
        calls.push("second:before");
        const result = await next(`${input}:second`);
        calls.push("second:after");
        return result;
      },
    };

    const pipeline = new ForgeMiddlewarePipeline(
      [first, second],
      async (_executionContext, input): Promise<ToolResult<string>> => {
        calls.push("tool");
        return { value: input };
      },
    );

    const result = await pipeline.execute(context, "input");

    expect(result.value).toBe("input:first:second");
    expect(calls).toEqual([
      "first:before",
      "second:before",
      "tool",
      "second:after",
      "first:after",
    ]);
  });

  it("allows middleware to short-circuit tool execution", async () => {
    let toolExecuted = false;

    const shortCircuit: Middleware<string, string> = {
      invoke() {
        return { value: "short-circuited" };
      },
    };

    const pipeline = new ForgeMiddlewarePipeline(
      [shortCircuit],
      async (_executionContext, input): Promise<ToolResult<string>> => {
        toolExecuted = true;
        return { value: input };
      },
    );

    const result = await pipeline.execute(context, "input");

    expect(result.value).toBe("short-circuited");
    expect(toolExecuted).toBe(false);
  });

  it("rejects middleware that invokes next more than once", async () => {
    const invalid: Middleware<string, string> = {
      async invoke(_executionContext, input, next) {
        await next(input);
        return next(input);
      },
    };

    const pipeline = new ForgeMiddlewarePipeline(
      [invalid],
      async (_executionContext, input): Promise<ToolResult<string>> => ({
        value: input,
      }),
    );

    await expect(pipeline.execute(context, "input")).rejects.toThrow(
      "Middleware next() called multiple times.",
    );
  });
});
