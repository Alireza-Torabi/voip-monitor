# Project context

Status: Phase 7's defined security-monitoring slice is merged through Task 34/PR #36. Task 35 is implemented locally on feature/notification-delivery-foundation as of 2026-09-26. Migration 11 adds PBX-scoped notification-channel metadata plus duplicate-safe pending/cancelled delivery-queue persistence. No runtime subscribes to alerts for delivery, no provider client/worker exists, and no real external endpoint is contacted. Authenticated notification configuration/secret management, runtime enqueue, delivery execution, retry semantics, broader security sources/rules, telephony browser state, and broader production dashboard work remain future work. License: Apache-2.0.

## Repository state

The public repository tracks origin/main; Task 34 is merged through PR #36. The current branch is storage/contracts only: notification channel metadata references an opaque secret name, queue rows contain only bounded SecurityAlertRecord data and PENDING/CANCELLED state, deterministic channel+alert deduplication prevents duplicate queued work, and no delivery network path exists.

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

## Task 30 — security alert API/realtime

Task 30 exposes persisted alert state only. Current state is returned as the PBX's per-rule current alert set. History uses explicit UTC bounds and a maximum 500 rows. The SSE stream sends the persisted current snapshot and subsequent successfully persisted nonduplicate alerts, is same-origin protected, PBX scoped, heartbeat bounded, and capped at 64 concurrent streams. No external notification target, PBX mutation, production log access, or automatic rule execution is part of this task.

## Task 31 — persistent alert-rule configuration and runtime wiring

Task 31 gives the application one explicit owner for the security event -> rule evaluation -> matched alert persistence path. Configuration is persistent, PBX scoped, bounded to the two existing rule shapes, and cascades on PBX deletion. Failures are isolated and fail closed. There is still no public rule-configuration mutation API/UI or external notification delivery.
