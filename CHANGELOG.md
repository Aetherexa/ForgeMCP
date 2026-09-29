# Changelog

All notable changes to ForgeMCP will be documented in this file.

The project follows semantic versioning once public packages begin publishing stable releases.

## [Unreleased]

### Added

- runtime coverage thresholds and coverage artifacts in CI;
- regression tests for application isolation, lifecycle cleanup, MCP request metadata, stdio delegation, and result serialization edge cases;
- package entry-point smoke tests and package tarball validation;
- CodeQL scanning and dependency-review workflow;
- Dependabot updates for npm dependencies and GitHub Actions;
- tag-driven GitHub Release delivery workflow with package-version verification;
- SonarQube Cloud scan configuration with LCOV ingestion and blocking Quality Gate support.


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

