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

## 2026-10-06 — Task 55 wallboard and accessibility pass

The approved NOC interface now has a dedicated wallboard mode distinct from generic browser fullscreen, mobile bottom-rail navigation, tablet/desktop sidebar fallbacks, skip navigation, explicit focus-visible treatment, reduced-motion behavior, forced-colors fallbacks, and accessible mobile navigation labels. A numeric contrast audit raised the subtle-text token so small metadata text now meets WCAG AA contrast against all three primary dark surfaces. No backend or PBX behavior changed.

## 2026-10-07 — Task 56 unified operational health

Operational health semantics now have one shared provider-neutral owner. The shared evaluator normalizes provider, telephony, trunk, endpoint, queue, system, security, and future call-quality dimensions into HEALTHY/DEGRADED/CRITICAL/UNKNOWN/STALE with bounded reason codes. Backend exposes a read-only PBX-scoped snapshot from current state only; frontend realtime presentation uses the same evaluator. UNKNOWN capabilities do not become false incidents, while STALE explicitly represents confidence loss. No monitoring probe, persistence, or PBX behavior was added.

## 2026-10-07 — Task 57 Fleet Overview

PBX Fleet is now a dedicated operational workspace. A single authenticated read-only aggregate endpoint combines only already-current provider/telephony/system/security state and the Task 56 canonical health snapshot for each configured PBX. The frontend refreshes this aggregate state at a bounded 15-second cadence, sorts unhealthy PBXs first, and supports direct drill-down into the existing selected-PBX Operator Overview. PBX configuration remains in Settings and no duplicate monitoring persistence or new PBX work was introduced.

## 2026-10-07 — Task 58 Trunk Reliability

Trunk reliability is now maintained as bounded in-memory operational state inside the existing TelephonyStateEngine. Authoritative live events and reconciliation snapshots classify each trunk as UP/DOWN/TRANSITIONING/UNKNOWN, track last observed up/down, current outage start, bounded flap/reconnect counts, and the latest 20 transitions. Provider visibility loss only makes trunk synchronization stale and never creates a synthetic outage. The Trunks workspace renders and ranks this reliability state while keeping all previous trunk classification metadata. No new PBX collector or durable monitoring-history store was added.

## 2026-10-07 — Task 59 Endpoint Reliability

Endpoint reliability is now bounded in-memory operational state inside TelephonyStateEngine. Accepted endpoint events and authoritative reconciliation snapshots classify endpoints ONLINE/OFFLINE/UNKNOWN, track last reachable/unreachable timestamps, active offline windows, bounded flap counts, and the latest 20 transitions. Provider visibility loss only marks endpoint synchronization stale and never creates synthetic offline state. Endpoints UI renders and ranks this state without new polling or persistence.

## 2026-10-07 — Navigation hierarchy correction

The UI now follows a single-navigation hierarchy: the persistent AppShell sidebar is the sole route/page navigation surface. Telephony and Settings no longer render secondary nested menus. All previously nested destinations remain accessible directly from the sidebar, while workspace-local selectors, filters, search, and actions remain inside content. This correction changes presentation/navigation only and does not alter backend or monitoring behavior.

## 2026-10-07 — UX/security correction after Task 59

The primary navigation is now a compact three-choice shell: Overview, Operations, and Settings, with only one level of expandable children and one group open at a time. Infrastructure lives under Settings. SSH configuration is verified by the backend before persistence: pinned host key and authentication must both succeed, and verified provenance is recorded in `ssh_config.last_verified_at`; legacy configs remain UNVERIFIED. Telephony frontend rendering now includes a compatibility path for older responses missing reliability metadata, preventing blank Trunks/Endpoints pages during temporary frontend/backend version skew. Production deployment must rebuild and restart frontend/backend as one merged release.

## 2026-10-07 — Live update resilience

Telephony remains AMI-event driven through TelephonyStateEngine and SSE. Dashboard and Telephony workspaces now also refresh the current in-memory telephony state every 10 seconds as a fallback and immediately on SSE error. Provider reconciliation defaults to 15 seconds so authoritative snapshots remove stale inventory such as PBX-side deleted trunks/endpoints, and reliability maps are pruned with deleted entities. Production must restart the merged backend together with frontend assets to avoid version skew.

