import {
  LifecycleState,
  type Middleware,
  type Module,
  type ModuleBuilder,
  type Tool,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplication } from "./forge-application.js";

describe("ForgeApplication lifecycle", () => {
  it("starts in the created state", () => {
    const application = new ForgeApplication([]);

    expect(application.state).toBe(LifecycleState.Created);
  });

  it("transitions from created to started", async () => {
    const application = new ForgeApplication([]);

    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
  });

  it("treats repeated start calls as idempotent", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.start();

    expect(application.state).toBe(LifecycleState.Started);
  });

  it("transitions from started to stopped", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("allows an application to stop before it is started", async () => {
    const application = new ForgeApplication([]);

    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("treats repeated stop calls as idempotent", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();
    await application.stop();

    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("does not allow a stopped application to be started again", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();

    await expect(application.start()).rejects.toThrow(
      "Cannot start application while lifecycle state is 'stopped'.",
    );

    expect(application.state).toBe(LifecycleState.Stopped);
  });
});

describe("ForgeApplication module composition", () => {
  it("configures registered modules during startup", async () => {
    let configured = false;

    class TestModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        configured = true;
      }
    }

    const application = new ForgeApplication([TestModule]);

    await application.start();

    expect(configured).toBe(true);
    expect(application.state).toBe(LifecycleState.Started);
  });

  it("awaits asynchronous module configuration", async () => {
    const calls: string[] = [];

    class FirstModule implements Module {
      public async configure(_builder: ModuleBuilder): Promise<void> {
        await Promise.resolve();
        calls.push("first");
      }
    }

    class SecondModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        calls.push("second");
      }
    }

    const application = new ForgeApplication([FirstModule, SecondModule]);

    await application.start();

    expect(calls).toEqual(["first", "second"]);
  });

  it("returns to created state when module configuration fails", async () => {
    class FailingModule implements Module {
      public configure(_builder: ModuleBuilder): void {
        throw new Error("module configuration failed");
      }
    }

    const application = new ForgeApplication([FailingModule]);

    await expect(application.start()).rejects.toThrow(
      "module configuration failed",
    );

    expect(application.state).toBe(LifecycleState.Created);
  });
});

describe("ForgeApplication tool execution", () => {
  it("requires the application to be started before listing tools", () => {
    const application = new ForgeApplication([]);

    expect(() => application.listTools()).toThrow(
      "Application must be started before accessing tools.",
    );
  });

  it("lists metadata for registered tools", async () => {
    const echoTool: Tool = {
      metadata: {
        name: "echo",
        description: "Returns the supplied input.",
      },
      execute(_context, input) {
        return { value: input };
      },
    };

    class EchoModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(echoTool);
      }
    }

    const application = new ForgeApplication([EchoModule]);
    await application.start();

    expect(application.listTools()).toEqual([echoTool.metadata]);
  });

  it("requires the application to be started", async () => {
    const application = new ForgeApplication([]);

    await expect(application.execute("echo", "hello")).rejects.toThrow(
      "Application must be started before executing tools.",
    );
  });

  it("executes a registered tool with request-scoped context", async () => {
    let executionId = "";
    let source: unknown;

    const echoTool: Tool = {
      metadata: {
        name: "echo",
        description: "Returns the supplied input.",
      },
      execute(context, input) {
        executionId = context.execution.id;
        source = context.execution.attributes.source;
        return { value: input };
      },
    };

    class EchoModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(echoTool);
      }
    }

    const application = new ForgeApplication([EchoModule]);
    await application.start();

    const result = await application.execute<string, string>("echo", "hello", {
      source: "test",
    });

    expect(result.value).toBe("hello");
    expect(executionId.length).toBeGreaterThan(0);
    expect(source).toBe("test");
  });

  it("executes tools through registered middleware", async () => {
    const middleware: Middleware = {
      async invoke(_context, input, next) {
        const value = typeof input === "string" ? `${input}:middleware` : input;
        return next(value);
      },
    };

    const echoTool: Tool = {
      metadata: { name: "echo" },
      execute(_context, input) {
        return { value: input };
      },
    };

    class RuntimeModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.middleware(middleware);
        builder.tool(echoTool);
      }
    }

    const application = new ForgeApplication([RuntimeModule]);
    await application.start();

    const result = await application.execute<string, string>("echo", "hello");

    expect(result.value).toBe("hello:middleware");
  });

  it("creates an isolated execution context for each invocation", async () => {
    const executionIds: string[] = [];
    const sources: unknown[] = [];

    const contextTool: Tool = {
      metadata: { name: "context" },
      execute(context) {
        executionIds.push(context.execution.id);
        sources.push(context.execution.attributes.source);
        return { value: context.execution.id };
      },
    };

    class ContextModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool(contextTool);
      }
    }

    const application = new ForgeApplication([ContextModule]);
    await application.start();

    await application.execute("context", undefined, { source: "first" });
    await application.execute("context", undefined, { source: "second" });

    expect(executionIds).toHaveLength(2);
    expect(executionIds[0]).not.toBe(executionIds[1]);
    expect(sources).toEqual(["first", "second"]);
  });

  it("throws for unknown tool names", async () => {
    const application = new ForgeApplication([]);
    await application.start();

    await expect(application.execute("missing", undefined)).rejects.toThrow(
      "Tool 'missing' is not registered.",
    );
  });

  it("prevents tool execution after the application is stopped", async () => {
    const application = new ForgeApplication([]);

    await application.start();
    await application.stop();

    await expect(application.execute("echo", "hello")).rejects.toThrow(
      "Application must be started before executing tools.",
    );
  });
});
