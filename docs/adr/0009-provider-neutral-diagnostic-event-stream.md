# ADR 0009: Use a provider-neutral diagnostic event stream

- Status: Accepted
- Date: 2026-10-08

## Context

ForgeMCP v0.4 introduces Production Operations concerns such as structured logging, telemetry, traces, metrics, health, execution correlation, and runtime diagnostics.

Those features all need access to the same runtime facts:

- application lifecycle transitions;
- tool execution lifecycle;
- execution identity;
- execution duration;
- transport correlation metadata;
- failures.

Embedding a logger or OpenTelemetry SDK directly into the kernel would couple framework behavior to one operations stack and make provider choice part of core runtime semantics.

ForgeMCP already has a stable execution identity through `ExecutionMetadata.id`. The MCP adapter also contributes request/session identifiers through execution attributes.

The framework therefore needs a provider-neutral observation boundary rather than a second correlation system.

## Decision

ForgeMCP will expose runtime diagnostics through an explicit, application-local diagnostic listener model.

The intended contracts are equivalent to:

```ts
interface DiagnosticEvent {
  readonly name: string;
  readonly timestamp: Date;
  readonly attributes: Readonly<Dictionary<unknown>>;
  readonly execution?: ExecutionMetadata;
}

interface DiagnosticListener {
  onEvent(event: DiagnosticEvent): void;
}
```

Exact contract names/shapes may be refined during implementation without changing this architectural decision.

## Correlation identity

`ExecutionMetadata.id` is the canonical Forge execution correlation identity.

ForgeMCP will not create a second framework-level correlation ID for diagnostics.

Transport identifiers remain metadata attached to the execution.

For MCP:

- `mcp.requestId` remains an execution attribute;
- `mcp.sessionId` remains an execution attribute when available;
- `mcp.meta` remains an execution attribute when available.

A future tracing integration may add trace/span identifiers, but those identifiers supplement rather than replace the Forge execution ID.

## Explicit application-local registration

Diagnostic listeners are registered explicitly through the application builder.

There is no process-global listener registry.

Consequences:

- application instances remain isolated;
- tests can capture one application's events deterministically;
- applications can use different operational backends in the same process;
- framework packages do not depend on ambient logger state.

Listener registration order is preserved.

## Synchronous observation boundary

The listener contract is synchronous.

This does not require telemetry export itself to be synchronous.

Listeners may call provider SDKs that buffer/export asynchronously.

The framework does not own:

- exporter queues;
- network retries;
- batch intervals;
- exporter shutdown;
- telemetry backpressure.

This keeps application/tool latency independent from arbitrary exporter network operations.

## Stable event naming

Framework events use stable machine-readable dot-separated names.

The initial lifecycle vocabulary is:

Application:

- `application.starting`;
- `application.started`;
- `application.start.failed`;
- `application.stopping`;
- `application.stopped`;
- `application.stop.failed`.

Execution:

- `execution.started`;
- `execution.completed`;
- `execution.failed`.

Existing names should remain backward-compatible once public.

## Payload/privacy boundary

Framework diagnostics report runtime facts.

ForgeMCP does not automatically include raw:

- tool inputs;
- tool results;
- configuration values;
- service instances;
- arbitrary module state.

This reduces accidental secret leakage and high-cardinality telemetry.

Execution metadata may be attached to execution events because it is already part of the runtime execution context.

Concrete logging adapters must define an explicit policy before serializing arbitrary execution attributes.

## Listener failure semantics

Diagnostics are observational rather than transactional.

A listener failure does not change the result of the operation being observed.

The runtime:

- isolates listener exceptions;
- continues notifying later listeners;
- does not fail startup/tool execution/shutdown because a listener threw;
- does not recursively publish a listener-failed event.

A later runtime-diagnostics feature may expose listener failure counts through a separate bounded state model.

## Lifecycle event semantics

Application lifecycle events represent externally visible operation boundaries.

A startup failure event is emitted after startup rollback cleanup completes.

A stop failure event is emitted after best-effort cleanup completes; the application remains terminal according to the existing lifecycle contract.

Execution terminal events are emitted after execution-scope cleanup completes.

Therefore execution duration measures the complete Forge execution promise boundary, including request-owned cleanup.

## Concurrency

Event delivery preserves causal order within one execution.

No global ordering guarantee exists across concurrent executions.

Consumers correlate concurrent events using `execution.id`.

## MCP boundary

The MCP adapter does not create a second diagnostics system.

It continues mapping protocol request context into Forge execution attributes before calling `Application.execute()`.

The application diagnostic stream therefore observes the same execution lifecycle regardless of whether execution originated from a direct application caller or the official MCP adapter.

No MCP SDK type enters the core diagnostics contracts.

## Relationship to structured logging and telemetry

The diagnostic event stream is the source, not the final operations backend.

Future v0.4 work may provide:

- structured logging adapters;
- OpenTelemetry integration;
- traces;
- metrics;
- health state;
- runtime diagnostic snapshots.

Those features should consume the same provider-neutral runtime facts instead of adding independent lifecycle instrumentation.

## Consequences

### Positive

- no logging/telemetry vendor lock-in;
- one canonical Forge execution identity;
- no process-global operational state;
- deterministic testing;
- a shared source for logs/traces/metrics;
- payload leakage is minimized by default;
- telemetry failures cannot break business execution.

### Trade-offs

- listener callbacks must remain lightweight;
- async exporters need their own buffering/provider lifecycle;
- listener failures are not surfaced through the same event stream;
- later logging/telemetry adapters still need policy for levels, sampling, redaction, and export.

## Non-decision

This ADR does not define:

- a concrete logger;
- log levels;
- OpenTelemetry SDK integration;
- trace/span propagation;
- metrics instruments;
- health/readiness semantics;
- runtime diagnostics storage;
- sampling;
- redaction of arbitrary execution attributes;
- async listener queues;
- listener retries.
