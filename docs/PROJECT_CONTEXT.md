# Project context

Status: Phase 6 Task 23 is implemented on `feature/system-metrics-persistence-boundary`, 2026-09-26. Task 22 is merged into `main` as PR #23. The backend now has a concrete `ssh2` transport, an in-memory per-PBX system-metrics runtime/source lifecycle with bounded health/backoff, and a PBX-scoped SQLite current/history persistence boundary with retention-safe semantics. Synthetic tests cover runtime activation, health transitions, bounded failure recovery, credential gating, clean stop, migration 7, monotonic current state, duplicate-safe history, and retention pruning. No real PBX or production host was contacted for Task 23. Metrics API/realtime/UI and broader real-host compatibility remain future work. License: Apache-2.0. This is a public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 22 is merged as PR #23. The current feature branch adds the system-metrics persistence boundary. SSH metadata is PBX-scoped in SQLite; password/private-key/passphrase material uses the existing encrypted PBX secret store and never appears in safe configuration records. Trust is pinned-only using canonical OpenSSH SHA-256 fingerprints with timing-safe verification; no TOFU/accept-new path exists. The concrete transport resolves through an injected resolver once, validates all returned addresses through the shared network boundary, selects an approved address, and executes only typed restricted commands with bounded streaming output and timeout handling. `SystemMetricsRuntime` owns one SSH collector lifecycle per configured PBX, requires encrypted SSH credentials, publishes PBX-scoped SSH source health, uses bounded exponential failure backoff, and persists samples through PBX-scoped current/history repositories. Current state is monotonic by observation timestamp; history is duplicate-safe and pruned transactionally with a bounded seven-day default retention window. The production factory is gated by `APP_PBX_NETWORK_MODE=plain_tcp`; the default `disabled` mode creates no SSH source runtime. The `ssh2` dependency is public and license-reviewed through the repository lockfile. Metrics API/realtime/UI and broader real-host compatibility behavior remain future work. The configured `origin` points to the user-supplied GitHub repository via SSH.

## Product constraints

- Runtime configuration and PBX secrets come from setup, never source edits.
- One persistent AMI connection per enabled PBX, independent of browser count.
- Event-driven live state with periodic reconciliation and explicit data freshness.
- Backend entities and metrics are keyed by PBX instance from the start.
- Monitoring failure must not affect telephony.
- Public docs are English and Persian; demo and tests use synthetic data.
- The Git repository stays organization-neutral and portable. Real deployment addresses, credentials, topology, runtime databases, and keys remain outside Git. Before production release, the repository must include a tested fresh-deployment runbook suitable for onboarding a new organization without copying private values from another deployment.

## Private context

`.local/DEPLOYMENT_CONTEXT.md` may contain private test topology and operational notes. It is never committed or copied into tracked docs. Deployment-specific facts must not be recorded in this public file.

## Unknowns

TO_VERIFY: target PBX capabilities, supported deployment hosts, operating policy, and ownership identity for NOTICE. Local development environment facts belong in ignored `.local/`.

## Continuation note

The authoritative execution state, failure/bug log, and handoff instructions live in `docs/MASTER_PLAN.md`. A new session should read that file before proposing or implementing work. Task failures and bugs must be recorded there before closing each task. Deployment-specific Remote Desktop identifiers and real PBX details stay out of tracked public documentation.
