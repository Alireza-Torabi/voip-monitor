# Toolchain and quality gates

Status: Phase 1 configuration only. No application code or dependency lockfile exists. Local tool availability is kept in ignored `.local/`.

## Package management

Use npm workspaces in the root `package.json` for `backend`, `frontend`, and `shared`. Target Node.js 24 LTS. Pin exact direct dependency versions and commit one npm lockfile when an approved Node/npm toolchain is available. Use `npm ci` in CI after the lockfile exists. Do not manually fabricate a lockfile or install packages on the PBX.

## TypeScript

`tsconfig.base.json` defines strict common rules. Add workspace-specific configs when source files exist: NodeNext for backend/shared, browser-oriented bundler resolution for frontend, with project references or explicit type-only imports as needed. Shared contracts must remain provider-neutral and serializable. There are no TypeScript inputs to typecheck yet.

## Lint, format, test, build

Add ESLint and a compatible TypeScript plugin, plus a pinned formatter, when the first source code is introduced. Prefer one root policy with narrow workspace overrides. Add meaningful unit tests for parsers/state, synthetic integration tests with mock AMI, and frontend tests when those components exist. CI should then run lint, format check, typecheck, tests, both builds, image builds, and resolved dependency license review. These commands are not advertised as passing while no source or toolchain exists.

Current CI runs only `python3 scripts/check_foundation.py`. It checks public-file presence, ignore rules, selected credential patterns, workspace metadata, and Persian RTL container placement. It does not replace a dedicated secret scanner or full license audit. A later CI update must add both before a production release.

## Compose

`docker-compose.yml` is a syntactically simple service-free foundation. Backend, frontend, and reverse proxy services will be added only after build contexts, runtime configuration, and health checks exist. The deployment host chooses a persistent directory mounted at `/data`; database, encrypted credentials, and master key stay outside Git. Docker Compose validation must run after services and Docker build contexts are added.
