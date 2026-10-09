# ADR 0012: Explicit application health and readiness

- Status: Accepted
- Date: 2026-10-09

## Decision

Core defines portable health status, check, report and provider contracts.
Application exposes `createApplicationHealth(application, options)` as an explicit
observer of lifecycle state. Existing application interfaces, execution admission,
startup, shutdown and diagnostics remain unchanged.

Liveness is up in Starting, Started and Stopping, and down in Created or Stopped.
This describes application lifecycle availability, not process/event-loop health.
Readiness is up only while Started and all explicitly registered dependency
checks return up. Dependencies never affect liveness. A started application with
no dependency checks is ready.

## Probe semantics

Each readiness invocation runs its checks concurrently with independent per-check
observation deadlines (1000 ms by default), retaining registration order in the
report. It does not probe when the application is not Started. The lifecycle is
read again after probes so successful checks cannot restore readiness during
shutdown. Health is observational and does not gate tool execution automatically.

Timeouts bound asynchronous observation, not provider I/O or synchronous work.
Timed-out I/O can continue, so providers must bound their own operations. Late
rejections are consumed and deadline timers are cleared. No background scheduler,
cache, retries, exporter or cancellation policy is added.

## Privacy and exposure

Reports contain only kind, status, lifecycle state, and check names/statuses with
safe failure codes. Raw exception text, stacks, provider objects and arbitrary
payloads are never included. Check names are application-chosen operator labels
and must not contain secrets. Reports, arrays and results are frozen snapshots.

Health is not automatically exposed over HTTP or MCP. Applications choose routes,
authorization and, if desired, explicit MCP tools. The provider creates no listener,
connection, service instance or application-owned resource.

## Consequences

Operators can distinguish dependency readiness from lifecycle availability while
preserving graceful drain and deterministic cleanup. No breaking changes are
required to Application or the official MCP adapter. Process supervision,
event-loop responsiveness, HTTP status mapping, health caches and cooperative
provider/tool cancellation require separate work.
