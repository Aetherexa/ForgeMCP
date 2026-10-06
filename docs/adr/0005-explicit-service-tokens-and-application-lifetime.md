# ADR 0005: Use explicit service tokens with one application lifetime

- Status: Accepted
- Date: 2026-10-06

## Context

ForgeMCP applications need reusable dependencies such as API clients, repositories, gateways, caches, and domain services.

Configuration alone is not enough: modules should not repeatedly construct the same infrastructure, read process-global state, or depend on ambient singleton objects.

A full dependency-injection container with decorators, reflection metadata, constructor inspection, request scopes, disposal graphs, and automatic module wiring would add substantial framework complexity before ForgeMCP has proven those requirements.

The framework therefore needs the smallest model that solves explicit application dependency construction while remaining deterministic and testable.

## Decision

ForgeMCP uses typed, identity-based service tokens.

```ts
const apiClient = createServiceToken<ApiClient>("apiClient");
```

Two tokens with the same description remain distinct because token identity is represented by a unique symbol. The description exists only for diagnostics.

`ForgeApplicationBuilder` supports two explicit registration forms:

- `provide(token, value)` for an existing service instance;
- `provideFactory(token, factory)` for application-start construction.

Service factories receive:

- resolved application `Configuration`;
- an asynchronous `ServiceResolver` for factory-to-factory dependencies.

Factories may depend on services registered before or after them. The runtime recursively resolves dependencies, caches successful constructions, and detects cycles through the active resolution path.

After all services are successfully resolved, modules receive a synchronous read-only `ServiceProvider` through `ModuleBuilder.services`.

Tools and middleware receive dependencies through normal object construction or closures. Tool execution does not perform ambient service lookup.

## Lifetime

Sprint 2 defines one lifetime only: one service instance per successful application start.

A factory is invoked at most once for a service token during one successful startup. Repeated `start()` calls after the application reaches `Started` do not reconstruct services.

If service construction fails:

- application startup fails;
- the application returns to `Created`;
- no partially resolved provider is exposed to modules;
- a later `start()` call may retry construction.

## Diagnostics

The runtime provides deterministic failures for:

- duplicate service registration;
- required unregistered services;
- circular dependencies.

A cycle diagnostic contains the resolution path, for example:

```text
Circular service dependency detected: 'database' -> 'repository' -> 'database'.
```

## Consequences

### Positive

- dependencies remain explicit and testable;
- core contracts stay independent of Node and MCP transports;
- service factories can consume the configuration model established in Sprint 1;
- async service construction is supported without exposing partially initialized state;
- modules receive a simple synchronous provider after startup resolution;
- token identity avoids string-key collisions;
- the model provides evidence for future dependency-lifetime work without committing to a large DI system.

### Trade-offs

- application services are eagerly resolved during startup;
- only one lifetime is available;
- consumers must define and pass explicit service tokens;
- factory dependencies use asynchronous resolution while module composition uses synchronous lookup;
- lifecycle-aware disposal is not yet implemented.

## Non-decision

This ADR does not introduce:

- request/session/transient scopes;
- child containers;
- automatic constructor injection;
- decorators or reflection metadata;
- module dependency graphs;
- lifecycle-aware service disposal;
- runtime ambient service location;
- plugin-driven service discovery.

Those capabilities require separate use cases and architecture decisions.
