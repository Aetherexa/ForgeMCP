# ADR 0002: Explicit module composition before dependency injection

- Status: Accepted
- Date: 2026-09-28

## Context

The ForgeMCP kernel needs a way for features to contribute tools and middleware to an application.

A decorator system, reflection metadata, or dependency-injection container could automate this registration. Introducing those systems in the first kernel release, however, would couple the basic execution model to infrastructure that has not yet been proven necessary.

The v0.1 milestone needs to establish what an application, module, tool, middleware pipeline, and lifecycle actually mean before adding automation around them.

## Decision

Modules use an explicit composition contract:

```ts
class ExampleModule implements Module {
  configure(builder: ModuleBuilder): void {
    builder.tool(...);
    builder.middleware(...);
  }
}
```

The application runtime instantiates registered modules and invokes `configure()` during startup.

For v0.1, module classes must be constructible without arguments.

Dependency injection, module dependencies, scopes, and service resolution are deferred to a later milestone.

## Consequences

### Positive

- composition is visible and deterministic;
- the kernel has no reflection requirement;
- module behavior is easy to test;
- tool and middleware registration semantics can stabilize before DI is designed;
- later DI work can solve demonstrated constructor/service needs rather than hypothetical ones.

### Trade-offs

- v0.1 modules cannot receive constructor-injected services;
- applications with substantial dependency graphs will need the planned dependency-management milestone;
- some registration is intentionally explicit.

## Future evolution

When dependency management is introduced, it may replace direct `new Module()` construction with a module activator or resolver.

The public module composition semantics should remain recognizable: a module contributes capabilities to an application during composition.

DI must automate construction; it must not redefine the kernel execution model.
