import {
  LifecycleState,
  type ExecutionContext,
  type Module,
  type ModuleBuilder,
  type Tool,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplication } from "./forge-application.js";

function createTool(name: string): Tool {
  return {
    metadata: { name },
    execute(_context: ExecutionContext, input: unknown) {
      return { value: input };
    },
  };
}

describe("ForgeApplication quality guarantees", () => {
  it("returns tool metadata snapshots rather than the registry array", async () => {
    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(createTool("first"));
        builder.tool(createTool("second"));
      }
    }

    const application = new ForgeApplication([TestModule]);
    await application.start();

    const first = application.listTools();
    const second = application.listTools();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first.map((tool) => tool.name)).toEqual(["first", "second"]);
  });

  it("isolates execution attributes from later caller mutation", async () => {
    let capturedSource: unknown;
    let capturedFrozen = false;

    const tool: Tool = {
      metadata: { name: "inspect-context" },
      execute(context) {
        capturedSource = context.execution.attributes.source;
        capturedFrozen = Object.isFrozen(context.execution.attributes);
        return { value: undefined };
      },
    };

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(tool);
      }
    }

    const application = new ForgeApplication([TestModule]);
    await application.start();

    const attributes: Record<string, unknown> = { source: "original" };
    await application.execute("inspect-context", undefined, attributes);
    attributes.source = "mutated";

    expect(capturedSource).toBe("original");
    expect(capturedFrozen).toBe(true);
  });

  it("propagates tool errors without corrupting application lifecycle state", async () => {
    const tool: Tool = {
      metadata: { name: "fail" },
      execute() {
        throw new Error("tool failed");
      },
    };

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(tool);
      }
    }

    const application = new ForgeApplication([TestModule]);
    await application.start();

    await expect(application.execute("fail", undefined)).rejects.toThrow(
      "tool failed",
    );

    expect(application.state).toBe(LifecycleState.Started);
  });

  it("rolls startup back when separate modules contribute duplicate tool names", async () => {
    class FirstModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(createTool("duplicate"));
      }
    }

    class SecondModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(createTool("duplicate"));
      }
    }

    const application = new ForgeApplication([FirstModule, SecondModule]);

    await expect(application.start()).rejects.toThrow(
      "Tool 'duplicate' is already registered.",
    );
    expect(application.state).toBe(LifecycleState.Created);
  });
});
