# Master plan

Status: 2026-09-25. Phase 1 public repository foundation is complete. Task 12 is merged into `main` as PR #13. Phase 2 Task 13 telephony state engine foundation is implemented on `feature/telephony-state-engine`. It combines authoritative channel snapshots with ordered normalized live events into deterministic in-memory channel/call state with revisions and freshness; it remains internal with no browser/API exposure.

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
- [x] Task 12: controlled read-only real-PBX compatibility verification of the Asterisk 13.x baseline and Task 8–11 AMI assumptions. Local-only credential handling, bounded verifier, bilingual runbook, safe error classification, login/discovery, `CoreShowChannels`, passive normalized live events, reconciliation, and clean disconnect were validated against an approved real Asterisk 13.x system without PBX changes.
- [x] Task 13: internal telephony state engine foundation. Provider frames now carry per-process connection generations and per-frame sequence numbers; channel snapshot items retain their source sequence. The engine subscribes before runtime start, buffers/replays events around snapshot collection boundaries, repairs drift from reconciliation snapshots, tracks `CURRENT`/`AWAITING_SNAPSHOT`/`STALE`, groups current channels into deterministic calls, and resets state when a PBX profile runtime is replaced or removed. No REST/WebSocket state endpoint exists yet.
- [ ] Proposed next task: Task 14 endpoint/registration state foundation with authoritative provider snapshots plus normalized endpoint events, synthetic/mock first and provider-capability aware before any additional real-PBX verification.

### Current execution handoff

- Current branch: `feature/telephony-state-engine`, tracking `origin/feature/telephony-state-engine`, from clean synchronized `main` after Task 12 merged as PR #13.
- Task 13 implementation commit: `37f7ac7` (`feat(state): add telephony state engine foundation`). The branch is pushed; no Task 13 PR has been created yet.
- Final local gates pass: lint, format, typecheck, backend tests 64/64, frontend tests 10/10, build, foundation check, and license check.
- No real PBX was contacted during Task 13; all state-engine and ordering work is synthetic/loopback only.
- Exact next task after Task 13 merge: Task 14 endpoint/registration state foundation with authoritative provider snapshots plus normalized endpoint events, synthetic/mock first.

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
- **Task 12 first real-PBX probe — blocked by permission:** AMI network reachability and authentication passed, then `CoreSettings` returned a permission denial. The probe disconnected cleanly and made no PBX change. Discovery, snapshots, live events, and reconciliation were not attempted after the denied action. The next operator action is to review the dedicated AMI account permissions; do not broaden them blindly.
- **Task 12 diagnostic gap — resolved:** the first real probe originally surfaced the denied discovery as `UNKNOWN` because non-success AMI responses were not safely classified. The provider now maps permission-like responses to `PERMISSION_DENIED` and unsupported-action responses to `UNSUPPORTED`; a synthetic regression test covers denied discovery.
- **Task 12 least-privilege documentation bug — resolved:** the initial runbook suggested `write = system,reporting`. Asterisk 13 checks action authority by bitmask overlap, and both required read-only actions are registered as `system|reporting`, so `write = reporting` is sufficient and narrower. Live call/channel events still require `read = call`.
- **Task 12 real-PBX gate — passed:** after the dedicated AMI permission was corrected, the bounded verifier passed real login, `CoreSettings`, initial `CoreShowChannels`, 60-second passive normalized event observation during a normal test call, reconciliation, and clean disconnect. The tested provider remained connected through final reconciliation and no PBX setting was changed.
- **Task 12 compatibility scope:** the real gate establishes a verified baseline for the approved Asterisk 13.x environment only. It does not claim every Asterisk/FreePBX release, PJSIP event family, queue/agent flow, or deployment topology is compatible. Broader compatibility remains future matrix work.
- **Task 13 snapshot/event race — resolved by design:** timestamps alone cannot safely decide whether an event interleaved with `CoreShowChannels` happened before or after a particular snapshot item. The TCP transport now assigns a process-unique connection generation and monotonic frame sequence; snapshot items retain their source sequence and the state engine replays only events newer than the applicable snapshot boundary.
- **Task 13 reconnect/profile-reload race — resolved:** a newer connection generation is buffered until its authoritative snapshot arrives, and runtime profile replacement/removal emits an internal reset so state from a previous provider instance is not carried into the new one.
- **Task 13 freshness gap — resolved:** runtime connection-state changes now feed the internal state engine. Initialized state becomes `STALE` on non-connected health and `AWAITING_SNAPSHOT` after reconnection until a fresh authoritative snapshot restores `CURRENT`.
- **Task 13 bridge reducer bug — resolved before commit:** an initial `BRIDGE_LEFT` reducer draft could clear a different, newer bridge assignment. A leave event now clears bridge membership only when it matches the current bridge and otherwise preserves the newer assignment.
- **Task 13 validation failures — resolved:** the first targeted build exposed exact-optional-property TypeScript errors in the new reducer; after those fixes, two existing transport tests failed because ordered event metadata changed the expected shape. Types/formatting and test expectations were corrected and targeted suites passed. The first complete lint gate later found two intentionally discarded destructured variables and two test uses of an undeclared `structuredClone` global under the repository ESLint environment; the reducer now constructs public objects explicitly and the fake test source uses explicit shallow copies.
- **Task 13 bounded-buffer behavior:** event buffering is capped at 10,000 entries per PBX. If overflow loses a boundary needed for safe reconciliation, the engine fails closed and waits for a snapshot whose collection starts after the discarded boundary.
- **Task 13 known limitations:** state is in-memory only; call state is a deterministic grouping of current channels by `linkedId` (falling back to channel ID), not a semantic call-phase model. Caller identity, dial result history, endpoint/trunk/queue/agent state, persistence, historical revisions, REST reads, and WebSocket delivery remain future work.

