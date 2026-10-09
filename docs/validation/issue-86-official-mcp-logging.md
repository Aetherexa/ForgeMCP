# Issue #86: official MCP structured logging validation

The smallest scenario extends the existing official SDK in-memory client/server
harness, with the real `ForgeApplicationBuilder`, structured log listener, and
stderr JSON Lines sink. No production API or dependency changes are needed.

## Prerequisites

- Node.js 24 or later and pnpm 11.10.0 (the repository package manager).
- PR #91 (`490c1948d5eef9637e9f3e70aff8d2082369134d`) or its merged equivalent:
  main at `18469f2a1d6998e42e0fe46e1f9ffc86e11d171f` does not export
  `createStderrJsonLogSink` yet. This validation branch includes #91.
- Install dependencies and build workspace packages before running the test;
  workspace public imports resolve to `dist`, rather than source aliases.

## Run

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @forgemcp/mcp-server exec vitest run src/create-forge-mcp-server.logging.test.ts
```

Existing CI discovers the file automatically. Full repository checks:

```sh
pnpm release:verify
pnpm package:smoke
pnpm typecheck
pnpm lint
pnpm format
pnpm test:coverage
```

## Assertions

`packages/mcp-server/src/create-forge-mcp-server.logging.test.ts` runs the same
overlapping two-call scenario with default privacy and with explicit
`mcp.requestId`/`mcp.sessionId` selection. A barrier guarantees both tool
executions enter before either returns. Tool-captured execution metadata ties
each start/completion log pair to the canonical Forge execution ID and its
distinct SDK request ID. Metadata actually reaches the execution context,
but neither metadata nor raw inputs/outputs appears in stderr records.

The real sink emits one parseable JSON object per write, each with a single
trailing newline. stdout is intercepted and asserted unused. Successful MCP
responses and exactly one start/stop lifecycle sequence are checked, including
repeated server close. All spies are restored after shutdown, even on failure.

## Scope

This validates official SDK calls and stdio-safe sink semantics using
`InMemoryTransport`. It does not claim child-process stdio framing or process
shutdown coverage. The existing stdio delegation test and sink tests remain
complementary. No MCP credentials, external server, or Sonar token is required
to run locally. Landing this scenario on main requires #91's sink first.
