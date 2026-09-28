# Changelog

All notable changes to ForgeMCP will be documented in this file.

The project follows semantic versioning once public packages begin publishing stable releases.

## [Unreleased]

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

