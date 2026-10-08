# ADR 0010: Derive structured logs from diagnostic events

- Status: Accepted
- Date: 2026-10-08

## Context

ForgeMCP v0.4 Sprint 1 introduced a provider-neutral diagnostic event stream for application and execution lifecycle facts.

Structured logging is the next operations layer. It must not duplicate lifecycle instrumentation or serialize arbitrary application data by default.

MCP stdio also reserves stdout for protocol frames, so ordinary logging to stdout can corrupt the server connection.

## Decision

Structured logging consumes the existing diagnostic stream. No application or execution lifecycle code is instrumented a second time for logging.

The flow is runtime diagnostic event -> structured logging listener -> provider-neutral structured log sink.

## Provider-neutral contracts

ForgeMCP will define plain structured logging contracts independent of logging SDKs. Records carry a timestamp, stable level, diagnostic event name, deterministic message, optional Forge execution ID, and immutable attributes.

## Event-level policy

Normal lifecycle events map to info. Application start/stop failures and execution failures map to error. Dynamic level overrides are deferred.

## Correlation

ExecutionMetadata.id remains the canonical Forge execution identity. Structured execution records expose it as executionId.

MCP request/session IDs are optional supporting attributes and never replace the Forge identity.

## Attribute/privacy policy

Framework-owned diagnostic attributes such as tool.name and duration.ms may be copied by default.

Arbitrary execution attributes are excluded by default. Applications may explicitly allow selected names. There is no wildcard include-everything behavior in this sprint.

Structured logging does not automatically include raw tool input/result values, configuration values, service instances, arbitrary module state, arbitrary execution metadata, or serialized exception objects.

## Record immutability

Each emitted record is an immutable snapshot. Projected attributes are copied to a fresh frozen object and the record is frozen. Deep-freezing nested application values is not required.

## Synchronous sink boundary

Structured log sinks are synchronous. Provider buffering/export lifecycle remains outside ForgeMCP.

ForgeMCP does not own network retries, batching, queue persistence, backpressure, or provider shutdown.

## Failure isolation

Logging is observational. Mapping, sink, serialization, and write failures must not change startup, tool execution, service cleanup, or shutdown outcomes.

No recursive logging-failed diagnostic event is emitted.

## Stdio-safe built-in sink

A built-in JSON Lines sink writes to stderr only and never stdout. Each record becomes one JSON object followed by a newline; timestamps use ISO-8601.

## Consequences

Positive consequences: one lifecycle fact source, provider independence, stable execution correlation, conservative privacy defaults, stdio safety, deterministic tests, and failure isolation.

Trade-offs: applications must explicitly select execution attributes, arbitrary-object/error serialization is not built in, and provider buffering/export remains caller-owned.

## Non-decision

This ADR does not define vendor integrations, OpenTelemetry Logs, network exporters, file rotation, sampling, runtime level switches, wildcard execution-attribute logging, raw payload logging, automatic exception serialization, async sink delivery, retries, or backpressure.
