# ADR 0014: Optional OpenTelemetry adapter and explicit remote parents

Status: accepted.

## Decision

Place vendor dependencies in `@forgemcp/telemetry-otel`. Adapt existing completed
execution records to caller-supplied OpenTelemetry tracer and meter. Preserve
Forge execution IDs as attributes; use OpenTelemetry's own trace/span IDs. Emit
counter and histogram measurements with the existing low-cardinality labels.
Never register globals or own providers/exporters.

Accept a W3C remote parent only after explicit MCP capture, attribute selection
and sink trust configuration. Use the official W3C propagator from a fresh root
context for each span. Do not pass propagation fields as span attributes or copy
baggage. Filter selected attributes to finite primitive values. No error payloads
or exception descriptions are added.

## Consequences

OpenTelemetry is optional and core/application remain provider-neutral. SDK
sampling/export/flush/shutdown policy stays application-owned. Completed span
export preserves lifecycle and isolation but cannot establish live tool-body
context, create outbound propagation or support automatic nested instrumentation.
Those capabilities require a separate execution-context design.

See [Sprint 6](../planning/v0.4-sprint-6.md) for validation and trust boundaries.
