# Project context

Status: Phase 6 Task 18 system metrics foundation is implemented on `feature/system-metrics-foundation`, 2026-09-25. Task 17 is merged into `main` by PR #18. The backend now has provider-neutral system-metric sample contracts and a fail-closed restricted-SSH collector boundary in addition to the existing telephony foundations. No real SSH system collector, metric persistence, scheduler, or metrics API/UI exists yet. License: Apache-2.0. This is a public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 17 is merged. The current feature branch introduces system-metric contracts for CPU, memory, filesystems, uptime, and service health plus a transport-independent collector boundary whose current declared source is the future restricted SSH path. The boundary validates PBX instance/source identity, UTC observation time, capability/data consistency, numeric ranges/capacities, duplicate resource identifiers, and converts unknown collection failures to bounded safe errors. Missing or unsupported dimensions remain absent rather than fabricated as zero. No network connection or command execution is implemented in Task 18. The configured `origin` points to the user-supplied GitHub repository via SSH.

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
