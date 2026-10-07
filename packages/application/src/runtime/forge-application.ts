import { randomUUID } from "node:crypto";

import {
  type Application,
  type ConfigurationSource,
  type Dictionary,
  type ExecutionContext,
  LifecycleState,
  type Middleware,
  type ModuleType,
  type ToolMetadata,
  type ToolResult,
} from "@forgemcp/core";

import { ForgeModuleBuilder } from "../builder/forge-module-builder.js";
import { resolveConfiguration } from "../configuration/configuration-resolver.js";
import { planModuleComposition } from "../registry/module-composition-planner.js";
import { ToolRegistry } from "../registry/tool-registry.js";
import type { ServiceRegistration } from "../service/service-registration.js";
import { ServiceRegistry } from "../service/service-registry.js";
import type {
  ServiceRuntime,
  ServiceScope,
} from "../service/service-runtime.js";
import { ForgeMiddlewarePipeline } from "./forge-middleware-pipeline.js";

/**
 * Default implementation of a Forge application.
 */
export class ForgeApplication implements Application {
  private currentState = LifecycleState.Created;
  private toolRegistry: ToolRegistry | undefined;
  private middleware: readonly Middleware[] = [];
  private serviceRuntime: ServiceRuntime | undefined;
  private readonly activeExecutions = new Set<Promise<unknown>>();

  /**
   * Creates a new Forge application.
   */
  public constructor(
    private readonly modules: readonly ModuleType[],
    private readonly configurationSources: readonly ConfigurationSource[] = [],
    private readonly serviceRegistrations: readonly ServiceRegistration[] = [],
  ) {}

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
    let serviceRuntime: ServiceRuntime | undefined;

    try {
      const modules = planModuleComposition(this.modules);
      const configuration = await resolveConfiguration(
        this.configurationSources,
      );
      serviceRuntime = await new ServiceRegistry(
        this.serviceRegistrations,
      ).resolveRuntime(configuration);
      const moduleBuilder = new ForgeModuleBuilder(
        configuration,
        serviceRuntime.services,
      );

      for (const Module of modules) {
        const module = new Module();
        await module.configure(moduleBuilder);
      }

      const toolRegistry = new ToolRegistry();

      for (const tool of moduleBuilder.getTools()) {
        toolRegistry.register(tool);
      }

      this.toolRegistry = toolRegistry;
      this.middleware = moduleBuilder.getMiddleware();
      this.serviceRuntime = serviceRuntime;
      this.currentState = LifecycleState.Started;
    } catch (error) {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.serviceRuntime = undefined;
      this.currentState = LifecycleState.Created;

      if (serviceRuntime !== undefined) {
        try {
          await serviceRuntime[Symbol.asyncDispose]();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "Application startup failed and service cleanup also failed.",
          );
        }
      }

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
      this.toolRegistry === undefined ||
      this.serviceRuntime === undefined
    ) {
      throw new Error("Application must be started before executing tools.");
    }

    const tool = this.toolRegistry.require(toolName);
    const services = this.serviceRuntime.createScope();
    const execution = this.executeWithScope<TInput, TResult>(
      services,
      toolName,
      input,
      attributes,
      tool.execute.bind(tool),
    );

    this.activeExecutions.add(execution);

    try {
      return await execution;
    } finally {
      this.activeExecutions.delete(execution);
    }
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
      this.serviceRuntime = undefined;
      this.currentState = LifecycleState.Stopped;
      return;
    }

    if (this.currentState !== LifecycleState.Started) {
      throw new Error(
        `Cannot stop application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Stopping;
    const serviceRuntime = this.serviceRuntime;

    try {
      await Promise.allSettled([...this.activeExecutions]);

      if (serviceRuntime !== undefined) {
        await serviceRuntime[Symbol.asyncDispose]();
      }
    } finally {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.serviceRuntime = undefined;
      this.currentState = LifecycleState.Stopped;
    }
  }

  private async executeWithScope<TInput, TResult>(
    services: ServiceScope,
    _toolName: string,
    input: TInput,
    attributes: Readonly<Dictionary<unknown>>,
    executeTool: (
      context: ExecutionContext,
      input: TInput,
    ) => Promise<ToolResult<TResult>> | ToolResult<TResult>,
  ): Promise<ToolResult<TResult>> {
    const context: ExecutionContext = {
      execution: {
        id: randomUUID(),
        startedAt: new Date(),
        attributes: Object.freeze({ ...attributes }),
      },
      services,
    };

    const pipeline = new ForgeMiddlewarePipeline(
      this.middleware,
      (executionContext, currentInput) =>
        executeTool(executionContext, currentInput as TInput),
    );

    try {
      const result = (await pipeline.execute(
        context,
        input,
      )) as ToolResult<TResult>;

      await services[Symbol.asyncDispose]();
      return result;
    } catch (operationError) {
      try {
        await services[Symbol.asyncDispose]();
      } catch (cleanupError) {
        if (cleanupError === operationError) {
          throw operationError;
        }

        throw new AggregateError(
          [operationError, cleanupError],
          "Tool execution failed and service cleanup also failed.",
        );
      }

      throw operationError;
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
