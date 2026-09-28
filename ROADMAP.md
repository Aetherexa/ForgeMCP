# ForgeMCP Roadmap

ForgeMCP is developed in vertical milestones. Each milestone must leave the repository buildable, testable, documented, and usable before the next layer is added.

## v0.1 — Framework Kernel

Goal: establish the execution model independent of MCP transports.

### Scope

- [x] strict TypeScript workspace baseline
- [x] application and lifecycle contracts
- [x] application lifecycle runtime
- [x] module composition contract
- [x] module registry integration
- [x] tool contracts
- [x] tool registry
- [x] request-scoped execution context
- [x] middleware contract
- [x] executable middleware pipeline
- [x] application-level tool dispatch
- [x] kernel tests
- [x] CI build/typecheck/test workflow
- [ ] lint and format quality gates
- [ ] final repository documentation review
- [ ] v0.1 release acceptance

### Acceptance

A developer can:

1. create a module;
2. register tools and middleware;
3. build an application;
4. start it;
5. execute a named tool through middleware with an execution context;
6. stop the application;
7. run automated validation for the kernel.

## v0.2 — MCP Server Adapter

Goal: expose the kernel through the official MCP TypeScript SDK without coupling core contracts to the SDK.

Planned work:

- MCP server package/adapter;
- tool registration bridge;
- protocol request-to-execution-context mapping;
- tool result mapping;
- stdio transport;
- integration tests against the official SDK.

## v0.3 — Configuration and Dependency Management

Goal: support non-trivial applications without service-locator or global-state patterns.

Planned work:

- configuration abstraction;
- environment-backed configuration;
- service registration;
- dependency scopes;
- module dependencies;
- lifecycle-aware services.

## v0.4 — Production Operations

Goal: make applications observable and diagnosable.

Planned work:

- structured logging;
- telemetry hooks;
- traces and metrics;
- health model;
- execution correlation;
- runtime diagnostics.

## v0.5 — Resilience and Security

Planned work:

- timeout and cancellation;
- retry policies;
- circuit breaking where appropriate;
- authentication integration points;
- authorization policies;
- execution limits.

## v0.6 — Plugin and Extension Model

Planned work:

- plugin contracts;
- plugin metadata;
- deterministic discovery/loading;
- compatibility model;
- extension lifecycle.

## v0.7 — Testing and Developer Experience

Planned work:

- dedicated testing utilities;
- application test harness;
- tool/middleware test helpers;
- fixtures;
- local inspector integration.

## v0.8 — CLI and Generators

Planned work:

- project creation;
- module generation;
- tool generation;
- configuration validation;
- development commands.

## v1.0 — Stable Production Framework

The 1.0 milestone requires:

- stable public package boundaries;
- documented compatibility policy;
- supported MCP transports;
- complete production lifecycle;
- observability and security extension points;
- migration guidance;
- versioned API documentation;
- representative production examples.

## Roadmap rule

A later milestone must not be used to avoid finishing an earlier one. Features may move between versions as the design evolves, but incomplete acceptance criteria remain visible until resolved.