## 2026-10-07 — Production live-state verification

Production was rebuilt/restarted on the merged PR #73 release. The backend telephony state is confirmed live: AMI events, reconciliation snapshots, revisions, channels, and call counts change continuously. System metrics are a separate issue: the stored MVM SSH credential currently fails authentication, so no fresh CPU/memory sample can be produced. The UI hotfix consumes metrics-health SSE updates, preserves the bounded authentication error code, and never presents an old persisted metric sample as current while the source is unhealthy.

## 2026-10-07 — Endpoint/statistics and Infrastructure visualization

Endpoint reachability is now treated as availability statistics rather than an operational fault: reachable count is the primary Overview number, total/unreachable counts are secondary, and individual offline endpoints do not degrade PBX health or create Current Problems. Endpoint reliability data remains available for troubleshooting. Infrastructure Overview uses separate CPU and memory time series from the existing bounded history and per-filesystem storage usage gauges with Used/Total capacity.

## 2026-10-07 — Dashboard visual cadence and wallboard layout

Dashboard Settings now owns PBX-scoped per-element visual cadence. These values never change AMI/SSE or system collector frequency and never create additional PBX polling; they only stage when the latest local live state is painted by each Overview element. Active Calls uses bounded in-memory chart history, CPU/RAM share a dual-series chart, storage uses progressive green-to-red gauges, Current Problems is moved to the bottom, and wallboard uses a compact four-row one-screen responsive layout.

## 2026-10-07 — Settings separation

Storage / Filesystems and Dashboard Settings are separate Settings destinations. The storage workspace is intentionally independent from refresh configuration: it reads only current filesystem metrics and dashboard-storage selection. Dashboard cadence failures cannot block filesystem discovery or selection.

## 2026-10-07 — Build isolation

The default Full Gate build is non-deploying: frontend output goes to `/tmp/voip-monitor-frontend-build`. Only explicit `npm run build:production` writes the live `frontend/dist` served by the production gateway. Never use an unmerged branch build as a production UI preview.

## 2026-10-07 — Overview mode/editor simplification

Overview has one special presentation mode: Fullscreen. It automatically applies the compact, responsive, one-screen NOC layout and auto-hiding exit control; separate Wallboard UI is removed. The old Edit dashboard frontend builder is also removed because it edited a separate legacy widget model rather than the current OperatorOverview. Existing dashboard-definition backend persistence is retained but dormant. Any future drag/resize/reorder must edit OperatorOverview itself.


Task 60 adds source-owned call outcome analytics over the configured read-only CDR dataset. Operators can request only 1-hour, 24-hour, 7-day, or 30-day aggregates. The backend returns total/answered/no-answer/busy/failed/unknown counts, answer ratio, and average duration without persisting historical call data locally. Task 61 is next.


## 2026-10-08 — Data-source scope and queue-abandonment product context

The product must treat a database **connection** separately from the set of databases/schemas that the verified read-only account is allowed to use. The current single `databaseName` configuration is an implementation limitation, not a product invariant. The next source-model correction after Task 60 merge is to keep one host/port/dialect/credential/TLS identity while allowing an explicit verified allowlist of database/schema scopes. Existing single-database configurations must remain compatible.

Queue Abandonment is a first-class operational KPI requirement. It must answer, for a selected queue and bounded time range, how many callers entered the queue, how many connected to an agent, how many callers abandoned before connection, how long abandoning callers waited, and how many exceeded an operator-defined long-wait threshold. Caller-driven abandon must remain semantically distinct from queue/system timeout exits. Where supported by the source, percentile wait metrics may be exposed.

This feature remains source-owned and read-only: no local durable queue-history copy, no CDR/queue warehouse, no arbitrary SQL, and no PBX/database mutation. Queue-event schema/capability discovery must fail closed and unsupported dimensions must remain unavailable rather than becoming zero.

Priority decision: finish and merge the already operator-validated Task 60 branch first; then implement the multi-database source scope (Task 60A), then Queue Abandonment analytics (Task 60B), and only then resume the existing Call Quality roadmap at Task 61.


## 2026-10-08 — Task 60A implementation context

