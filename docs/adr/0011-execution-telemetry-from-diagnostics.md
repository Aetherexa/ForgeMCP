# ADR 0011: Derive execution telemetry from diagnostics

- Status: Accepted
- Date: 2026-10-09

## Decision

Execution telemetry consumes the existing diagnostic stream rather than adding
runtime instrumentation. Core defines portable completed spans, individual
counter/duration measurements and a synchronous telemetry sink. Application
implements an explicit application-local listener. The caller supplies provider
adapters and owns export queues, aggregation, flush and shutdown.

## Correlation and privacy

Forge execution IDs remain canonical span correlation identifiers, not vendor
trace IDs. MCP identifiers are optional explicitly selected span attributes.
Metrics carry only registered tool name and terminal status; execution/request/
session IDs must never become metric dimensions. Arbitrary execution metadata,
raw inputs/results and exception objects/text are excluded by default.

## Lifecycle and isolation

One listener belongs to one application. Starts are paired with terminal events;
terminal delivery releases tracked state before calling providers. Duplicate or
unmatched terminal events are ignored, and terminal application lifecycle events
clear incomplete state. Each provider callback is isolated independently.
A missing terminal event is retained until reset/shutdown; no synthetic completion
or background cleanup is inferred. Duration uses the existing cleanup-inclusive
framework measurement with timestamp fallback for invalid external events.

## Consequences

The framework remains portable and avoids exporter dependencies or duplicate
lifecycle logic. Completed spans support retrospective provider translation;
they do not establish live distributed trace context during tool execution.
Provider-level parent propagation, sampling and exporter lifecycle require a
separate future adapter. Metrics are measurements, not an in-framework collector.
