# Project context

Status: PR #54 merged Task 45. The operator-approved architecture remains source-owned and non-duplicating: live state stays real-time, while historical/reporting views read an explicitly configured source database without re-persisting source rows in VoIP Monitor. Task 46 is complete locally on `feature/source-schema-adapters` and merge is pending; it adds a synthetic-only conventional Asterisk SQL schema adapter and provider-neutral historical contracts, with no public history API or real-database compatibility claim.

## Repository state

The public repository tracks `origin/main`. The current unmerged branch is `feature/source-schema-adapters`, created from merged PR #54 at `5956360`. It implements Task 46 schema inspection over `information_schema`, independent dataset capability classification for conventional `cdr`/`cel`/`queue_log` shapes, bounded normalized history contracts, dialect-safe generated reads, and synthetic fixtures/tests. It is not wired into application startup, background polling, or a public historical endpoint, and no real database was contacted.

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

## 2026-10-06 — Task 47 source-backed history UI/API

Task 47 is the first user-facing consumer of the source-owned history architecture. Authenticated PBX-scoped GET endpoints expose schema capability and bounded recent normalized calls, call events, and queue events from the configured database source through the Task 46 adapter. The bilingual History workspace performs explicit operator-triggered reads only. Returned rows are transient and are not written to SQLite, cached, or copied into a second history store. No real source database was contacted during implementation or validation; compatibility remains separately gated.

## 2026-10-06 — Task 48 non-duplication reconciliation

Task 48 stops new local persistence of system-metric, security-event, and security-alert history. Existing API/UI consumers continue through bounded in-memory repository buffers, while only current operational state and application-owned configuration/reliability data remain durable. The three historical SQLite tables are deliberately left untouched for safe rollback/backup compatibility; destructive cleanup is deferred until deployment observation and tested backup/restore confirm removal is safe.

## 2026-10-06 — Task 49 production hardening and recovery

Task 49 converts deployment recovery guidance into executable, tested operations. Backup/restore is deliberately stopped-service and fail-closed: valid SQLite plus the exact master key are copied with manifest/checksums, restore validates before writing, and overwrite is explicit. Synthetic automation proves restored SQLite is usable and tampering is rejected. The tracked systemd unit gains additional sandbox/capability restrictions while retaining Unix/IPv4/IPv6 networking required by the HTTPS gateway and approved monitoring paths. Legacy local history tables remain untouched; production evidence and a tested real recovery set are prerequisites for any destructive cleanup.

## 2026-10-06 — Task 50 release validation

Task 50 proves release portability from a staged clean source snapshot rather than reusing local runtime state. The validator creates a temporary seed commit from the staged index, performs a real fresh clone, blocks private/runtime artifacts, installs from the lockfile, audits high/critical dependency risk, builds, starts an isolated HTTPS deployment with PBX networking disabled, completes first-admin and synthetic PBX onboarding, then validates stopped-service backup/restore and restart recovery. A discovered transitive source-map-js advisory was resolved by lockfile update to 1.2.2. The physical reboot gate was separately approved because the live deployment uses read-only plain_tcp PBX networking; it also exposed and corrected stale installed systemd-unit drift before a second successful reboot of the actual hardened release unit.


## 2026-10-06 — Accepted post-V1 roadmap and UI/UX-first priority

The user accepted the proposed V1 completion roadmap but explicitly prioritized UI/UX modernization before new monitoring features. Task 51 is therefore a design-first UI/UX Redesign Foundation and Master Mockup task. The intended visual direction is a modern NOC/operations console rather than a generic admin template: problem-first hierarchy, restrained semantic status color, fewer equal-weight cards, stronger typography/density, a persistent application shell, unified live/stale/error grammar, and stable bilingual RTL/LTR handling. Backend contracts and PBX behavior remain unchanged until the approved visual master is handed off for implementation.


## 2026-10-06 — Task 51 visual master approved

The user approved the refined dark Modern NOC / Operations Console direction. The global shell, problem-first Overview hierarchy, compact operational density, grouped panel language, semantic status treatment, and compact table/entity-row behavior are now locked as the implementation reference. Task 52 will implement this approved system incrementally without changing backend contracts or PBX behavior.

## 2026-10-06 — Task 52 Modern NOC shell implementation

Task 52 implements the approved application shell and centralized visual system while preserving all existing monitoring/data contracts. The previous white sticky header and button-row navigation are replaced by a persistent responsive sidebar and compact top status bar. Existing workspaces continue to operate unchanged inside the shell through semantic bg/fg/border token compatibility, allowing incremental migration. No future capability was presented as if already implemented. Task 53 will redesign only the operator dashboard content inside this shell.

## 2026-10-06 — Task 53 problem-first Operator Dashboard

The default dashboard now prioritizes operator decisions instead of arbitrary widget layout. Current existing read-only signals are synthesized into a compact health strip, current-problem list, infrastructure panel, active-call/trunk state, and endpoint/queue/service summaries. Persisted dashboard layouts remain supported only as an explicit secondary Edit mode, so customization no longer weakens the default first-glance hierarchy. No backend monitoring, PBX behavior, generic alert model, or fleet-health semantics changed in this task.

## 2026-10-06 — Task 54 workspace redesign

The non-dashboard operator surfaces now share the same Modern NOC visual and interaction language. Telephony uses a compact live-status header, unified scope/search toolbar and dense data table; source-backed History uses dataset-aware dense records rather than cards; Security uses compact current/recent alert surfaces and consistent rule panels; Settings uses a responsive sub-navigation rail and consistent NOC form surfaces across PBX, database, SSH, service, storage and account administration. Data/API/PBX behavior is unchanged.