Database-source configuration now models one connection identity plus a bounded verified scope list. `databaseName` remains the primary database used to establish the driver session for backward compatibility. `databaseScopes` contains the source namespaces the application is allowed to inspect: MySQL/MariaDB database names or PostgreSQL schemas inside the primary database. Scope verification is mandatory before persistence, and history schema discovery is constrained to the persisted verified scope list.

Migration 19 preserves existing source metadata and credentials. Existing MySQL/MariaDB rows gain their primary database as the initial scope; PostgreSQL rows gain `public` as the conservative initial schema scope. New or edited MySQL configurations automatically include the primary database even if the operator lists only additional databases. A configuration may expose at most 16 scopes.

Task 60A does not itself add Queue Abandonment analytics. It prepares the source boundary so Task 60B can use queue history/configuration datasets across approved scopes without introducing a second credential or duplicate history store.


## 2026-10-08 — Task 60B implementation context

Queue Abandonment Analytics is implemented as a source-owned read-only History feature. The conventional SQL adapter exposes a distinct `queueAbandonment` capability requiring queue-log wait-time data (`data3`) in addition to the generic queue-event columns. The feature accepts one bounded current queue ID, an explicit validated source-local From/To date-time window, and a 1–60 minute integer long-wait threshold.

Product semantics are explicit: `ABANDON` is caller abandonment; `EXITWITHTIMEOUT` is queue/system timeout and is shown separately. KPIs include entries, connected calls, caller abandons, queue timeouts, abandonment rate, average wait before caller abandon, and long-wait abandon count. Exact P50/P90 are returned only when the complete abandon wait sample is within the 1000-row transient read limit; otherwise percentile fields stay unavailable.

Task 60B adds no local telephony-history persistence or database/PBX write path. After Task 60B is merged, the next roadmap item is Task 61 — Call Quality Source Discovery.


## 2026-10-08 — Queue report presentation/export context

Task 60B operator review now includes a graphical queue-outcome report and browser-side PDF/XLSX export. The displayed donut uses normalized aggregate counts only. Export buttons operate on the already-loaded report and never trigger a second historical query. PDF includes the localized report card and chart; XLSX contains structured filter/KPI cells and an embedded chart image, with RTL worksheet direction in Persian mode. No generated report is stored by the backend.


## 2026-10-08 — Export reliability follow-up

The Task 60B Excel hang observed during operator review was isolated to the DOM-rendering stage that preceded workbook creation, not to the source query or XLSX writer. Report exports now draw graphics directly from the already-loaded analytics using Canvas, XLSX resolves to a Blob before download, and async export stages are bounded by a 15-second timeout. A remote headless Chrome validation completed the real Excel path successfully without any PBX/database query.

## 2026-10-08 — Comprehensive queue report builder

The Reports workspace now includes a multi-queue performance report builder in addition to the focused abandonment analytics. Operators choose a source-local date/time range and 1–16 queues, then receive per-queue and combined KPI totals, rates, timing comparisons, lost-reason breakdown, reconciliation notes, and charts. Queue choices come from a bounded source-backed queue catalog with current telephony state only as fallback.

Core report metrics are exact source-side aggregates rather than sampled raw rows. To protect the operational PBX database, the backend executes one-day chunks sequentially, separates lightweight queue/event counting from event-specific timing aggregation, and caps live-source reports at 30 days once exact caller KPIs are included. Longer reporting should target a read-only reporting replica. The report explicitly separates attempt-level RINGNOANSWER/RINGCANCELED from call-level lost outcomes and exposes cross-window reconciliation variance.

## 2026-10-08 — Caller KPIs and filtered detail export

The comprehensive queue report now distinguishes queue calls from people: unique callers, repeat callers, repeat rate, average calls per caller, repeat-generated calls/share, and Caller-ID coverage are part of every queue row and the combined selected-queue total. Combined uniques deduplicate callers across selected queues. Managerial caller analytics use ephemeral HMAC digests only and do not persist or expose caller identifiers.

