# ForgeMCP Architecture

## Purpose

ForgeMCP provides the application-framework layer for TypeScript MCP systems.

It does not replace the official MCP SDK. Instead, it provides the structure needed around MCP protocol primitives so applications can be composed, executed, tested, and operated consistently.

## Architectural boundaries

### `@forgemcp/core`

The core package contains framework contracts and portable abstractions.

Current areas include:

- application contracts;
- configuration contracts;
- service tokens, factories, resolvers, and providers;
- execution context;
- provider-neutral diagnostic event/listener contracts;
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
- resolved immutable configuration;
- explicit and environment-backed configuration sources;
- deterministic application service registration and resolution;
- lifetime-aware service ownership and deterministic disposal;
- application-local diagnostic listener delivery and lifecycle event emission;
- `ModuleRegistry`;
- `ToolRegistry`;
- `ForgeModuleBuilder`;
- `ForgeMiddlewarePipeline`.

Runtime code depends on core contracts, never the reverse.

### `@forgemcp/mcp-server`

The MCP server package is a protocol adapter around the application contract.

Its responsibilities are:

- create and start a fresh ForgeMCP application per MCP server instance;
- discover application tool metadata;
- register those tools with the official MCP TypeScript SDK;
- map MCP request context into ForgeMCP execution attributes;
- map ForgeMCP tool results into MCP tool-call results;
- coordinate MCP server close with ForgeMCP application drain and shutdown;
- provide the stdio serving entry point.

The adapter depends on `@forgemcp/core` and the official MCP server SDK. Core does not depend on MCP packages.

## Application composition

A ForgeMCP application explicitly selects module classes through `ForgeApplicationBuilder.use(Module)`.

```text
ForgeApplicationBuilder
        |
        +--> use(ModuleA)
        +--> use(ModuleB)
        +--> use(ModuleC)
        |
        v
   ModuleRegistry
        |
        v
 ForgeApplication
        |
        +--> validate module dependencies
        +--> stable dependency-first plan
        |
        v
 Module.configure(ModuleBuilder)
             |
             +--> tool(...)
             |
             +--> middleware(...)
```

Module types may declare required modules through optional static `dependencies` metadata. Dependencies are identified by constructor identity; class names are diagnostic metadata only.

Module selection remains explicit. A dependency declaration never auto-registers another module. Every required module must also be selected with `.use(...)`.

Before configuration resolution, service construction, or module configuration begins, application startup validates the complete selected module graph and produces a stable topological plan.

Composition rules:

- dependencies always configure before dependents;
- modules with no ordering relationship preserve application selection order;
- each selected module configures exactly once;
- shared dependencies in diamond graphs are deduplicated by constructor identity;
- missing dependencies fail with both the dependent and missing module identified;
- circular dependencies fail with a deterministic dependency path;
- graph validation failure returns the application to `Created` before partial module composition is exposed.

Module dependencies express ordering and required composition only. They do not expose module instances to dependents, inject constructors, create module-scoped containers, or alter service lifetimes. Cross-module runtime dependencies continue to use explicit service contracts or ordinary shared abstractions.

The builder collects module contributions after the graph is valid. Tool names are required to be unique inside one application.

## Configuration

Configuration is resolved as part of application startup, before any module is configured.

```text
ForgeApplicationBuilder
        |
        +--> configure(values)
        +--> configureFrom(source)
        |
        v
configuration sources
        |
        | registration order
        | later values override earlier values
        v
resolved immutable Configuration
        |
        v
ModuleBuilder.configuration
        |
        v
Module.configure(...)
```

Configuration keys are canonical lowercase dot-separated paths. Environment-backed configuration is opt-in and prefix-scoped. For example, `MYAPP_DATABASE__URL` with prefix `MYAPP_` becomes `database.url`.

A configuration-source failure is a startup failure. The application returns to `Created`, preserving the same retry behavior as module-composition failures.

The core package defines configuration contracts but does not read Node process state. `EnvironmentConfigurationSource` lives in `@forgemcp/application`.

## Service registration and lifetimes

Services are registered explicitly through `ForgeApplicationBuilder`. Configuration is resolved first, application-lifetime services are constructed next, and modules are composed only after the application service graph is valid.

```text
ForgeApplicationBuilder
        |
        +--> provide(token, value)                 application
        +--> provideFactory(token, factory)        application
        +--> provideScopedFactory(token, factory)  execution
        +--> provideTransientFactory(token, factory) transient
        |
        v
ServiceRegistry
        |
        +--> resolved Configuration
        +--> duplicate/missing/circular diagnostics
        +--> captive-dependency validation
        |
        v
ServiceRuntime
        |
        +--> application ServiceProvider
        |        |
        |        v
        |   ModuleBuilder.services
        |
        +--> createScope()
                 |
                 v
          ExecutionContext.services
```

