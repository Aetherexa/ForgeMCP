# ADR 0004: Resolve configuration before module composition

- Status: Accepted
- Date: 2026-10-01

## Context

ForgeMCP modules need application configuration for real production concerns such as API endpoints, feature flags, timeouts, and credentials supplied by deployment environments.

Reading `process.env` directly inside modules or tools would couple application code to Node process-global state, make tests less deterministic, and make future configuration providers harder to compose.

Introducing a dependency-injection container before configuration has established the construction requirements would add unnecessary framework complexity.

## Decision

ForgeMCP introduces protocol-neutral configuration contracts in `@forgemcp/core`:

- `Configuration`;
- `ConfigurationValues`;
- `ConfigurationSource`;
- canonical configuration-key normalization;
- `ConfigurationKeyNotFoundError`.

`ForgeApplicationBuilder` accepts explicit values with `configure(...)` and arbitrary sources with `configureFrom(...)`.

Configuration sources resolve sequentially during application startup. Later sources override earlier sources. Resolution completes before module composition begins.

The resolved immutable `Configuration` is exposed through `ModuleBuilder.configuration`.

`@forgemcp/application` provides:

- immutable `ForgeConfiguration`;
- `StaticConfigurationSource`;
- `EnvironmentConfigurationSource`;
- deterministic source resolution.

Environment variables are opt-in and prefix-scoped. A variable such as `MYAPP_DATABASE__URL` with prefix `MYAPP_` maps to canonical key `database.url`.

## Consequences

### Positive

- modules and tools do not need to read `process.env`;
- tests can provide deterministic in-memory values;
- source precedence is explicit and repeatable;
- configuration remains independent of MCP transports;
- failed configuration resolution participates in application startup rollback;
- future remote or secrets-backed sources can implement the same small contract.

### Trade-offs

- configuration values are strings in this foundation slice; parsing and domain validation remain the consumer's responsibility;
- adding `configuration` to `ModuleBuilder` expands a public pre-1.0 contract;
- environment configuration requires applications to choose a prefix deliberately.

## Non-decision

This ADR does not introduce service registration, constructor injection, dependency scopes, decorators, reflection metadata, hot reload, or secrets-manager integrations. Those require separate evidence and architecture decisions.
