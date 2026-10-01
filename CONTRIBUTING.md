# Contributing to ForgeMCP

Thank you for helping improve ForgeMCP.

ForgeMCP is intended to become a production-grade application framework. Contributions should favor clear contracts, predictable runtime behavior, strong tests, and incremental architecture over speculative abstractions.

## Development requirements

- Node.js 24+
- pnpm 11.10.0
- Git

Enable Corepack and install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.10.0 --activate
pnpm install
```

## Working on a change

Create a branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/your-change
```

Use a focused branch and keep unrelated refactors out of the same pull request.

## Validation

Before requesting review:

```bash
pnpm build
pnpm package:smoke
pnpm typecheck
pnpm lint
pnpm format
pnpm test:coverage
pnpm release:verify
```

Runtime packages must maintain at least 90% coverage for statements, branches, functions, and lines. New behavior should include regression tests for success paths, failure paths, and lifecycle cleanup where applicable.

Pull requests also run dependency security checks, CodeQL analysis, and—when repository Sonar credentials are available—SonarQube Cloud analysis with a blocking Quality Gate.

## Dependency update policy

Dependabot groups routine minor and patch updates, but major version upgrades are intentionally raised as separate pull requests.

Major upgrades must not be merged as a bundle. Each major toolchain/runtime change should be reviewed independently, including migration notes and the complete CI/security/Sonar result, before it reaches `main`.

Do not merge a dependency pull request while its latest base/head validation is missing, stale, or failing.

## Architecture rules

- `@forgemcp/core` contains contracts and portable abstractions.
- `@forgemcp/application` contains runtime implementations.
- Core must never depend on application.
- Do not add protocol-specific behavior to core unless it is genuinely framework-independent.
- Avoid global mutable state.
- Prefer composition over inheritance.
- Use named exports.
- Avoid `any`; model uncertainty with `unknown`.
- Add tests for public behavior and lifecycle transitions.
- Do not add placeholder subsystems for future roadmap items.

## Public API changes

Changes to exported contracts should explain:

1. the concrete use case;
2. why the existing API cannot support it cleanly;
3. compatibility impact;
4. tests covering the new behavior.

Significant architectural decisions should be recorded under `docs/adr/`.

## Commit messages

Use concise conventional-style commit messages, for example:

```text
feat(application): add tool registry
fix(core): correct constructor type filename
test(application): cover middleware pipeline
docs: document framework architecture
```

## Pull requests

A pull request should include:

- what changed;
- why it changed;
- how it was tested;
- any public API or compatibility impact;
- intentionally deferred follow-up work.

Keep pull requests reviewable. Large roadmap items should be split into complete vertical increments rather than merged as unfinished scaffolding.
