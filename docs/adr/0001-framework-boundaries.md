# ADR 0001: Framework package boundaries

- Status: Accepted
- Date: 2026-09-28

## Context

ForgeMCP exists to provide the application-framework layer around Model Context Protocol systems.

The official MCP SDK owns protocol behavior. ForgeMCP needs stable abstractions for application composition and execution without making every framework contract depend directly on a specific transport, SDK release, or runtime implementation.

Without a strict dependency boundary, protocol adapters and infrastructure concerns could leak into the framework kernel and make the core package difficult to reuse or evolve.

## Decision

ForgeMCP separates contracts from runtime implementations.

`@forgemcp/core` contains framework contracts and portable abstractions.

`@forgemcp/application` contains the default runtime implementations of those contracts.

The dependency direction is:

```text
@forgemcp/core
      ^
      |
@forgemcp/application
      ^
      |
adapters / transports / integrations
```

Core must not import application.

Future MCP SDK adapters, transports, observability integrations, configuration providers, and plugins should depend inward on the kernel.

## Consequences

### Positive

- core contracts remain lightweight;
- runtime implementations can evolve independently;
- protocol SDK upgrades are isolated to adapters where possible;
- applications can test framework behavior without starting an MCP transport;
- alternate implementations can satisfy core contracts.

### Trade-offs

- some concepts require both a contract and an implementation;
- package boundaries must be reviewed during API changes;
- convenience APIs cannot bypass dependency direction merely to reduce imports.

## Rule

A new dependency from `@forgemcp/core` to `@forgemcp/application`, an MCP SDK package, or an infrastructure adapter requires a new architecture decision.
