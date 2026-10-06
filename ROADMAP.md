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
- [x] static lint quality gate
- [x] architecture and contributor documentation
- [x] architecture decision records
- [x] formatting quality gate
- [x] CI execution confirmation
- [x] v0.1 release acceptance

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

### Scope

- [x] MCP server package/adapter
- [x] protocol-neutral application tool discovery
- [x] Standard Schema tool input contracts
- [x] tool registration bridge
- [x] protocol request-to-execution-context mapping
- [x] tool result mapping
- [x] stdio transport
- [x] integration tests against the official SDK
- [x] build/typecheck/lint/format/test validation
- [x] v0.2 release acceptance

### Acceptance

A developer can expose a ForgeMCP application through the official MCP TypeScript SDK, advertise schema-backed tools to an MCP client, execute validated calls through the ForgeMCP middleware pipeline, and serve the same adapter over stdio.

## v0.3 — Configuration and Dependency Management

Goal: support non-trivial applications without service-locator or global-state patterns.

### Sprint 1 — Configuration Foundation

Status: complete.

Plan: [docs/planning/v0.3-sprint-1.md](./docs/planning/v0.3-sprint-1.md)

Backlog: issues #6–#10, tracked by sprint issue #11.

Sprint 1 establishes:

- [x] configuration contracts;
- [x] deterministic source composition;
- [x] environment-backed configuration;
- [x] configuration access during module composition;
- [x] tests, documentation, and an end-to-end MCP example.

### Sprint 2 — Service Registration Foundation

Status: complete.

Plan: [docs/planning/v0.3-sprint-2.md](./docs/planning/v0.3-sprint-2.md)

Backlog: issues #22–#26, tracked by sprint issue #21.

Sprint 2 establishes:

- [x] typed service tokens;
- [x] explicit application service registration;
- [x] deterministic application-lifetime service resolution;
- [x] configuration-aware service factories;
- [x] async factory-to-factory dependency resolution;
- [x] duplicate, missing, and circular dependency diagnostics;
- [x] service access during module composition;
- [x] an end-to-end configuration → service → module → MCP example.

### Sprint 3 — Dependency Lifetimes and Execution Scopes

Status: complete.

Plan: [docs/planning/v0.3-sprint-3.md](./docs/planning/v0.3-sprint-3.md)

Backlog: issues #36–#40, tracked by sprint issue #35.

Sprint 3 establishes:

- [x] explicit application, execution, and transient lifetimes;
- [x] one isolated dependency scope per `Application.execute()`;
- [x] deterministic captive-dependency diagnostics;
- [x] scoped/transient resolution through execution context;
- [x] concurrency isolation;
- [x] end-to-end MCP validation.

### Sprint 4 — Module Dependencies and Deterministic Composition

Status: complete.

Plan: [docs/planning/v0.3-sprint-4.md](./docs/planning/v0.3-sprint-4.md)

Backlog: issues #47–#51, tracked by sprint issue #46.

Sprint 4 establishes:

- [x] explicit static module dependency metadata;
- [x] explicit selection with no hidden auto-registration;
- [x] stable dependency-first module ordering;
- [x] deterministic missing and circular dependency diagnostics;
- [x] startup integration without partial module composition;
- [x] end-to-end MCP validation.

### Later v0.3 work

After the module-dependency slice is complete:

- lifecycle-aware services.

Dependency management continues incrementally. Lifecycle-aware disposal remains later v0.3 work. Session/connection scopes, user-created child scopes, optional/conditional module dependencies, automatic constructor injection, decorators, and reflection metadata remain deliberately deferred.

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