### Persistent continuation protocol

For every future task/session:

1. Read `AGENTS.md`, this `MASTER_PLAN.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md`, and ignored `.local/DEPLOYMENT_CONTEXT.md` when present.
2. Inspect Git branch/status/log and synchronize `main` before creating the next feature branch.
3. Preserve the rule that no real PBX is contacted or modified without explicit approval.
4. Before finishing a task, update this master plan with: task result, branch/commit/PR state, failures or bugs found and their resolution/status, known limitations, and the exact next task. Update `PROJECT_CONTEXT.md` and `DECISIONS.md` when architecture/current state changes.
5. Run the repository gates, public/secret review, commit atomically, push normally, then stop for approval/merge.
6. Never place Remote Desktop device IDs, real PBX details, credentials, or private deployment facts in tracked public documentation.

## Future phases — pending approval

Tasks 7–13 implemented substantial Asterisk-provider and telephony-state foundation work earlier than the original high-level phase buckets. The phase labels below describe the remaining product roadmap rather than implying that completed provider work must be repeated.

- [ ] Phase 3: account management and onboarding refinement.
- [x] Phase 4 foundation gate: Asterisk provider integration — network policy, AMI transport, login/discovery, runtime lifecycle, connection verification, normalized event subscription, channel snapshots/reconciliation, and one controlled real Asterisk 13.x compatibility gate are complete.
- [~] Phase 5: telephony state engine — deterministic channel/call state foundation is implemented; endpoint/registration state is next.
- [ ] Phase 6: system metrics.
- [ ] Phase 7: security monitoring.
- [ ] Phase 8: authenticated API and realtime.
- [ ] Phase 9: bilingual dashboard.
- [ ] Phase 10: history and retention.
- [ ] Phase 11: hardening, backup, tested restore, and a production deployment runbook.
- [ ] Phase 12: release validation, including an organization-neutral fresh-deployment procedure that can onboard a new service without carrying private values from another deployment.

Phase 1 is closed. Phase 2 Task 13 is implemented on its feature branch. Stop after final Task 13 validation/push and await merge approval before Task 14.
