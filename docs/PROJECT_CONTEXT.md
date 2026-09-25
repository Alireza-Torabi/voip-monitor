# Project context

Status: Phase 2 Task 10 AMI event subscription and normalized provider-event foundation implemented on a feature branch, 2026-09-25. Task 9 is merged into `main` by PR #10. Task 11 is the next planned step after Task 10 is merged. License: Apache-2.0. This is a proposed public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk, with Asterisk 13.x as a required compatibility baseline to verify. No real PBX has been contacted.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. Task 9 is merged. The current feature branch adds transport-level AMI event subscriptions, provider-neutral event types, Asterisk normalization for a bounded initial event subset, and one runtime event-forwarding boundary per managed PBX. PBX networking remains disabled unless the operator explicitly sets `APP_PBX_NETWORK_MODE=plain_tcp`; tests use mocks or loopback synthetic servers and no real PBX has been accessed. The configured `origin` points to the user-supplied GitHub repository via SSH.

## Product constraints

- Runtime configuration and PBX secrets come from setup, never source edits.
- One persistent AMI connection per enabled PBX, independent of browser count.
- Event-driven live state with periodic reconciliation and explicit data freshness.
- Backend entities and metrics are keyed by PBX instance from the start.
- Monitoring failure must not affect telephony.
- Public docs are English and Persian; demo and tests use synthetic data.

## Private context

`.local/DEPLOYMENT_CONTEXT.md` may contain private test topology and operational notes. It is never committed or copied into tracked docs. Deployment-specific facts must not be recorded in this public file.

## Unknowns

TO_VERIFY: target PBX capabilities, supported deployment hosts, operating policy, and ownership identity for NOTICE. Local development environment facts belong in ignored `.local/`.

## Continuation note

The authoritative execution state, failure/bug log, and handoff instructions live in `docs/MASTER_PLAN.md`. A new session should read that file before proposing or implementing work. Task failures and bugs must be recorded there before closing each task. Deployment-specific Remote Desktop identifiers and real PBX details stay out of tracked public documentation.
