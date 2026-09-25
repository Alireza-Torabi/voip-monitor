# Master plan

Status: 2026-09-25. Phase 1 public repository foundation is complete. Task 11 is merged into `main` as PR #12. Phase 2 Task 12 controlled real-PBX compatibility verification is in progress on `feature/real-pbx-compatibility-verification`. The public/local-only verification tooling and runbook are prepared; no real PBX has been contacted yet and no telephony state engine exists yet.

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
- [x] Task 10: AMI transport event subscription, provider-neutral normalized event contracts, Asterisk event normalization, and runtime event forwarding. Synthetic coverage includes channel lifecycle/state, dial lifecycle, bridge membership, and chan_sip peer status; raw AMI payloads are not forwarded to consumers.
- [x] Task 11: ActionID-correlated AMI event-list actions, `CoreShowChannels` provider snapshots, minimal provider-neutral channel snapshots, initial snapshot publication, and periodic reconciliation snapshots. Partial/cancelled/inconsistent lists fail closed; snapshot degradation does not cause a reconnect storm.
- [~] Task 12: controlled read-only real-PBX compatibility verification of the Asterisk 13.x baseline and Task 8–11 AMI assumptions. Local-only interactive credential preparation, a bounded verifier, bilingual runbook, CI syntax checks, and safe result storage are prepared. The real-PBX execution is waiting only for operator-supplied local inputs and explicit target readiness.
- [ ] Proposed next task after Task 12 passes: telephony state engine foundation that combines authoritative snapshots with buffered normalized live events.

### Current execution handoff

- Current branch: `feature/real-pbx-compatibility-verification` from clean synchronized `main` after Task 11 merged as PR #12.
- Task 12 preflight tooling is implemented locally but not yet committed or pushed: `scripts/setup-real-pbx-verification.sh`, `scripts/verify-real-pbx-compatibility.mjs`, bilingual verification runbooks, CI syntax checks, and repository-foundation coverage.
- The helper writes target metadata and AMI password only under ignored `.local/real-pbx-verification/`, mode 0700/0600, with terminal echo disabled for the password. The verifier never prints target/username/password/raw AMI data and stores the detailed result only under `.local/`.
- Synthetic preflight confirmed the network boundary blocks loopback without opening a transport connection. During that test, provider error mapping was improved so a blocked network target reports bounded `CONNECTION_FAILED` instead of `UNKNOWN`.
- Exact next action: the operator runs the interactive local setup helper on this monitoring host. Only after those local inputs exist should the bounded real-PBX verifier be executed. Do not send the AMI password through chat or commit it anywhere.
- After Task 12 passes, begin the telephony state engine foundation.

### Failure and bug log