`ServiceToken<T>` values are identity-based. Human-readable descriptions are diagnostic metadata, not registration keys.

ForgeMCP defines three lifetimes:

| Lifetime | Construction boundary | Reuse |
| --- | --- | --- |
| Application | successful application start | one instance per token for the running application |
| Execution | one `Application.execute()` call | one instance per token inside that execution |
| Transient | one scoped resolution request | never cached |

Existing `provide(...)` and `provideFactory(...)` APIs remain application-lifetime. Shorter-lived registrations are factory-based and explicit.

The runtime enforces this dependency matrix:

| Consumer lifetime | Application dependency | Execution dependency | Transient dependency |
| --- | --- | --- | --- |
| Application | allowed | rejected | rejected |
| Execution | allowed | allowed | allowed |
| Transient inside an execution scope | allowed | allowed | allowed |

Rejecting shorter-lived dependencies from an application service prevents captive dependencies whose effective lifetime would silently expand to the application lifetime.

Application services resolve during startup. Factories may resolve other application services asynchronously, including services registered later. Successful application constructions are cached for the current successful start. A missing dependency, circular path, duplicate registration, captive dependency, or factory failure fails startup deterministically and returns the application to `Created`.

`ModuleBuilder.services` remains synchronous and exposes application-lifetime services only. Modules can therefore construct long-lived tools and middleware without a request-local container.

Each valid `Application.execute()` call creates an independent asynchronous resolver exposed as `ExecutionContext.services`. Middleware and the target tool share the same resolver for that execution. Execution-scoped services are cached inside that resolver; transient services are constructed for every resolution request; already-resolved application services are reused.

Concurrent executions own independent scoped caches and in-flight maps. No request scope is stored in process-global state or shared between calls.

### Service ownership and disposal

Factory construction defines framework ownership:

| Registration | Owner | Cleanup boundary |
| --- | --- | --- |
| `provide(token, value)` | caller | caller-managed |
| `provideFactory(token, factory)` | ForgeMCP | startup rollback/application stop |
| `provideScopedFactory(token, factory)` | ForgeMCP | execution end |
| `provideTransientFactory(token, factory)` | ForgeMCP | execution end for each constructed instance |

Framework-owned factory results use standard JavaScript resource-management capability detection. `Symbol.asyncDispose` is preferred when present; otherwise `Symbol.dispose` is used. ForgeMCP does not infer lifecycle from method names such as `close()`, `destroy()`, or `shutdown()`.

Successful factory results are tracked in construction-completion order and disposed in reverse order, so dependents are cleaned up before their dependencies. Every transient construction is a distinct ownership entry.

Execution scopes dispose request-owned resources whether middleware/tool execution succeeds or fails. Application startup rollback disposes any already-created application services before returning to `Created`. Cleanup is best-effort: later resources are still attempted after an earlier cleanup failure, and deterministic disposal errors retain service identities plus underlying errors.

A resolver captured from `ExecutionContext.services` cannot create new resources after its execution scope has been disposed.

The official MCP adapter does not create another dependency scope. Every MCP tool request delegates to `Application.execute()`, so sequential and concurrent MCP calls inherit the same Forge execution-scope semantics. `McpServer.close()` waits for application drain and cleanup rather than merely initiating shutdown.

## Runtime diagnostics and execution correlation

ForgeMCP exposes lifecycle facts through a provider-neutral diagnostic event stream rather than embedding a concrete logging or telemetry SDK.

```text
ForgeApplicationBuilder.observe(listener)
             |
             v
       ForgeApplication
             |
             +--> application.* events
             |
             +--> Application.execute(...)
                       |
                       +--> execution.started
                       |
                       +--> middleware/tool/scope cleanup
                       |
                       +--> execution.completed
                       |       or
                       +--> execution.failed
```

The core contracts are `DiagnosticEvent` and `DiagnosticListener`. Runtime event names and framework attribute names are exported through `DiagnosticEventNames` and `DiagnosticAttributeNames`.

Diagnostic listeners belong to one application instance. There is no process-global listener registry. Registration order is preserved, and listener exceptions are isolated so diagnostics cannot change startup, tool, cleanup, or shutdown outcomes.

### Correlation

`ExecutionMetadata.id` is the canonical Forge execution correlation identity. ForgeMCP does not create a second framework request or trace ID for diagnostics.

