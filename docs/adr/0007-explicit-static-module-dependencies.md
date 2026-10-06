# ADR 0007: Use explicit static metadata for module dependencies

- Status: Accepted
- Date: 2026-10-06

## Context

ForgeMCP modules currently enter an application explicitly through `ForgeApplicationBuilder.use(Module)` and configure in selection order.

That model is intentionally simple, but larger applications need a way for one independently developed module to require another module to configure first.

A module dependency model can easily become hidden discovery or a second dependency-injection system. ForgeMCP already avoids decorators, reflection metadata, constructor inspection, global registries, and implicit service lookup.

The dependency model therefore needs to preserve explicit application composition while adding deterministic graph validation and ordering.

## Decision

Module dependencies are declared as optional static metadata on the module type.

The intended shape is equivalent to:

```ts
class FeatureModule implements Module {
  static readonly dependencies = [FoundationModule] as const;

  configure(builder: ModuleBuilder): void {
    // ...
  }
}
```

The core `ModuleType` contract will expose the optional dependency metadata in a typed form.

Dependencies are identified by module constructor identity. Class names are diagnostic metadata, not graph keys.

## Explicit selection remains authoritative

Declaring a dependency does not register it.

Every module in the application graph must still be selected explicitly through `.use(Module)`.

For example:

```ts
ForgeApplicationBuilder.create()
  .use(FeatureModule)
  .use(FoundationModule)
  .build();
```

is valid even if `FeatureModule` is selected first because the planner reorders configuration.

This:

```ts
ForgeApplicationBuilder.create()
  .use(FeatureModule)
  .build();
```

fails when `FeatureModule` requires `FoundationModule`.

This rule prevents a module package from silently adding tools, middleware, or future contributions simply because another selected module references it.

## Planning boundary

ForgeMCP validates and orders the complete selected module graph before any module `configure(...)` method runs.

The planner performs a stable topological ordering:

1. dependencies always appear before dependents;
2. otherwise independent modules preserve application selection order;
3. each selected module appears once;
4. diamond dependencies are naturally deduplicated by constructor identity.

The resulting plan, not raw registration order, drives module configuration.

## Missing dependencies

Missing dependencies fail planning deterministically.

The diagnostic contains:

- the dependent module;
- the missing dependency.

No module configuration occurs before this validation succeeds.

## Circular dependencies

Cycles fail planning deterministically.

The diagnostic contains a dependency path such as:

```text
ModuleA -> ModuleB -> ModuleC -> ModuleA
```

No partial composition is exposed.

## Lifecycle behavior

Module graph planning is part of application startup.

A planning failure follows the existing startup failure contract:

- lifecycle returns to `Created`;
- tool and middleware runtime state is not exposed;
- a later `start()` may retry.

Module dependency planning does not change execution scopes or service lifetimes.

## Module instances

Dependencies express composition order and requirements only.

They do not:

- expose a dependency module instance to its dependent;
- introduce module instance lookup;
- inject constructors;
- create a module-scoped service container.

Cross-module runtime dependencies continue to use explicit service contracts or ordinary shared abstractions.

## Consequences

### Positive

- existing modules remain source-compatible;
- dependency relationships are visible on the module type;
- application selection remains explicit;
- startup ordering becomes deterministic;
- missing and circular relationships fail before partial composition;
- no reflection or decorators are required;
- module dependency graphs remain separate from service dependency graphs.

### Trade-offs

- applications must explicitly select dependency modules;
- static metadata cannot vary by request;
- optional/conditional dependencies need a future design;
- module packages cannot silently bootstrap their own transitive module graph.

## Non-decision

This ADR does not introduce:

- automatic dependency registration;
- optional dependencies;
- conditional dependencies;
- constructor injection;
- decorators or reflection metadata;
- module instance lookup;
- runtime module loading/unloading;
- plugin discovery.
