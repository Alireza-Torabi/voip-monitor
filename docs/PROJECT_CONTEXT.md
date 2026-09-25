# Project context

Status: Phase 2 Task 15 trunk state foundation is implemented on `feature/trunk-state-foundation`, 2026-09-25. Task 14 is merged into `main` by PR #15. The backend now builds deterministic in-memory current channel/call, chan_sip endpoint, and outbound-registration trunk state from independent authoritative snapshots and ordered normalized live events, with capability and synchronization freshness. No telephony state is exposed over REST/WebSocket yet. License: Apache-2.0. This is a public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 14 is merged. The current feature branch extends the provider/state boundary with chan_sip outbound-registration snapshots from `SIPshowregistry`, normalized Registry status updates, independent trunk capability reporting, and a separate trunk snapshot ordering boundary. Static/IP-auth trunks and PJSIP trunk families are not inferred. The reducer fails closed when supported snapshot boundaries are unsafe, marks state stale across connection loss, waits for fresh authoritative snapshots after reconnect, and clears state on provider profile reset/removal. Application PBX networking remains disabled unless the operator explicitly sets `APP_PBX_NETWORK_MODE=plain_tcp`; Task 15 uses synthetic/loopback validation only. The configured `origin` points to the user-supplied GitHub repository via SSH.

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
