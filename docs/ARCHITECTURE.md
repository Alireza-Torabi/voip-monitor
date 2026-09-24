# Proposed architecture

Status: Phase 2 Task 3 adds SQLite storage, migrations, setup state, and readiness to the existing backend and frontend foundation. The monitoring architecture below remains a design; no PBX integration is implemented.

```text
PBX (Asterisk / FreePBX)
    | one persistent AMI connection per enabled PBX
    v
Asterisk provider -> normalized events -> per-instance state engine
    |                                    | current state + freshness
    | read-only reconciliation            v
    +-------------------------------> SQLite repositories
                                          |
                              authenticated REST + WebSocket
                                          |
                                  React browser clients
```

The monitor is an observer. A failed monitor cannot stop calls. Optional restricted SSH collection supplies system metrics and security logs using separate credentials. Shared contracts distinguish capability state (`SUPPORTED`, `UNSUPPORTED`, `NOT_CONFIGURED`, `PERMISSION_DENIED`, `UNKNOWN`) from source freshness (`NEVER_COLLECTED`, `CURRENT`, `STALE`, `UNAVAILABLE`, `ERROR`). Source health has optional attempt, success, and update timestamps plus bounded safe error codes. No source health is collected yet.

## Repository layout

Proposed source directories: `backend/src/{providers,collectors,domain,state,storage,security,auth,api,realtime}`, `backend/tests`, `frontend/src/{components,pages,features,i18n,api}`, `frontend/tests`, `shared`, `mocks/asterisk`, `deploy/{nginx,docker}`, `.github/workflows`, `docs`, `scripts`, and ignored `.local`. Root deployment files include `docker-compose.yml` and `.env.example`. Create source directories when implementation begins.

## Runtime data

The administrator selects a persistent host directory, mounted at `/data` in the backend container. Proposed container paths: `/data/monitor.sqlite3` (including SQLite journal files) and `/data/secrets/master.key`; encrypted PBX credentials are rows in the database. A separate backup destination is operator-configured. Logs go to standard output with secret redaction and deployment-controlled retention. Host paths are configuration, never source constants. Database and key must be backed up together; encrypted credentials without the key may be unrecoverable.

## Secret storage

Generate 32 random bytes at first setup with Node crypto. Atomically write the master key under a 0700 directory with file mode 0600, or accept an operator-managed protected key file. Use AES-256-GCM with a fresh nonce for each credential, and bind PBX instance ID and secret type as authenticated associated data. Store encryption version, nonce, ciphertext, and tag. Decrypt only in backend runtime; never expose credentials in API responses or logs. Refuse unsafe permissions and never silently regenerate a key when encrypted data already exists. Password hashing uses a trusted salted, work-factor based implementation; finalize exact parameters in Phase 3.

## First-run flow

An empty database permits creation of exactly one first administrator through a setup-only endpoint with an atomic initialization guard. After login, the administrator adds a PBX profile, selects Asterisk/FreePBX, enters AMI details, runs a read-only connection test, optionally tests restricted SSH, reviews read-only discovery with explicit unavailable capabilities, confirms, and starts monitoring. Authenticated UI later supports edit, disable, remove, health, and rediscovery. Configuration changes require no image rebuild.

## Multi-PBX data model

`pbx_instance`: ID, display name, provider type, host, AMI/SSH port, enabled, discovered vendor/product/version/hostname/timezone, capability snapshot, connection state, last seen, created, updated. `pbx_secret`: PBX ID, secret type, encrypted envelope. Every channel, call, bridge, endpoint, trunk, queue, agent, metric, security event, and historical row carries `pbx_instance_id`. Query and subscription authorization applies to the instance boundary. Missing data is never represented as a measured zero.

## Asterisk provider

The current shared `PbxProvider` contract defines `connect`, `disconnect`, `discover`, `getCapabilities`, `getHealth`, and `reconcile`. Snapshot and event subscription contracts wait for the state engine design. `AsteriskProvider` owns AMI framing/authentication, compatibility, event normalization, reconnect with bounded exponential backoff and jitter, and exactly one connection lifecycle per instance. Prefer dedicated actions/events supported by Asterisk 13. Verify each action, field, privilege, and response format before coding. Reconcile on connect and about every 30–60 seconds; never per browser.

## Realtime and failure handling

One backend state engine per PBX emits ordered revisions. Authenticated REST handles management and initial reads. Authenticated WebSocket sends an initial per-instance snapshot and versioned updates. A reconnect or revision gap triggers a fresh snapshot. Slow clients are bounded or disconnected without increasing AMI work. Reconnect and stale states remain visible to users.

## Git and CI

Use `main` and short-lived feature branches, with Conventional Commits. Use only the user-supplied remote URL and do not overwrite a conflicting remote. Push only after public-source checks; do not force push or alter GitHub authentication. GitHub Actions uses pinned action versions and synthetic fixtures: install from lockfile, lint, typecheck, unit/integration tests with mock AMI, build, documentation checks, secret scan, and license audit. CI never contacts a production PBX.

## Documentation

English and Persian pairs: `README`, `INSTALL`, `CONFIGURATION`, `OPERATIONS`, `TROUBLESHOOTING`. Persian prose uses GitHub-compatible RTL containers while commands and paths stay LTR. Technical source-of-truth files are `PROJECT_CONTEXT`, `MASTER_PLAN`, `DECISIONS`, and `ARCHITECTURE`. Public project policy files are `SECURITY`, `CONTRIBUTING`, `CHANGELOG`, `LICENSE`, and `NOTICE`. Full installation and restore instructions are pending tested deployment.

## Toolchain foundation

Root npm workspaces and a strict shared TypeScript base config are in place. See [Toolchain](TOOLCHAIN.md) for package management, lint, formatting, testing, and current CI scope. Compose declares no runnable services until Phase 2 supplies build contexts.

## Implemented application foundation

`backend/src/index.ts` validates configuration, opens and migrates SQLite, then starts a Node HTTP server; it closes storage on graceful shutdown. `backend/src/server.ts` serves `GET /health` for liveness and `GET /ready` for core application readiness. The frontend renders a static English/Persian React page with language and RTL/LTR switching. The browser currently uses no backend API. `shared/src/index.ts` now contains type-only provider-neutral contracts. `backend/src/config.ts` is the sole process environment parsing boundary and validates generic application settings with Zod. There is no authentication, collector, or PBX transport. Storage interfaces in `backend/src/storage/index.ts` isolate SQLite statements from the HTTP layer. Versioned SQL migrations and their checksums are source-controlled in `backend/src/storage/migrations.ts`; applied versions are recorded in `schema_migrations`. The initial schema contains only `application_state` and non-secret `pbx_instance` metadata. The initial setup state is `SETUP_REQUIRED`; no administrator exists yet. The only persistent file produced by the project build is generated output under ignored `dist/`.
