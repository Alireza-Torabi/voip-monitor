# Proposed architecture

Status: Phase 2 Task 6 adds authenticated PBX profile onboarding without PBX network access. The monitoring architecture below remains a design; no PBX integration is implemented.

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

At startup, after migrations, create 32 random bytes with Node crypto only if the key is absent and no encrypted records exist. Exclusively create `<APP_SECRET_DIR>/master.key` under a mode-0700 directory with file mode 0600; load an existing valid owner-controlled key. Missing keys with encrypted data and unsafe or malformed keys stop startup. AES-256-GCM uses a fresh random 12-byte nonce and 16-byte tag. Envelope and key versions are both 1. AAD binds PBX instance ID, secret name, envelope version, and key version. `backend/src/security/secret-store.ts` is the sole plaintext encryption/decryption boundary; `backend/src/storage` persists only ciphertext and envelope metadata. No HTTP secret endpoint exists. Key rotation and backup/restore are future work. JavaScript cannot guarantee deterministic memory erasure. Password hashing parameters are recorded in Decision 26.

## First-run flow

An empty database creates a protected local bootstrap token; presenting it permits creation of exactly one first administrator through a setup-only endpoint with an atomic initialization guard. After login, the administrator adds a PBX profile, selects the Asterisk provider (displayed as Asterisk / FreePBX), and enters AMI details. The profile remains configured but unverified. Future provider work will define the network boundary, connection test, discovery, and monitoring. Authenticated UI supports local edit, enable/disable, credential removal, and profile deletion. Health and rediscovery wait for provider work. Configuration changes require no image rebuild.

## Multi-PBX data model

`pbx_instance`: ID, display name, provider type, host, AMI/SSH port, enabled, discovered vendor/product/version/hostname/timezone, capability snapshot, connection state, last seen, created, updated. `pbx_secret`: PBX ID, validated provider-neutral secret name, versioned encrypted envelope. Every channel, call, bridge, endpoint, trunk, queue, agent, metric, security event, and historical row carries `pbx_instance_id`. Query and subscription authorization applies to the instance boundary. Missing data is never represented as a measured zero.

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

`backend/src/index.ts` validates configuration, opens and migrates SQLite, initializes the master key and secret store, then starts a Node HTTP server; it closes secret storage and SQLite on graceful shutdown. `backend/src/server.ts` serves `GET /health` for liveness and `GET /ready` for core application readiness. The frontend renders English/Persian first-admin setup, login, and authenticated PBX management flows using same-origin APIs. `shared/src/index.ts` now contains type-only provider-neutral contracts. `backend/src/config.ts` is the sole process environment parsing boundary and validates generic application settings with Zod. There is local authentication but no collector or PBX transport. Storage interfaces in `backend/src/storage/index.ts` isolate SQLite statements from the HTTP layer. Versioned SQL migrations and their checksums are source-controlled in `backend/src/storage/migrations.ts`; applied versions are recorded in `schema_migrations`. Migration 1 contains `application_state` and non-secret `pbx_instance` metadata. Migration 2 adds `pbx_secret` with a foreign key to the PBX instance. Migration 3 adds administrator and session tables. Migration 4 adds profile enablement, provider-scoped Asterisk connection metadata, and the configured-unverified setup state. The initial setup state is `SETUP_REQUIRED`; first-admin creation advances it to `SETUP_IN_PROGRESS`. The build writes ignored `dist/`; runtime initialization writes the SQLite database and master key at configured paths outside Git.

## Local authentication foundation

Migration 3 adds `administrator` and `auth_session`. The first administrator is guarded by a protected local bootstrap token and a SQLite write transaction. Creating it moves `application_state` from `SETUP_REQUIRED` to `SETUP_IN_PROGRESS`; PBX onboarding remains future work. Passwords are salted scrypt records. The browser receives a 256-bit random cookie token; SQLite stores only its SHA-256 digest and absolute expiry. `AuthService.principal` is the reusable backend authentication boundary. Same-origin POST checks compare Origin with Host and require HTTPS in production. `/health` stays generic; `/ready` requires initialized authentication storage but does not depend on administrator or PBX setup state. The reverse proxy must preserve a trustworthy Host and enforce HTTPS in production.

## Authenticated PBX onboarding

`GET/POST /api/pbx-instances` and `GET/PATCH/DELETE /api/pbx-instances/:id` pass through the Task 5 session principal boundary; writes retain its Origin check. The API stores a server-generated UUID, display name, provider type, enabled flag, and timestamps in `pbx_instance`. `asterisk_config` stores the AMI host, port, and username. `pbx_secret` stores the encrypted AMI password; responses expose only presence. `PbxOnboardingService` owns validated changes and one SQLite transaction across metadata, secret writes, and setup state. The browser never receives decrypted credentials and clears entered secrets after submission. The only connection status in this phase is `UNVERIFIED`. A future provider phase must define the SSRF and monitoring-network policy before using stored addresses; no DNS lookup or PBX socket is performed now.
