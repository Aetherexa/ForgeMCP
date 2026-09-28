# ForgeMCP Architecture

## Purpose

ForgeMCP provides the application-framework layer for TypeScript MCP systems.

It does not replace the official MCP SDK. Instead, it provides the structure needed around MCP protocol primitives so applications can be composed, executed, tested, and operated consistently.

## Architectural boundaries

### `@forgemcp/core`

The core package contains framework contracts and portable abstractions.

Current areas include:

- application contracts;
- execution context;
- lifecycle;
- modules;
- middleware;
- tools;
- small shared types.

Core must not import from `@forgemcp/application`.

### `@forgemcp/application`

The application package contains the default runtime implementations.

Current responsibilities include:

- `ForgeApplicationBuilder`;
- `ForgeApplication`;
- `ModuleRegistry`;
- `ToolRegistry`;
- `ForgeModuleBuilder`;
- `ForgeMiddlewarePipeline`.

Runtime code depends on core contracts, never the reverse.

## Application composition

A ForgeMCP application is assembled from module classes.

```text
ForgeApplicationBuilder
        |
        | use(Module)
        v
   ModuleRegistry
        |
        | build()
        v
 ForgeApplication
```

During startup, the application instantiates each module in registration order and calls its `configure()` method.

```text
Module.configure(ModuleBuilder)
             |
             +--> tool(...)
             |
             +--> middleware(...)
```

The builder collects module contributions. Tool names are required to be unique inside one application.

## Lifecycle

The application lifecycle is intentionally explicit.

```text
Created -> Starting -> Started -> Stopping -> Stopped
```

Rules:

- a new application starts in `Created`;
- `start()` moves it to `Started` after successful module composition;
- startup failure restores `Created`;
- repeated `start()` calls after startup are idempotent;
- `stop()` releases runtime registrations and transitions to `Stopped`;
- repeated `stop()` calls are idempotent;
- `Stopped` is terminal for the current application instance.

Future lifecycle hooks should preserve these state guarantees.

## Tool execution

A tool is a named executable capability.

```text
Application.execute(name, input)
        |
        v
    ToolRegistry
        |
        v
 create ExecutionContext
        |
        v
 Middleware Pipeline
        |
        v
     Tool.execute
        |
        v
      ToolResult
```

Execution is only allowed while the application is in the `Started` state.

Each execution receives a fresh context containing:

- unique execution ID;
- UTC start timestamp;
- immutable top-level attributes supplied by the caller.

## Middleware

Middleware wraps tool execution and may:

- inspect execution context;
- inspect or transform input;
- invoke the next middleware;
- inspect or transform a downstream result;
- short-circuit execution by returning a result without invoking `next`.

Middleware executes in registration order and unwinds in reverse order.

The runtime rejects repeated calls to the same `next()` continuation to prevent duplicate downstream execution.

## Registries

### ModuleRegistry

Stores unique module constructors selected by the application builder.

Duplicate module registration is rejected by the application builder.

### ToolRegistry

Stores tools by exact tool name.

The registry:

- rejects empty names;
- rejects duplicate names;
- preserves registration order;
- supports lookup and required lookup.

## Dependency direction

```text
@forgemcp/core
      ^
      |
@forgemcp/application
      ^
      |
future adapters / transports / integrations
```

Protocol adapters, transports, observability, configuration, DI, and plugins should depend inward on the kernel rather than introducing reverse dependencies.

## Deliberate v0.1 exclusions

The framework kernel does not yet include:

- MCP SDK binding;
- stdio or HTTP transports;
- dependency injection;
- configuration providers;
- structured logging;
- telemetry and metrics;
- authentication or authorization;
- retry/resilience policies;
- plugin discovery;
- CLI or code generators.

These features belong after the execution model is stable.

## Evolution rules

New framework capabilities should satisfy all of the following:

1. They solve an application-framework concern rather than duplicating MCP protocol behavior.
2. Core contracts remain implementation-independent.
3. Runtime behavior is covered by tests.
4. Public APIs avoid unnecessary breaking changes.
5. New abstractions are introduced only when a real runtime use case requires them.
