# Changelog

All notable changes to ForgeMCP will be documented in this file.

The project follows semantic versioning once public packages begin publishing stable releases.

## [Unreleased]

### Added

- protocol-neutral configuration contracts with canonical key semantics;
- deterministic configuration-source composition with later-source precedence;
- immutable runtime configuration and required-value errors;
- prefix-scoped environment-backed configuration;
- module access to resolved configuration through `ModuleBuilder.configuration`;
- end-to-end configuration coverage through the MCP adapter;
- typed identity-based service tokens and read-only service-provider contracts;
- explicit service value and factory registration on `ForgeApplicationBuilder`;
- deterministic application-lifetime service resolution during startup;
- configuration-aware asynchronous service factories;
- missing, duplicate, and circular service dependency diagnostics;
- resolved service access through `ModuleBuilder.services`;
- lifecycle rollback and retry behavior for failed service construction;
- end-to-end configuration → service → module → MCP integration coverage;
- explicit application, execution-scoped, and transient service lifetimes;
- execution-scoped and transient factory registration on `ForgeApplicationBuilder`;
- one isolated service scope per `Application.execute()` invocation;
- request-local service resolution through `ExecutionContext.services`;
- deterministic captive-dependency diagnostics for invalid application-to-shorter-lived dependencies;
- sequential and concurrent execution-scope isolation;
- end-to-end lifetime validation through the official MCP client/server path;
- explicit static module dependency metadata through `ModuleType.dependencies`;
- deterministic dependency-first module composition with stable ordering for independent modules;
- missing and circular module dependency diagnostics before partial application composition;
- exactly-once module configuration for shared diamond dependencies;
- module graph validation before configuration resolution, service construction, and module configuration;
- end-to-end module dependency validation through the official MCP client/server path;
- framework ownership tracking for factory-created application, execution-scoped, and transient services;
- standard `Symbol.asyncDispose` / `Symbol.dispose` cleanup with async-dispose precedence;
- reverse-successful-construction-order cleanup for owned service graphs;
- startup rollback cleanup for partially constructed application service graphs;
- execution-scope cleanup on both successful and failed tool invocations;
- best-effort deterministic service-disposal diagnostics that preserve all cleanup failures;
- graceful application shutdown that rejects new executions and drains active executions before application-service cleanup;
- end-to-end lifecycle-aware disposal validation through the official MCP client/server path;
- runtime coverage thresholds and coverage artifacts in CI;
- regression tests for application isolation, lifecycle cleanup, MCP request metadata, stdio delegation, and result serialization edge cases;
- package entry-point smoke tests and package tarball validation;
- CodeQL scanning and dependency-review workflow;
- Dependabot updates for npm dependencies and GitHub Actions;
- tag-driven GitHub Release delivery workflow with package-version verification;
- SonarQube Cloud scan configuration with LCOV ingestion and blocking Quality Gate support.

### Changed

- MCP server close now waits for ForgeMCP application drain and service cleanup before the returned close promise resolves;
- externally supplied `provide(token, value)` instances remain caller-owned even when they implement standard disposal symbols.


## [0.2.0] - 2026-09-29

### Added

- `@forgemcp/mcp-server` adapter for the official MCP TypeScript SDK v2;
- Standard Schema and Standard JSON Schema support for tool input definitions;
- protocol-neutral application tool discovery;
- MCP request-context mapping into ForgeMCP execution attributes;
- MCP tool-result mapping;
- stdio serving through the official SDK's `serveStdio`;
- in-memory integration tests using the official MCP client/server transports.

### Changed

- `Application` now exposes running tool metadata through `listTools()`;
- `ToolMetadata` is generic by input type and can carry a Standard Schema input contract.

## [0.1.0] - 2026-09-28

### Added

- application lifecycle runtime;
- explicit module composition contract;
- module registry integration;
- tool registry with duplicate-name validation;
- request-scoped execution context;
- executable middleware pipeline with input transformation and short-circuiting;
- application-level tool execution;
- kernel unit tests;
- GitHub Actions validation workflow;
- initial architecture and roadmap documentation.

### Changed

- middleware contracts now carry input and tool results through the pipeline;
- module constructors are explicitly runtime-instantiable;
- application contract now exposes tool execution.

### Fixed

- corrected the misspelled `cosntructor.ts` type filename.

