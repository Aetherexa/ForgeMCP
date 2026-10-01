## What changed

Describe the completed behavior, not only the implementation details.

## Why

Explain the concrete framework or user problem this change solves.

## Validation

- [ ] `pnpm build`
- [ ] `pnpm package:smoke`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format`
- [ ] `pnpm test:coverage`
- [ ] CI quality gates pass
- [ ] Security checks pass
- [ ] SonarQube Cloud Quality Gate passes when configured

## Public API impact

- [ ] No public API change
- [ ] Public API change is documented below
- [ ] Compatibility/migration impact is documented below

## Architecture

- [ ] Core remains independent of runtime and protocol adapters
- [ ] No global mutable state was introduced
- [ ] New behavior has regression coverage
- [ ] Significant architecture changes include an ADR

## Deferred work

List intentionally deferred follow-up work. Do not use this section to merge incomplete acceptance criteria.