One execution's start and terminal event share the same execution metadata. Concurrent executions may interleave, so consumers correlate by `execution.id` rather than global event order.

MCP transport identifiers remain execution attributes:

- `mcp.requestId`;
- `mcp.sessionId` when supplied by the transport;
- `mcp.meta` when supplied by the protocol request.

No MCP SDK type enters the core diagnostics contracts.

### Event timing

Application failure events are emitted only after the existing rollback/cleanup boundary has completed.

Execution terminal events are emitted after execution-scope cleanup. Consequently `duration.ms` measures the complete Forge execution promise boundary, including request-owned cleanup.

### Privacy boundary

Framework-owned event attributes contain runtime facts such as tool name and duration. ForgeMCP does not automatically copy raw tool input or result values into diagnostic events.

Execution metadata can contain application- or transport-provided attributes because those values already belong to the execution context. Concrete logging/telemetry adapters therefore own any policy for serializing or redacting arbitrary execution attributes.

The diagnostic stream is the common source for later structured logging, tracing, metrics, health, and runtime-diagnostics work. Those features should consume these lifecycle facts instead of introducing independent instrumentation.

## Lifecycle

The application lifecycle is intentionally explicit.

```text
Created -> Starting -> Started -> Stopping -> Stopped
```

Rules:

- a new application starts in `Created`;
- `start()` moves it to `Started` after successful module composition;
- startup failure disposes any framework-owned application services already created, then restores `Created`;
- repeated `start()` calls after startup are idempotent;
- `stop()` moves to `Stopping` before waiting, so no new executions can begin;
- shutdown waits for already-active executions and their execution-scope cleanup before disposing application-owned services;
- cleanup is attempted once in reverse construction order;
- repeated `stop()` calls are idempotent;
- cleanup failure is reported while the application still ends in terminal `Stopped`;
- `Stopped` is terminal for the current application instance.

## Tool execution

A tool is a named executable capability.

```text
Application.execute(name, input)
        |
        v
    ToolRegistry
        |
        +--> create execution ServiceScope
        |
        v
 create ExecutionContext
        |
        +--> execution metadata
        +--> scoped ServiceResolver
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
- immutable top-level attributes supplied by the caller;
- an asynchronous service resolver owned by that execution scope.

The execution promise does not settle successfully until request-owned service cleanup finishes. If tool execution fails, scope cleanup still runs. When both execution and cleanup fail, both errors are preserved.

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

## MCP adapter boundary

Tool schemas use the vendor-neutral Standard Schema and Standard JSON Schema contracts. This lets Zod v4, ArkType, and compatible Valibot schemas describe and validate tool inputs without importing the MCP SDK into core.

The MCP adapter consumes those schemas and passes them to the official SDK. Protocol validation therefore happens before ForgeMCP tool execution.

## Dependency direction

```text
                 @forgemcp/core
                   ^        ^
                   |        |
@forgemcp/application   @forgemcp/mcp-server
                              |
                              v
                   @modelcontextprotocol/server
```

Future observability, dependency-management, and plugin packages should continue to depend inward on kernel contracts rather than introducing reverse dependencies.

## Deliberate exclusions

The current framework intentionally does not include:

- HTTP transport integration;
- session or MCP-connection dependency scopes;
- child scopes created directly by application code;
- arbitrary service start/readiness hooks;
- optional or conditional module dependency semantics;
- automatic constructor injection, decorators, or reflection metadata;
- built-in structured logging adapters;
- telemetry exporters, traces, and metrics;
- authentication or authorization;
- retry/resilience policies;
- plugin discovery;
- CLI or code generators.

These concerns remain separate roadmap slices so they do not destabilize the explicit execution and dependency model.

## Evolution rules

New framework capabilities should satisfy all of the following:

1. They solve an application-framework concern rather than duplicating MCP protocol behavior.
2. Core contracts remain implementation-independent.
3. Runtime behavior is covered by tests.
4. Public APIs avoid unnecessary breaking changes.
5. New abstractions are introduced only when a real runtime use case requires them.

## Structured logging boundary

`ForgeApplication` emits `DiagnosticEvent` facts. The application-local
`createStructuredLogListener` projects those facts into frozen structured log
records and invokes a caller-selected synchronous sink. No lifecycle code is
instrumented twice. Core owns only provider-neutral contracts.

Framework attributes are retained; execution attributes require explicit names.
Forge execution IDs remain canonical, with MCP IDs as optional supporting data.
The built-in JSON Lines sink writes only to stderr, preserving protocol stdout.
Existing diagnostic-listener isolation prevents mapping or sink failures from
changing application outcomes. SDK/exporter lifecycle remains caller-owned.
