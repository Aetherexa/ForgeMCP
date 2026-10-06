# ADR 0006: Use execution-owned service scopes for shorter-lived dependencies

- Status: Accepted
- Date: 2026-10-06

## Context

ForgeMCP Sprint 2 introduced typed service tokens, configuration-aware factories, deterministic dependency resolution, and one application lifetime.

That model is sufficient for long-lived dependencies such as API clients and repositories, but some dependencies should not be shared across unrelated tool executions. Examples include request correlation state, per-execution caches, authorization context adapters, unit-of-work objects, and temporary coordinators.

Adding conventional dependency-injection container semantics would be easy to over-design. ForgeMCP still intentionally avoids decorators, reflection metadata, automatic constructor injection, and a process-global service locator.

The framework already owns one deterministic short-lived boundary: `Application.execute()`.

## Decision

ForgeMCP will support three dependency lifetimes:

- **application** — one instance per successful application start;
- **execution** — one instance per service token for one `Application.execute()` call;
- **transient** — a new instance for each resolution request inside an execution scope.

Existing `provide(...)` and `provideFactory(...)` registrations remain application-lifetime for source compatibility.

Shorter-lived services are registered explicitly with factory-oriented APIs. Application values remain application-lifetime because an already-created value has no meaningful scope-construction boundary.

## Execution scope ownership

One call to `Application.execute()` owns one execution scope.

The scope is created immediately before the middleware/tool pipeline runs and is released when the execution settles, whether it succeeds or fails.

Concurrent executions never share execution-scoped instances.

The MCP adapter does not define a separate dependency scope. Each MCP tool call already delegates to `Application.execute()`, so MCP calls inherit the Forge execution boundary.

## Resolution surface

`ModuleBuilder.services` remains a synchronous provider containing application-lifetime services only.

Modules therefore continue to construct ordinary tools and middleware from long-lived dependencies exactly as they do today.

Shorter-lived dependencies are exposed through the request-local `ExecutionContext` as an asynchronous service resolver. This is explicit context propagation, not ambient global lookup.

The intended execution shape is:

```text
Application.execute(...)
        |
        +--> create execution scope
        |
        +--> ExecutionContext.services
        |
        v
middleware -> tool
```

A tool that requires an execution-scoped dependency resolves it from the context already passed to `execute()`.

## Dependency rules

The runtime enforces lifetime safety.

| Consumer lifetime | Application dependency | Execution dependency | Transient dependency |
| --- | --- | --- | --- |
| Application | allowed | rejected | rejected |
| Execution | allowed | allowed | allowed |
| Transient inside an execution scope | allowed | allowed | allowed |

An application service cannot depend on an execution-scoped or transient service. Allowing that would create a captive dependency whose effective lifetime silently expands to application lifetime.

Attempting such a dependency fails deterministically during application startup with a lifetime diagnostic.

Execution-scoped and transient services are resolved only inside a valid execution scope.

## Factory behavior

Factories remain asynchronous-capable.

An execution scope:

1. reuses already-resolved application services;
2. caches successful execution-scoped constructions for that scope;
3. does not cache transient constructions;
4. recursively resolves dependencies;
5. detects circular dependencies using the active resolution path;
6. preserves deterministic missing-service failures.

A failed scoped/transient construction does not poison another execution scope.

## Concurrency

Each execution owns an independent scoped-resolution cache and in-flight map.

Application-lifetime instances may be shared concurrently because their lifetime intentionally spans executions.

No mutable scope state is stored in a process-global variable or shared singleton.

## Lifecycle and disposal

This decision does not introduce disposal hooks.

When an execution completes, the runtime releases references held by the execution scope. Services that require explicit asynchronous cleanup remain a later v0.3 lifecycle-aware-services concern.

This separation prevents the lifetime slice from implicitly defining a disposal graph before disposal contracts exist.

## Consequences

### Positive

- the scope boundary maps to an existing Forge runtime concept;
- existing application service APIs remain compatible;
- per-execution state becomes deterministic and testable;
- concurrent MCP calls can be isolated without a global container;
- async service factories remain supported;
- captive dependencies are prevented rather than silently retained;
- module composition remains simple for application dependencies.

### Trade-offs

- tools or middleware that need shorter-lived services perform explicit async resolution through `ExecutionContext`;
- `ExecutionContext` gains a dependency-resolution responsibility in addition to execution metadata;
- transient services are meaningful only inside an execution scope;
- lifecycle-aware cleanup is intentionally deferred.

## Non-decision

This ADR does not introduce:

- session or MCP-connection scopes;
- child scopes created by user code;
- disposal/async-disposal contracts;
- automatic constructor injection;
- decorators or reflection metadata;
- module dependency graphs;
- plugin-driven dependency discovery.

These remain separate architecture decisions.
