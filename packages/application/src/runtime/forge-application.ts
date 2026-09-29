import { randomUUID } from "node:crypto";

import {
  type Application,
  type Dictionary,
  type ExecutionContext,
  LifecycleState,
  type Middleware,
  type ModuleType,
  type ToolMetadata,
  type ToolResult,
} from "@forgemcp/core";

import { ForgeModuleBuilder } from "../builder/forge-module-builder.js";
import { ToolRegistry } from "../registry/tool-registry.js";
import { ForgeMiddlewarePipeline } from "./forge-middleware-pipeline.js";

/**
 * Default implementation of a Forge application.
 */
export class ForgeApplication implements Application {
  private currentState = LifecycleState.Created;
  private toolRegistry: ToolRegistry | undefined;
  private middleware: readonly Middleware[] = [];

  /**
   * Creates a new Forge application.
   */
  public constructor(private readonly modules: readonly ModuleType[]) {}

  /**
   * Current lifecycle state.
   */
  public get state(): LifecycleState {
    return this.currentState;
  }

  /**
   * Starts the application.
   *
   * Starting an already started application is idempotent.
   * A stopped application is terminal and cannot be started again.
   */
  public async start(): Promise<void> {
    if (this.currentState === LifecycleState.Started) {
      return;
    }

    if (this.currentState !== LifecycleState.Created) {
      throw new Error(
        `Cannot start application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Starting;

    try {
      const moduleBuilder = new ForgeModuleBuilder();

      for (const Module of this.modules) {
        const module = new Module();
        await module.configure(moduleBuilder);
      }

      const toolRegistry = new ToolRegistry();

      for (const tool of moduleBuilder.getTools()) {
        toolRegistry.register(tool);
      }

      this.toolRegistry = toolRegistry;
      this.middleware = moduleBuilder.getMiddleware();
      this.currentState = LifecycleState.Started;
    } catch (error) {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.currentState = LifecycleState.Created;
      throw error;
    }
  }

  /**
   * Returns metadata for tools exposed by the running application.
   */
  public listTools(): readonly ToolMetadata[] {
    return this.requireToolRegistry()
      .getAll()
      .map((tool) => tool.metadata);
  }

  /**
   * Executes a registered tool through the middleware pipeline.
   */
  public async execute<TInput = unknown, TResult = unknown>(
    toolName: string,
    input: TInput,
    attributes: Readonly<Dictionary<unknown>> = {},
  ): Promise<ToolResult<TResult>> {
    if (
      this.currentState !== LifecycleState.Started ||
      this.toolRegistry === undefined
    ) {
      throw new Error("Application must be started before executing tools.");
    }

    const tool = this.toolRegistry.require(toolName);

    const context: ExecutionContext = {
      execution: {
        id: randomUUID(),
        startedAt: new Date(),
        attributes: Object.freeze({ ...attributes }),
      },
    };

    const pipeline = new ForgeMiddlewarePipeline(
      this.middleware,
      (executionContext, currentInput) =>
        tool.execute(executionContext, currentInput),
    );

    const result = await pipeline.execute(context, input);

    return result as ToolResult<TResult>;
  }

  /**
   * Stops the application.
   *
   * Stopping a created or already stopped application is safe and idempotent.
   */
  public async stop(): Promise<void> {
    if (this.currentState === LifecycleState.Stopped) {
      return;
    }

    if (this.currentState === LifecycleState.Created) {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.currentState = LifecycleState.Stopped;
      return;
    }

    if (this.currentState !== LifecycleState.Started) {
      throw new Error(
        `Cannot stop application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Stopping;

    try {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.currentState = LifecycleState.Stopped;
    } catch (error) {
      this.currentState = LifecycleState.Started;
      throw error;
    }
  }

  private requireToolRegistry(): ToolRegistry {
    if (
      this.currentState !== LifecycleState.Started ||
      this.toolRegistry === undefined
    ) {
      throw new Error("Application must be started before accessing tools.");
    }

    return this.toolRegistry;
  }
}
