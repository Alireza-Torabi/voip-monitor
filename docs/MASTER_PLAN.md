# Master plan

Status: 2026-09-25. Phase 1 public repository foundation is complete. Phase 2 Task 9 provider runtime lifecycle and authenticated AMI connection-test/discovery foundation is implemented on `feature/provider-runtime-lifecycle`. PR #10 is open and its current checks pass after the CI source-tracking fix described below. Network access remains disabled by default and no real PBX has been contacted.

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

### GitHub closure

- [x] Review staged diff and create the clean initial commit with the user-supplied repository-only Git identity.
- [x] Configure `origin` to the user-supplied repository after confirming no conflicting remote.
- [x] Push the initial foundation commit to GitHub; `main` tracks `origin/main`.
- [x] Verify remote `main` points to `974f0cb2ec471878d58c71639e904bca48bb8aaf` (`chore: establish public repository foundation`).

The earlier local commit `e735f1c` was amended before publication to use the requested noreply identity. It is not in `origin/main` ancestry. The published foundation commit is `974f0cb`.

### Deferred toolchain-dependent gates

- [x] Generate one npm lockfile and audit resolved license identifiers (completed in Phase 2 Task 1).
- [x] Run lint, format, typecheck, tests, and builds for the initial skeleton (completed in Phase 2 Task 1).
- [ ] Validate Docker Compose and build images when Docker and service build contexts exist.

These later checks do not change the historical Phase 1 validation record. Docker validation remains deferred. Local tool availability is recorded only in ignored `.local/`.

## Phase 2 — application foundation

- [x] Task 1: approved local Node 24/npm toolchain, minimal backend `GET /health`, bilingual React shell, one lockfile, quality gates, and CI. Local validation passed; the feature branch was merged into `main` as `e737abd`.
- [x] Task 2: provider-neutral shared contracts, typed capability and source-health models, centralized validated application configuration, and safe configuration errors/log redaction. No PBX or persistence behavior.
- [x] Task 3: SQLite storage abstraction, transactional migration history, setup and minimal PBX metadata persistence, and application readiness.
- [x] Task 4: protected master-key lifecycle, AES-256-GCM PBX secret persistence, readiness integration, and recovery documentation.
- [x] Task 5: protected first-administrator bootstrap, local password authentication, server-side sessions, CSRF and attempt limits, and setup-state transition.
- [x] Task 6: authenticated PBX profile CRUD, provider-scoped AMI metadata, encrypted write-only credentials, configured-unverified setup state, and bilingual setup/login/onboarding UI. No PBX network access.
- [x] Task 7: Asterisk provider network-boundary policy, injected address-resolution boundary, and mock AMI transport foundation. No real DNS lookup, socket, AMI login, or PBX access.
- [x] Task 8: plain TCP AMI wire transport, safe action framing/ActionID/timeout handling, Node DNS resolver boundary, and an Asterisk provider login/discovery/reconcile foundation. Tests use only mocks and a synthetic loopback AMI server; runtime startup still creates no PBX connection.
- [x] Task 9: provider runtime lifecycle with one managed provider per enabled PBX, bounded reconnect/backoff and reconciliation, explicit network enablement, authenticated provider-status and connection-test/discovery APIs, persisted verification timestamp, and bilingual connection-test UI. Tests remain mock/synthetic only; no real PBX access.
- [ ] Proposed next task: AMI event-subscription and normalized provider-event foundation, implemented against synthetic/mock AMI streams before any real PBX test.

### Current execution handoff

- Current branch: `feature/provider-runtime-lifecycle`.
- Current PR: #10, targeting `main`.
- Task 9 implementation commit: `7439e6b` (`feat(provider): add runtime lifecycle and connection verification`).
- Task 9 CI fix commit: `8fef26d` (`fix(ci): track provider runtime source`).
- Both GitHub Actions checks for `8fef26d` are green. Task 9 is ready to merge after normal PR review.
- Exact next task after merge: Task 10, AMI event subscription and normalized provider-event foundation, synthetic/mock first.
- Real PBX access still requires separate explicit approval.

### Failure and bug log

- **Task 9 CI failure — resolved:** the original `.gitignore` rule `runtime/` matched every directory named `runtime`, including `backend/src/providers/runtime/`. The runtime manager source existed locally but was ignored/untracked, so local typecheck passed while a clean GitHub checkout failed at typecheck because the imported module was missing. Fix: root-anchor the runtime-data rule as `/runtime/`, track `backend/src/providers/runtime/index.ts`, and narrow the foundation checker so only top-level private/runtime directories are rejected. Full local gates then passed and both GitHub Actions checks passed.
- **Open Task 9 defects:** none currently known from the automated suite. The production limitations listed below remain planned work, not resolved features.

### Persistent continuation protocol

For every future task/session:

1. Read `AGENTS.md`, this `MASTER_PLAN.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md`, and ignored `.local/DEPLOYMENT_CONTEXT.md` when present.
2. Inspect Git branch/status/log and synchronize `main` before creating the next feature branch.
3. Preserve the rule that no real PBX is contacted or modified without explicit approval.
4. Before finishing a task, update this master plan with: task result, branch/commit/PR state, failures or bugs found and their resolution/status, known limitations, and the exact next task. Update `PROJECT_CONTEXT.md` and `DECISIONS.md` when architecture/current state changes.
5. Run the repository gates, public/secret review, commit atomically, push normally, then stop for approval/merge.
6. Never place Remote Desktop device IDs, real PBX details, credentials, or private deployment facts in tracked public documentation.

## Future phases — pending approval

Tasks 7–9 already implemented substantial Asterisk-provider foundation work earlier than the original high-level phase buckets. Task 10 continues that provider foundation; the phase labels below describe the remaining product roadmap rather than implying that completed provider work must be repeated.

- [ ] Phase 3: account management and onboarding refinement.
- [~] Phase 4: Asterisk provider integration — network policy, AMI transport, login/discovery, runtime lifecycle, and connection verification foundations are implemented; event subscription and normalized event flow are next.
- [ ] Phase 5: telephony state engine.
- [ ] Phase 6: system metrics.
- [ ] Phase 7: security monitoring.
- [ ] Phase 8: authenticated API and realtime.
- [ ] Phase 9: bilingual dashboard.
- [ ] Phase 10: history and retention.
- [ ] Phase 11: hardening, backup, and tested restore.
- [ ] Phase 12: release validation.

Phase 1 is closed. Stop after Phase 2 Task 9 and await approval for the next task.
