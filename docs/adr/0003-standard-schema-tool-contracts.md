# ADR 0003: Use Standard Schema for tool input contracts

- Status: Accepted
- Date: 2026-09-29

## Context

ForgeMCP tools need machine-readable input schemas so protocol adapters can advertise argument shapes and validate calls before application execution.

Making `@forgemcp/core` depend directly on the MCP SDK would violate the kernel boundary established in ADR 0001. Making core depend directly on one validation library such as Zod would also unnecessarily restrict applications and adapters.

The MCP TypeScript SDK v2 accepts schemas implementing both Standard Schema and Standard JSON Schema. Zod v4, ArkType, and compatible Valibot schemas can satisfy those contracts.

## Decision

ForgeMCP represents tool input schemas through the vendor-neutral contracts from `@standard-schema/spec`.

`ToolMetadata<TInput>` may expose an optional `inputSchema` implementing both:

- `StandardSchemaV1<TInput, TInput>` for validation;
- `StandardJSONSchemaV1<TInput, TInput>` for machine-readable schema generation.

The `@forgemcp/mcp-server` adapter passes this schema to the official MCP SDK when registering a tool.

Tools without an input schema are treated as zero-input tools by the MCP adapter.

## Consequences

### Positive

- core remains independent of MCP SDK packages;
- applications are not locked to Zod;
- protocol adapters can advertise accurate JSON Schema;
- the official MCP SDK performs argument validation before ForgeMCP execution;
- schema inference remains available to application authors.

### Trade-offs

- schema libraries must support both Standard Schema and Standard JSON Schema;
- older validation-library versions may require an upgrade or adapter;
- schema validation behavior is partly delegated to the schema implementation and protocol adapter.

## Rule

Protocol adapters may consume `ToolInputSchema`, but protocol-specific schema types must not be added to `@forgemcp/core`.

If a future adapter requires schema capabilities beyond Standard Schema and Standard JSON Schema, that requirement should be evaluated as a separate architecture decision.
