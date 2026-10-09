# ADR 0013: Runtime diagnostic snapshots from existing events

Status: accepted.

## Decision

Provide portable aggregate snapshot contracts in core and a provider in
application. Subscribe before startup to the existing event stream; do not add
instrumentation or mutate lifecycle state. Report observed lifecycle state, active
calls and cumulative completed/failed counts. Retain only active IDs internally,
ignore duplicates/unmatched terminals, and clear active state on lifecycle
termination. Return immutable values with no raw data or correlation identifiers.

## Consequences

Snapshot state reflects listener delivery order and attachment history. It cannot
replace admission/lifecycle APIs or process monitoring. Callers own exposure and
access control. No implicit diagnostic tool, HTTP endpoint, sampling or history is
introduced. Existing events preserve cleanup and graceful drain semantics.

See [Sprint 5](../planning/v0.4-sprint-5.md) for validation and limits.
