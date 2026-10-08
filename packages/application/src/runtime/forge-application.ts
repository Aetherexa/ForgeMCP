import { randomUUID } from "node:crypto";

import {
  type Application,
  type ConfigurationSource,
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  type DiagnosticEventName,
  type DiagnosticListener,
  type Dictionary,
  type ExecutionContext,
  type ExecutionMetadata,
  LifecycleState,
  type Middleware,
  type ModuleType,
  type Tool,
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
import { DiagnosticPublisher } from "./diagnostic-publisher.js";
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
  private readonly diagnostics: DiagnosticPublisher;

  /**
   * Creates a new Forge application.
   */
  public constructor(
    private readonly modules: readonly ModuleType[],
    private readonly configurationSources: readonly ConfigurationSource[] = [],
    private readonly serviceRegistrations: readonly ServiceRegistration[] = [],
    diagnosticListeners: readonly DiagnosticListener[] = [],
  ) {
    this.diagnostics = new DiagnosticPublisher(diagnosticListeners);
  }

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
    this.publishDiagnostic(DiagnosticEventNames.ApplicationStarting);

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
      this.publishDiagnostic(DiagnosticEventNames.ApplicationStarted);
    } catch (error) {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.serviceRuntime = undefined;

      let finalError: unknown = error;

      if (serviceRuntime !== undefined) {
        try {
          await serviceRuntime[Symbol.asyncDispose]();
        } catch (cleanupError) {
          finalError = new AggregateError(
            [error, cleanupError],
            "Application startup failed and service cleanup also failed.",
          );
        }
      }

      this.currentState = LifecycleState.Created;
      this.publishDiagnostic(DiagnosticEventNames.ApplicationStartFailed);
      throw finalError;
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

    const tool = this.toolRegistry.require(toolName) as Tool<TInput, TResult>;
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
      this.currentState = LifecycleState.Stopping;
      this.publishDiagnostic(DiagnosticEventNames.ApplicationStopping);

      this.toolRegistry = undefined;
      this.middleware = [];
      this.serviceRuntime = undefined;
      this.currentState = LifecycleState.Stopped;
      this.publishDiagnostic(DiagnosticEventNames.ApplicationStopped);
      return;
    }

    if (this.currentState !== LifecycleState.Started) {
      throw new Error(
        `Cannot stop application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Stopping;
    this.publishDiagnostic(DiagnosticEventNames.ApplicationStopping);

    const serviceRuntime = this.serviceRuntime;
    let stopFailed = false;
    let stopError: unknown;

    try {
      await Promise.allSettled([...this.activeExecutions]);

      if (serviceRuntime !== undefined) {
        await serviceRuntime[Symbol.asyncDispose]();
      }
    } catch (error) {
      stopFailed = true;
      stopError = error;
    } finally {
      this.toolRegistry = undefined;
      this.middleware = [];
      this.serviceRuntime = undefined;
      this.currentState = LifecycleState.Stopped;
    }

    if (stopFailed) {
      this.publishDiagnostic(DiagnosticEventNames.ApplicationStopFailed);
      throw stopError;
    }

    this.publishDiagnostic(DiagnosticEventNames.ApplicationStopped);
  }

  private async executeWithScope<TInput, TResult>(
    services: ServiceScope,
    toolName: string,
    input: TInput,
    attributes: Readonly<Dictionary<unknown>>,
    executeTool: (
      context: ExecutionContext,
      input: TInput,
    ) => Promise<ToolResult<TResult>> | ToolResult<TResult>,
  ): Promise<ToolResult<TResult>> {
    const execution: ExecutionMetadata = Object.freeze({
      id: randomUUID(),
      startedAt: new Date(),
      attributes: Object.freeze({ ...attributes }),
    });

    const context: ExecutionContext = {
      execution,
      services,
    };

    this.publishDiagnostic(
      DiagnosticEventNames.ExecutionStarted,
      {
        [DiagnosticAttributeNames.ToolName]: toolName,
      },
      execution,
    );

    const pipeline = new ForgeMiddlewarePipeline(
      this.middleware,
      (executionContext, currentInput) =>
        executeTool(executionContext, currentInput as TInput),
    );

    let operationFailed = false;
    let operationError: unknown;
    let result: ToolResult<TResult> | undefined;

    try {
      result = (await pipeline.execute(context, input)) as ToolResult<TResult>;
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }

    let cleanupFailed = false;
    let cleanupError: unknown;

    try {
      await services[Symbol.asyncDispose]();
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }

    const terminalAttributes = {
      [DiagnosticAttributeNames.ToolName]: toolName,
      [DiagnosticAttributeNames.DurationMs]: Math.max(
        0,
        Date.now() - execution.startedAt.getTime(),
      ),
    };

    if (operationFailed) {
      const finalError =
        cleanupFailed && cleanupError !== operationError
          ? new AggregateError(
              [operationError, cleanupError],
              "Tool execution failed and service cleanup also failed.",
            )
          : operationError;

      this.publishDiagnostic(
        DiagnosticEventNames.ExecutionFailed,
        terminalAttributes,
        execution,
      );

      throw finalError;
    }

    if (cleanupFailed) {
      this.publishDiagnostic(
        DiagnosticEventNames.ExecutionFailed,
        terminalAttributes,
        execution,
      );
      throw cleanupError;
    }

    this.publishDiagnostic(
      DiagnosticEventNames.ExecutionCompleted,
      terminalAttributes,
      execution,
    );

    return result as ToolResult<TResult>;
  }

  private publishDiagnostic(
    name: DiagnosticEventName,
    attributes: Readonly<Dictionary<unknown>> = {},
    execution?: ExecutionMetadata,
  ): void {
    this.diagnostics.publish(
      Object.freeze({
        name,
        timestamp: new Date(),
        attributes: Object.freeze({ ...attributes }),
        ...(execution === undefined ? {} : { execution }),
      }),
    );
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