The same report filters can drive a separate Excel-only call-detail export. Detail reconstruction is source-owned/read-only, count-first, limited to 1,000 rows per database query, time-sliced when necessary, and correlated in application memory without a `callid` database join. The browser workbook is capped at 75,000 calls and is explicitly sensitive because it contains caller numbers and call IDs. Caller KPI reads are lighter: bounded sub-windows are grouped by queue/caller and only call-counts are returned before immediate per-report HMAC pseudonymization. Live-source comprehensive reports remain bounded to 30 days; longer reporting should use a read-only reporting replica.

## 2026-10-09 — Bilingual contextual help

The frontend now has a shared contextual-help layer. Operators see small `?` controls beside shared navigation/section/field/status/KPI surfaces and explicit report concepts. Hover/focus previews help; click pins the same popover; close/outside dismissal releases it. Help language follows the application language, including RTL Persian content.

Reports have richer explicit explanations than the generic application fallback. Queue/caller/call-outcome KPI help explains what each value means, why it exists and how it is calculated, including important distinctions such as call volume versus unique callers and RINGNOANSWER attempts versus lost calls. A visible Reports guide summarizes these interpretation rules. The help layer is browser-only and does not change source-query, persistence or monitoring architecture.

Common workspace actions now participate in the same contextual-help layer through a shared `HelpButton` wrapper; layout-sensitive actions retain explicit sibling help. This extends practical help coverage to save/reset/create/delete/refresh/verify/pagination-style controls without introducing nested buttons.

## 2026-10-09 — Task 61 Call Quality source discovery outcome
OBSERVED: The project is on feature/call-quality-source-discovery from merged main c92c589. On an authorized read-only AMI observation, Asterisk 13.20.0 emitted 15 RTCPReceived and 12 RTCPSent events during a 20-second observation. Only field names and aggregate event counts were retained. Packet loss report field, RTP-unit jitter field and RTT field were present. No numerical accuracy/scale, per-call identity correlation, codec or MOS was proved. The application must continue to treat user-facing quality KPIs as UNKNOWN until Task 62 validates semantics. No PBX modification or local RTCP history storage is permitted. DB-source historical quality schema was not inspected due to access restrictions and remains UNKNOWN; it must not be represented as unsupported or absent. See docs/CALL_QUALITY_SOURCE_DISCOVERY.md for source-specific boundaries. Task 61's feasible live-source discovery is closed; Task 62 contract validation remains separate. No production service deployment, PR or merge for this documentation-only task.

## 2026-10-09 — PR #83 CI repair
The Task 61 documentation branch exposed a pre-existing format-check failure from frontend/src/DashboardBuilder.tsx. The branch contains a Prettier-only import formatting fix in that file so GitHub CI can validate the whole project. No application behavior or PBX configuration is changed. Full local checks passed. Await remote checks before merging.

## 2026-10-09 — Task 62 quality contract handoff
OBSERVED: feature/call-quality-contract implements a provider-neutral CallQualitySample with discriminated metric availability and explicit units. The pure AMI RTCP adapter is not subscribed to runtime events, does not expose an API, and persists nothing. Source raw jitter is in RTP_TICKS; percent loss, RTT, MOS and codec remain UNKNOWN pending proof. New synthetic backend tests pass; Task 63 must independently design bounded per-call live integration and association. No PBX or database modifications.

## 2026-10-09 — Task 63 development boundary
A new unmerged feature/live-call-quality branch introduces passive RTCP event fanout over the existing AMI connection, a bounded memory-only per-PBX sample cache with TTL/eviction, and an authenticated scoped GET endpoint exposing only currently synchronized active channel legs. Missing/unsupported numerical metrics remain explicitly unknown. No PBX configuration, database storage, history, extra connection, or production deployment. Task 64 will handle dashboard UX after validation and merge.

## 2026-10-09 — Pre-merge Task 63 Development deployment
The operator requires testing unmerged branches on Development 8443 before approving merge. feature/live-call-quality at 3d7d3d0 is now explicitly built using build:production and running behind the restarted systemd HTTPS gateway. Health and readiness HTTP 200, unauthenticated call-quality endpoint HTTP 401. Prior build artifacts privately backed up under ignored .local/deployment/rollback-task63. No merge; await functional review and operator authorization.

