# ForgeMCP

ForgeMCP is an application framework for building production-grade Model Context Protocol (MCP) systems with TypeScript.

The official MCP SDK provides protocol primitives. ForgeMCP is designed for the application layer above those primitives: composition, lifecycle, middleware, execution context, validation, configuration, dependency management, observability, resilience, testing, and developer tooling.

> **Status:** pre-release. The v0.1 framework kernel is under active development and is not yet published as a stable npm release.

## Why ForgeMCP?

A small MCP server can be assembled directly with an SDK. Larger systems need additional structure:

- predictable application startup and shutdown;
- modular feature composition;
- centralized tool discovery and execution;
- request-scoped execution context;
- middleware for cross-cutting behavior;
- testable framework boundaries;
- production concerns such as configuration, telemetry, retries, security, and health checks.

ForgeMCP aims to provide those capabilities without hiding the MCP protocol or locking applications into a heavyweight runtime.

## v0.1 Framework Kernel

The first milestone establishes the framework execution model:

```text
ForgeApplicationBuilder
        |
        v
   ModuleRegistry
        |
        v
 ForgeApplication
        |
        +--> module.configure(...)
        |        |
        |        +--> tools
        |        +--> middleware
        |
        +--> ToolRegistry
        |
        +--> ExecutionContext
        |
        +--> Middleware Pipeline
        |
        v
     Tool.execute()
        |
        v
     ToolResult
```

The kernel intentionally excludes MCP transports, dependency injection, telemetry, authentication, plugins, and CLI tooling until the core runtime is stable.

## Workspace

```text
packages/
  core/          Framework contracts and portable abstractions
  application/   Runtime implementations and application composition
```

### Package boundary

`@forgemcp/core` contains contracts. It should remain lightweight and should not depend on application runtime implementations.

`@forgemcp/application` implements those contracts and owns runtime behavior such as application lifecycle, module composition, registries, middleware execution, and tool dispatch.

## Requirements

- Node.js 24 or later
- pnpm 11.10.0
- TypeScript 5.9+

## Development

Clone the repository and install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.10.0 --activate
pnpm install
```

Validate the workspace:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Minimal application

```ts
import type {
  Module,
  ModuleBuilder,
} from "@forgemcp/core";
import {
  ForgeApplicationBuilder,
} from "@forgemcp/application";

class EchoModule implements Module {
  configure(builder: ModuleBuilder): void {
    builder.tool({
      metadata: {
        name: "echo",
        description: "Returns the supplied input.",
      },
      execute(_context, input) {
        return { value: input };
      },
    });
  }
}

const app = ForgeApplicationBuilder
  .create()
  .use(EchoModule)
  .build();

await app.start();

const result = await app.execute("echo", {
  message: "Hello ForgeMCP",
});

console.log(result.value);

await app.stop();
```

## Design principles

- **Framework, not protocol replacement.** MCP remains visible and interoperable.
- **Contracts before infrastructure.** Runtime implementations depend on stable abstractions.
- **Explicit composition.** Modules declare contributions through a small builder API.
- **No hidden global state.** Application state belongs to an application instance.
- **Production behavior is testable.** Lifecycle and execution semantics are covered by tests.
- **Progressive complexity.** DI, observability, plugins, and transports arrive only when the kernel requires them.
- **Named exports and strict TypeScript.** Public APIs should remain predictable and tree-shakeable.

## Project documents

- [Architecture](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Architecture decisions](./docs/adr/)

## License

ForgeMCP is licensed under the MIT License. See [LICENSE](./LICENSE).
