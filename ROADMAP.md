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

### Sprint 5 — Lifecycle-Aware Service Disposal

Status: complete.

Plan: [docs/planning/v0.3-sprint-5.md](./docs/planning/v0.3-sprint-5.md)

Backlog: issues #58–#62, tracked by sprint issue #57.

Sprint 5 establishes:

- [x] explicit framework/caller service ownership;
- [x] standard async/sync disposal support for factory-created services;
- [x] reverse-order application and execution-scope cleanup;
- [x] startup rollback cleanup;
- [x] graceful shutdown that drains active execution scopes;
- [x] deterministic cleanup failure semantics;
- [x] end-to-end MCP disposal validation.

### v0.3 Release Acceptance

Status: in progress.

Tracked by issue #69.

Release acceptance establishes:

- [x] all planned v0.3 implementation sprints complete;
- [x] root and public package manifests target `0.3.0`;
- [x] lifecycle-aware configuration/dependency behavior documented;
- [ ] release package smoke coverage and metadata validation;
- [ ] final build/typecheck/lint/format/test/coverage/security/Sonar gates;
- [ ] release-ready main commit for the `v0.3.0` tag.

### Later v0.3 work

The implementation scope for v0.3 Configuration and Dependency Management is complete. Release acceptance is the final checkpoint before the milestone can be tagged.

Session/connection scopes, user-created child scopes, optional/conditional module dependencies, automatic constructor injection, decorators, reflection metadata, execution cancellation, and disposal retry policies remain deliberately deferred.

## v0.4 — Production Operations

Goal: make applications observable and diagnosable.

### Sprint 1 — Observability Foundation and Execution Correlation

Status: complete.

Plan: [docs/planning/v0.4-sprint-1.md](./docs/planning/v0.4-sprint-1.md)

Backlog: issues #72–#76, tracked by sprint issue #71.

Sprint 1 establishes:

- [x] provider-neutral diagnostic event/listener contracts;
- [x] explicit application-local diagnostic listener registration;
- [x] stable application and execution lifecycle events;
- [x] canonical correlation through the existing Forge execution ID;
- [x] diagnostic privacy boundaries that exclude raw input/result payloads by default;
- [x] listener failure isolation;
- [x] end-to-end MCP execution-correlation validation.

### Sprint 2 — Structured Logging

Status: complete.

Plan: [docs/planning/v0.4-sprint-2.md](./docs/planning/v0.4-sprint-2.md)

Backlog: issues #82–#87, tracked by sprint issue #81.

Sprint 2 establishes:

- [x] provider-neutral structured logging contracts;
- [x] deterministic diagnostic-event to log-level/message mapping;
- [x] canonical Forge execution correlation in structured records;
- [x] conservative execution-attribute privacy with explicit allowlisting;
- [x] immutable structured log records;
- [x] stdio-safe JSON Lines output to stderr;
- [x] end-to-end MCP structured logging validation.

### Sprint 3 — Execution telemetry adapters, traces and metrics

Status: implementation complete; acceptance tracked by issue #94.

Plan: [docs/planning/v0.4-sprint-3.md](./docs/planning/v0.4-sprint-3.md)

- [x] provider-neutral execution span/metric/sink contracts;
- [x] explicit diagnostic-derived telemetry listener;
- [x] correlated completed spans with success/failure status;
- [x] count and cleanup-inclusive duration measurements;
- [x] private span attributes and low-cardinality metric dimensions;
- [x] provider failure isolation and application-local state cleanup;
- [x] official MCP concurrency/failure/cleanup validation;
- [ ] CI/security/Sonar acceptance and merge.

### Later v0.4 work

After execution telemetry:

- concrete vendor adapters and distributed context propagation;
- health model;
- runtime diagnostics.

These later slices should continue consuming the same provider-neutral diagnostic source rather than creating independent lifecycle instrumentation.

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
