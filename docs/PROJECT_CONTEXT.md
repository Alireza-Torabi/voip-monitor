# Project context

Status: Phase 6 Task 20 restricted SSH configuration/trust foundation is implemented on `feature/restricted-ssh-config-trust`, 2026-09-25. Task 19 is merged into `main` by PR #20. The backend now persists optional per-PBX SSH metadata, encrypts SSH password/private-key credentials with the existing secret store, requires pinned SHA-256 host-key trust, and reuses a generic SSRF/network boundary alongside the Task 19 command/parser foundation. No concrete SSH client/network access, metric persistence, scheduler, or metrics API/UI exists yet. License: Apache-2.0. This is a public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 19 is merged. The current feature branch adds the restricted-SSH configuration/trust boundary without real networking. SSH metadata is PBX-scoped in SQLite; password/private-key/passphrase material uses the existing encrypted PBX secret store and never appears in safe configuration records. Trust is pinned-only using canonical OpenSSH SHA-256 fingerprints with timing-safe verification; no TOFU/accept-new path exists. The former Asterisk-specific target policy is now a generic network policy re-exported by Asterisk and reused by SSH after a future resolver step. No SSH package, DNS lookup, socket, command execution, or production-host behavior exists in Task 20. The configured `origin` points to the user-supplied GitHub repository via SSH.

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