## 2026-10-09 — Task 64 dashboard checkpoint
Merged Task63 PR #85 main `9daadac` verified. `feature/call-quality-dashboard` adds bilingual operations-menu Live Call Quality workspace with 5s read-only authenticated polling and source-qualified RTCP samples. Quality-grade and poor/worst/distribution/trunk summaries are intentionally gated UNKNOWN pending validated source units and associations, not silently fabricated. No new server storage, PBX write or extra AMI socket. Deploy unmerged exact branch on Development 8443 for operator acceptance before merge.

## 2026-10-09 — Task 64 pre-merge review state
Merged Task63 PR #85 is base. Branch feature/call-quality-dashboard pushed at 72c76d0 and explicitly deployed unmerged on Development 8443; service active/ready 200, unauth call-quality 401, new frontend JS verified. Prior runtime build artifacts privately backed up. Operator must test before approving merge. Source-scaled poor/worst call KPIs deliberately remain unimplemented/unknown pending validation; avoid claiming full feature closure.

## 2026-10-09 — Call quality metric-validation follow-up
New feature/call-quality-metric-validation branch adds evidence-gated pure conversion helpers and synthetic tests, not runtime use. Live Asterisk 13.20.0 report values/scales are not yet validated and not logged; packet-loss percent/RTT/MOS/codec UI remains UNKNOWN. Explicit evidence per Asterisk version and RTP stream clock required. No PBX changes or duplicate telemetry persistence.

### 2026-10-09 — Live RTCP aggregate scale probe (read-only, no IDs recorded)
Using the previously approved restricted AMI source, a one-time 20-second passive aggregate observation on Asterisk 13.20.0 saw 25 RTCPReceived events, 20 RTCPSent events and 51 report blocks. FractionLost: 45 zero, 6 absent; no nonzero examples. RTT: 19 positive decimal values (coarse classification only), 6 zero, 20 absent. Interarrival jitter: 29 positive integer values <=255, 16 zero, 6 absent. No per-call fields/identifiers, raw values, recordings, network addresses or credentials were written to the report; only aggregate counters were output. This proves numeric field presence and formatting in the current sample, NOT RFC3550 fraction scaling, RTT seconds, stream clock Hz, MOS, codec, or operational quality thresholds. Loss percentage and RTT continue UNKNOWN in API/UI. The probe script remains private in ignored .local/real-pbx-verification; no PBX changes or local RTCP history storage. Because loss was entirely zero, additional approved observations or Asterisk 13 implementation/source evidence are needed before enabling fractional-loss conversion. Further confirmation of RTT numeric semantics is needed before activation. No frontend change or deployment is needed for this documentation-only branch.

### 2026-10-09 — Exact Asterisk 13.20.0 RTCP field-scale verification (pre-merge)
Inspected the public official Asterisk source tag `13.20.0` without touching the PBX: `main/rtp_engine.c` lines around 2439-2481 show AMI RTT is rendered as floating-point seconds and ReportXFractionLost is serialized from `lost_count.fraction`; `res/res_rtp_asterisk.c` lines around 3758 and 4584-4602 show the 8-bit fraction masking and conversion of RTT to seconds, and around 4976 and 5018 show inbound fraction extraction and RTT payload. Branch `feature/asterisk13-verified-rtcp-metrics` gates loss % and RTT-ms normalization on exact discovery metadata version `13.20.0` and explicitly verified conversion evidence; version discovery is performed on provider reconnect with fail-closed fallback if unavailable. Jitter stays raw RTP ticks; Codec/MOS stay UNKNOWN; no guessing, no duplicate storage and no PBX writes. Important: source-version check is exact and not blanket support for Asterisk 13 variants. Development pre-merge testing required; ensure live source observations match 13.20.0 and no false quality ratings are displayed.

## 2026-10-09 — Verified Asterisk13 metrics deployed for user acceptance
Exact Asterisk 13.20.0 source-verified RTT-ms and fraction-loss-% runtime normalization is deployed unmerged on Development 8443 from branch feature/asterisk13-verified-rtcp-metrics commit 9400b1d. Health 200, readiness 200, unauthenticated call-quality API 401 after restart; build rollback artifacts retained privately. Await manual approval before merge. Missing sample coverage remains UNKNOWN; codec/MOS still unknown.
