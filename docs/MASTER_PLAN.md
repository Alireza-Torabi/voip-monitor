# Master plan

Status: 2026-09-23. Checkboxes reflect verified work. Phase 1 has no monitoring functionality.

## Phase 0 — environment discovery

- [x] Inspect OS, workspace, Git, GitHub CLI, Docker, Compose, Node.js, npm, and files.
- [x] Record observed state; install no system packages and contact no PBX.

## Phase 1 — public repository foundation

### Completed

- [x] Initialize local `main`; keep private `.local/` and runtime paths ignored.
- [x] Create public policy files, English/Persian README and documentation pairs, official Apache-2.0 LICENSE, and ownership-neutral NOTICE.
- [x] Record architecture, decisions, project context, and planned direct dependency license review.
- [x] Add npm workspace manifests, Node.js 24 LTS target, strict TypeScript base config, and documented lint/format/test/build strategy.
- [x] Add service-free Compose foundation and runtime data/secret layout.
- [x] Add CI for existing foundation checks using synthetic/public files only.
- [x] Run the foundation checker and review public files for obvious secrets.

### Remaining in this phase

- [ ] Review staged diff and create a clean initial commit using a user-supplied Git author identity.
- [x] Configure `origin` to the exact user-supplied GitHub URL after confirming no conflicting remote.
- [ ] Push `main` normally after secret review; do not alter authentication or force push.
- [ ] Record final commit/push outcome in this plan.

### Toolchain-dependent gates

- [ ] Generate an npm lockfile and audit exact resolved dependency licenses when an approved Node/npm toolchain is available.
- [ ] Run TypeScript lint, format, typecheck, test, and build gates when source code and dependencies exist.
- [ ] Validate Docker Compose and build images when Docker and service build contexts exist.

These gates are not claimed as passing in Phase 1. No software was installed in Phase 1. The currently executable CI gate is the Python foundation checker. Local tool availability is recorded only in ignored `.local/`.

## Future phases — pending approval

- [ ] Phase 2: application foundation: backend/frontend skeletons, shared contracts, configuration, SQLite migrations, health endpoints, i18n, and first-run state model.
- [ ] Phase 3: authentication and onboarding.
- [ ] Phase 4: Asterisk provider and mock AMI.
- [ ] Phase 5: telephony state engine.
- [ ] Phase 6: system metrics.
- [ ] Phase 7: security monitoring.
- [ ] Phase 8: authenticated API and realtime.
- [ ] Phase 9: bilingual dashboard.
- [ ] Phase 10: history and retention.
- [ ] Phase 11: hardening, backup, and tested restore.
- [ ] Phase 12: release validation.

After Phase 1 Git operations, stop and await approval before Phase 2.
