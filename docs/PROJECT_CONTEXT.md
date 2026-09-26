# Project context

Status: Phase 7 Task 29 is implemented locally on feature/security-alert-persistence-boundary as of 2026-09-26 after Task 28 merged through PR #30. The backend has normalized Asterisk AMI authentication-security events, PBX-scoped security event persistence/API/SSE, bounded fail-closed alert evaluation, and PBX-scoped alert current/history persistence with deterministic deduplication and per-rule monotonic current state. Alert APIs/realtime delivery, persistent rule configuration/execution ownership, external notification delivery, dashboard UI, and broader security sources remain future work. License: Apache-2.0.

## Repository state

The public repository tracks origin/main; Task 28 and its documentation reconciliation are merged through PR #30. The current branch adds migration 9 and SecurityAlertRepository on top of the normalized security-event/evaluator boundary. Alert current state is keyed by PBX + rule, history is duplicate-safe by bounded alert identity, source stream ordering is preferred for monotonic advancement when available, retention pruning is transactional, and PBX deletion cascades alert rows. No rule configuration persistence, automatic evaluator runtime wiring, alert API/SSE, external delivery, or real-system access is introduced by Task 29.

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

## Task 28 — security alert/rule evaluation

Task 28 adds a bounded `SecurityAlertEvaluator` over normalized persisted security events. Only the two allowlisted authentication-failure rule IDs are accepted. Unknown or malformed rules and evaluation/storage errors fail closed. Threshold evaluation uses bounded PBX-scoped history. No external delivery, PBX write, production log access, or real-PBX compatibility claim is part of this task.

Known gap: the repository has independent evaluator smoke validation, but a dedicated committed evaluator test file was not added because the Remote editing seam rejected that file-creation operation.

## Task 29 — security alert persistence/current state

Task 29 adds PBX-scoped alert current/history storage only. Supported alert records are restricted to the two Task 28 rule IDs, bounded matched-event counts, normalized timestamps, and optional provider stream ordering. Current state is independent per rule, history is deterministic and duplicate-safe, retention is bounded, and current state survives history pruning. No automatic evaluation scheduling, alert delivery, PBX mutation, production log access, or real-PBX compatibility claim is part of this task.
