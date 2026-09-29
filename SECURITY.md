# Security Policy

ForgeMCP is currently a pre-release project.

## Supported versions

Until the first stable release, only the latest code on the default branch is actively maintained.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability.

Use GitHub's private vulnerability reporting feature for the `Aetherexa/ForgeMCP` repository when available. Include:

- affected component and version/commit;
- reproduction steps;
- expected and observed behavior;
- impact assessment;
- any suggested mitigation.

If private vulnerability reporting is unavailable, contact the project maintainers privately through the Aetherexa organization before disclosing details publicly.

## Scope

Security-sensitive areas may include:

- tool execution boundaries;
- transport adapters;
- authentication and authorization;
- configuration and secret handling;
- plugin loading;
- dependency management;
- request isolation;
- input validation;
- logging or telemetry that may expose sensitive data.

Security APIs are not considered stable until explicitly documented as such.


## Automated security checks

The repository uses automated checks on the default branch and pull requests:

- GitHub CodeQL analysis for JavaScript and TypeScript;
- blocking production dependency audits, plus per-PR dependency review when GitHub Dependency Graph is enabled;
- Dependabot update pull requests for npm dependencies and GitHub Actions.

Automated scanning supplements, but does not replace, private vulnerability reporting.
