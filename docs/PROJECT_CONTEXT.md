# Project context

Status: Phase 6 Task 19 restricted SSH system-metrics transport/parser foundation is implemented on `feature/restricted-ssh-metrics-transport`, 2026-09-25. Task 18 is merged into `main` by PR #19. The backend now has a fixed read-only SSH metrics command allowlist, bounded injected transport contract, Linux/systemd parsers, and a synthetic restricted-SSH collector over the provider-neutral system-metric contracts. No concrete SSH client/network access, SSH credentials, metric persistence, scheduler, or metrics API/UI exists yet. License: Apache-2.0. This is a public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 18 is merged. The current feature branch implements the restricted-SSH metrics command/parsing boundary without real networking. Metric requests resolve to fixed read-only command/program/argument shapes; only a bounded list of validated service IDs is variable, after an argument terminator. Execution is timeout/output bounded, parser failures are safe/bounded, and capability-specific permission/unsupported outcomes remain absent rather than fabricated as zero. CPU is derived from two Linux `/proc/stat` samples without double-counting guest time. No concrete SSH connection, credential, host-key, DNS, or production-host behavior exists in Task 19. The configured `origin` points to the user-supplied GitHub repository via SSH.

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
