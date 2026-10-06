# ADR 0008: Use standard disposal protocols for framework-owned services

- Status: Accepted
- Date: 2026-10-06

## Context

ForgeMCP can construct services with application, execution, and transient lifetimes.

Those services may own external resources such as sockets, database pools, files, timers, exporters, or client connections. The current runtime releases references when scopes or applications end but does not invoke resource cleanup.

Adding cleanup requires more than calling a method during `Application.stop()`:

- application factory services may need rollback cleanup when startup fails;
- execution-scoped and transient services need cleanup when one execution ends;
- application shutdown must not dispose shared services while active executions still use them;
- callers may supply an existing instance through `provide(...)` and should not lose ownership of it;
- multiple cleanup failures should not stop later resources from being released.

## Decision

ForgeMCP uses the JavaScript standard disposal protocols for factory-created services:

- `Symbol.asyncDispose` when present;
- otherwise `Symbol.dispose` when present;
- no cleanup call when neither protocol is implemented.

When both are present, asynchronous disposal takes precedence.

ForgeMCP does not infer lifecycle behavior from arbitrary method names.

## Ownership boundary

Factory creation defines framework ownership.

| Registration | Owner |
| --- | --- |
| `provide(token, value)` | caller |
| `provideFactory(token, factory)` | ForgeMCP |
| `provideScopedFactory(token, factory)` | ForgeMCP |
| `provideTransientFactory(token, factory)` | ForgeMCP |

Caller-owned values are never automatically disposed, even if they implement a standard disposal symbol.

This prevents ForgeMCP from closing a shared dependency whose lifetime is managed elsewhere.

## Application ownership

Every successfully returned application factory result becomes an application ownership entry.

Application-owned services are disposed:

- during rollback when service resolution partially succeeds and later startup fails;
- during rollback when later application startup fails after service resolution;
- during normal application shutdown.

Application-owned services are disposed once in reverse successful-construction order.

## Execution ownership

Each application execution owns an internal disposable service scope.

Every successfully returned execution-scoped or transient factory result becomes an ownership entry for that execution.

Execution-owned services are disposed in reverse successful-construction order when execution settles, regardless of success or failure.

Application services resolved through an execution scope remain owned by the application runtime and are not recorded again by the execution scope.

## Reverse construction order

A service may depend on another service constructed before it.

Recording successful construction completion and disposing in reverse order guarantees the usual dependent-before-dependency cleanup:

```text
construct dependency
construct dependent

dispose dependent
dispose dependency
```

Every transient construction is a separate ownership event.

## Active execution draining

`Application.stop()` transitions the application to `Stopping` before awaiting cleanup.

That transition prevents new executions from starting.

The service runtime tracks active execution scopes. Shutdown waits for those already-created scopes to finish and dispose their execution-owned resources before application-owned resources are disposed.

This guarantees that an in-flight execution never observes an application service being disposed underneath it.

The sprint does not add timeout/cancellation behavior. An execution that never settles can therefore delay shutdown.

## Disposed scope behavior

An execution resolver is valid only for its execution boundary.

If application code captures `ExecutionContext.services` and attempts resolution after the scope is disposed, resolution fails deterministically. The runtime does not silently reopen or recreate the scope.

## Cleanup failures

Disposal is best-effort.

The runtime attempts every owned disposal hook in reverse construction order even when earlier disposal hooks fail.

Cleanup failures retain:

- the service token/description associated with the owned instance;
- the underlying thrown/rejected error;
- deterministic disposal ordering.

Multiple cleanup failures are represented together rather than losing later failures.

## Interaction with primary operation failures

Cleanup must not silently erase the error that caused rollback or execution failure.

Semantics:

- operation succeeds, cleanup fails: report cleanup failure;
- operation fails, cleanup succeeds: preserve operation failure;
- operation fails, cleanup fails: preserve both;
- shutdown cleanup fails: finish best-effort cleanup, transition to terminal `Stopped`, and report the cleanup failure.

A partially disposed application is never restored to `Started`.

## Consequences

### Positive

- resource ownership is explicit;
- JavaScript standard protocols avoid framework-specific lifecycle interfaces;
- caller-provided instances remain safe from unexpected cleanup;
- scoped and transient resources cannot leak merely because execution finished;
- dependency-safe reverse ordering is deterministic;
- application shutdown becomes safe for concurrent executions;
- rollback releases resources created before a later startup failure.

### Trade-offs

- the runtime must track active scopes and successful factory constructions;
- `Application.execute()` gains cleanup error semantics;
- `Application.stop()` may remain pending behind long-running executions;
- callers using non-standard cleanup method names must adapt their service object rather than relying on convention.

## Non-decision

This ADR does not introduce:

- method-name lifecycle inference;
- automatic cleanup for `provide(...)` values;
- finalizer-based cleanup;
- retry policies for cleanup;
- service start/readiness hooks;
- execution cancellation/timeouts;
- child scopes;
- session/connection lifetimes.