- **Task 9 CI failure — resolved:** the original `.gitignore` rule `runtime/` matched every directory named `runtime`, including `backend/src/providers/runtime/`. The runtime manager source existed locally but was ignored/untracked, so local typecheck passed while a clean GitHub checkout failed at typecheck because the imported module was missing. Fix: root-anchor the runtime-data rule as `/runtime/`, track `backend/src/providers/runtime/index.ts`, and narrow the foundation checker so only top-level private/runtime directories are rejected. Full local gates then passed and both GitHub Actions checks passed.
- **Task 10 validation failure — resolved:** the first full lint gate failed because the new Node event test referenced `Buffer` without an explicit `node:buffer` import under the repository ESLint environment. The import was added and the complete gate suite was rerun successfully.
- **Task 10 open defects:** none currently known from the automated suite. Event consumers are isolated from transport/provider/runtime failures by listener boundaries.
- **Task 10 known limitations:** only the deliberately selected normalized event subset is implemented (`Newchannel`, `Newstate`, `Hangup`, `DialBegin`, `DialEnd`, `BridgeEnter`, `BridgeLeave`, and chan_sip `PeerStatus`). PJSIP contact/endpoint events, queue/agent events, registration/trunk events, duplicate AMI header preservation, state reconstruction, historical persistence, and browser realtime delivery remain future work.
- **Task 11 design bug — resolved before commit:** the first snapshot draft treated any initial snapshot failure like a broken PBX connection, which would disconnect and reconnect repeatedly even when AMI remained connected but `CoreShowChannels` was unsupported or denied. Runtime now keeps the provider connected in `DEGRADED`, retries snapshot reconciliation on the normal interval, and reconnects only when connection health is no longer usable.
- **Task 11 data-exposure bug — resolved before commit:** adding `currentState` directly to the runtime entry status would also have exposed channel snapshot data through the existing authenticated `provider-status` endpoint because that endpoint spreads `runtime.status()`. The public runtime status now deliberately omits current channel state; snapshots remain an internal state-engine boundary only.
- **Task 11 validation failure — resolved:** the first complete quality-gate run stopped at `format:check` because `backend/src/providers/runtime/index.ts` needed Prettier formatting after the status-boundary fix. Prettier was applied and the complete gate suite was rerun from the start.
- **Task 11 open defects:** none currently known from the synthetic suite.
- **Task 11 known limitations:** `CoreShowChannels` behavior and AMI permissions are not yet verified against the required real Asterisk 13.x baseline. Snapshot data intentionally contains only stable channel identity/name, linked ID, state, and bridge ID; caller identity and arbitrary AMI fields are excluded. Live-event/snapshot buffering and idempotent replay belong to the future state engine. The parser still keeps only one value per AMI header name.
- **Task 12 preflight bug — resolved:** the first blocked-target probe surfaced `UNKNOWN` because `NetworkBoundaryError` was not mapped by the Asterisk provider. It now maps to bounded `CONNECTION_FAILED`; a regression test confirms that loopback is rejected before any transport connection is created.
- **Task 12 validation failure — resolved:** the first complete lint run rejected the standalone verifier because Node globals (`process`, `Buffer`, and `setTimeout`) were not explicitly imported under the repository ESLint environment. The verifier now imports them from Node built-ins.
- **Task 12 validation failure — resolved:** the next complete gate run stopped at `format:check` because the new provider regression test required Prettier formatting. The test was formatted and the complete suite was rerun successfully.
- **Task 12 preflight status:** the setup helper, local file modes/ignore rules, verifier path confinement, blocked-target behavior, and syntax checks pass using synthetic inputs. No real PBX has been contacted.
- **Task 12 remaining verification:** real AMI login, `CoreSettings`, `CoreShowChannels` event-list behavior, normalized live events, reconciliation, and the required Asterisk 13.x compatibility claim remain TO_VERIFY until operator-supplied local inputs are present.

### Persistent continuation protocol

For every future task/session:

1. Read `AGENTS.md`, this `MASTER_PLAN.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md`, and ignored `.local/DEPLOYMENT_CONTEXT.md` when present.
2. Inspect Git branch/status/log and synchronize `main` before creating the next feature branch.
3. Preserve the rule that no real PBX is contacted or modified without explicit approval.
4. Before finishing a task, update this master plan with: task result, branch/commit/PR state, failures or bugs found and their resolution/status, known limitations, and the exact next task. Update `PROJECT_CONTEXT.md` and `DECISIONS.md` when architecture/current state changes.
5. Run the repository gates, public/secret review, commit atomically, push normally, then stop for approval/merge.
6. Never place Remote Desktop device IDs, real PBX details, credentials, or private deployment facts in tracked public documentation.

## Future phases — pending approval

Tasks 7–11 implemented substantial Asterisk-provider foundation work earlier than the original high-level phase buckets. The phase labels below describe the remaining product roadmap rather than implying that completed provider work must be repeated.

- [ ] Phase 3: account management and onboarding refinement.
- [~] Phase 4: Asterisk provider integration — network policy, AMI transport, login/discovery, runtime lifecycle, connection verification, normalized event subscription, and channel snapshots/reconciliation are implemented; controlled real Asterisk 13.x compatibility verification is now in progress.
- [ ] Phase 5: telephony state engine — begins only after Task 12 real-PBX verification passes.
- [ ] Phase 6: system metrics.
- [ ] Phase 7: security monitoring.
- [ ] Phase 8: authenticated API and realtime.
- [ ] Phase 9: bilingual dashboard.
- [ ] Phase 10: history and retention.
- [ ] Phase 11: hardening, backup, tested restore, and a production deployment runbook.
- [ ] Phase 12: release validation, including an organization-neutral fresh-deployment procedure that can onboard a new service without carrying private values from another deployment.

Phase 1 is closed. Phase 2 Task 12 is in progress and pauses at the real-PBX credential/target handoff until the operator prepares local-only inputs.
