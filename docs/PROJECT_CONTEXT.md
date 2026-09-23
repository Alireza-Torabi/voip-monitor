# Project context

Status: planning foundation, 2026-09-23. License: Apache-2.0. This is a proposed public, reusable VoIP monitoring application hosted separately from the PBX. The first provider targets Asterisk and FreePBX-based Asterisk, with Asterisk 13.x as a required compatibility baseline to verify. No real PBX has been contacted.

## Repository state

The public repository is being established on `main`. Phase 1 contains documents and toolchain manifests only. No application, monitoring transport, or deployment service exists. The configured `origin` uses the canonical URL supplied by the user: `https://github.com/Alireza-Torabi/voip-monitor.git`.

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
