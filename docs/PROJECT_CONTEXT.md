# Project context

Status: Phase 2 Task 7 Asterisk network-boundary and mock transport foundation implemented on a feature branch, 2026-09-25. License: Apache-2.0. This is a proposed public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk, with Asterisk 13.x as a required compatibility baseline to verify. No real PBX has been contacted.

## Repository state

The public foundation repository is established on `main`, tracking `origin/main`. The merged application skeleton provides a minimal backend health server and bilingual frontend shell. The current feature branch adds a pure PBX network policy, injected address-resolution boundary, an AMI transport interface, and deterministic mock transport tests. Onboarding remains configured-unverified. There is no concrete DNS resolver, socket transport, AMI authentication, or real PBX access, and no deployment service exists. The configured `origin` points to the user-supplied GitHub repository via SSH.

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
