# Proposed architecture

Status: Phase 6 Task 18 adds the provider-neutral system-metrics contract and collector boundary while retaining the completed telephony state foundations. CPU, memory, filesystem, uptime, and service-health samples are PBX-instance scoped and fail closed at the collector boundary. No real SSH collector, scheduling, persistence, or metrics API/UI exists yet. PBX networking remains disabled by default outside explicit validation/runtime opt-in.

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

The monitor is an observer. A failed monitor cannot stop calls. Optional restricted SSH collection is the planned source for system metrics and security logs using separate credentials. Shared contracts distinguish capability state (`SUPPORTED`, `UNSUPPORTED`, `NOT_CONFIGURED`, `PERMISSION_DENIED`, `UNKNOWN`) from source freshness (`NEVER_COLLECTED`, `CURRENT`, `STALE`, `UNAVAILABLE`, `ERROR`). Task 18 defines the system sample and validation boundary but does not yet implement SSH collection or source-health runtime.

## Repository layout

Proposed source directories: `backend/src/{providers,collectors,domain,state,storage,security,auth,api,realtime}`, `backend/tests`, `frontend/src/{components,pages,features,i18n,api}`, `frontend/tests`, `shared`, `mocks/asterisk`, `deploy/{nginx,docker}`, `.github/workflows`, `docs`, `scripts`, and ignored `.local`. Root deployment files include `docker-compose.yml` and `.env.example`. Create source directories when implementation begins.

## Runtime data

The administrator selects a persistent host directory, mounted at `/data` in the backend container. Proposed container paths: `/data/monitor.sqlite3` (including SQLite journal files) and `/data/secrets/master.key`; encrypted PBX credentials are rows in the database. A separate backup destination is operator-configured. Logs go to standard output with secret redaction and deployment-controlled retention. Host paths are configuration, never source constants. Database and key must be backed up together; encrypted credentials without the key may be unrecoverable.

## Secret storage

At startup, after migrations, create 32 random bytes with Node crypto only if the key is absent and no encrypted records exist. Exclusively create `<APP_SECRET_DIR>/master.key` under a mode-0700 directory with file mode 0600; load an existing valid owner-controlled key. Missing keys with encrypted data and unsafe or malformed keys stop startup. AES-256-GCM uses a fresh random 12-byte nonce and 16-byte tag. Envelope and key versions are both 1. AAD binds PBX instance ID, secret name, envelope version, and key version. `backend/src/security/secret-store.ts` is the sole plaintext encryption/decryption boundary; `backend/src/storage` persists only ciphertext and envelope metadata. No HTTP secret endpoint exists. Key rotation and backup/restore are future work. JavaScript cannot guarantee deterministic memory erasure. Password hashing parameters are recorded in Decision 26.

## First-run flow

An empty database creates a protected local bootstrap token; presenting it permits creation of exactly one first administrator through a setup-only endpoint with an atomic initialization guard. After login, the administrator adds a PBX profile, selects the Asterisk provider (displayed as Asterisk / FreePBX), and enters AMI details. The profile remains configured but unverified until an authenticated connection test succeeds. The browser supports edit, enable/disable, credential removal, local deletion, safe connection status, and manual verification. Network access is disabled by default and requires explicit runtime opt-in. Configuration changes require no image rebuild.

## Multi-PBX data model

`pbx_instance`: ID, display name, provider type, host, AMI/SSH port, enabled, discovered vendor/product/version/hostname/timezone, capability snapshot, connection state, last seen, created, updated. `pbx_secret`: PBX ID, validated provider-neutral secret name, versioned encrypted envelope. Every channel, call, bridge, endpoint, trunk, queue, agent, metric, security event, and historical row carries `pbx_instance_id`. Query and subscription authorization applies to the instance boundary. Missing data is never represented as a measured zero.

## System metrics collection

Task 18 introduces `SystemMetricsSample` contracts for CPU utilization percentage, total/available memory bytes, filesystem identity/mount with total/available bytes, uptime seconds, and generic service health. Each sample is scoped to one PBX instance, carries one UTC observation timestamp, and includes the same five system capability dimensions already used by `PbxCapabilities`. A supported dimension must include data; a non-supported dimension must not be represented as a synthetic zero.

`SystemMetricsCollector` is the transport boundary. Its current declared source is `SSH`, matching the planned restricted-host collection path, but Task 18 contains no SSH implementation. `collectSystemMetrics` validates instance/source identity, timestamps, capability/data consistency, CPU bounds, byte capacities, uptime, resource IDs, and duplicates, then returns a defensive clone. Unknown collector failures become the bounded `COLLECTION_FAILED` error; raw command output, host details, and arbitrary exception text do not cross the boundary. A future task supplies the restricted SSH transport, command allowlist, parser, credentials, scheduling, and source-health lifecycle.

## Asterisk provider

The shared `PbxProvider` contract defines `connect`, `disconnect`, `discover`, `getCapabilities`, `getHealth`, `getCurrentState`, `subscribeEvents`, and `reconcile`. Task 7 established the `AmiTransport` seam and network boundary. Task 8 added `TcpAmiTransport`, `NodeAddressResolver`, and `AsteriskProvider`. Task 10 added normalized live events. Task 11 adds ActionID-correlated AMI event-list requests and provider-neutral channel snapshots. A hostname is resolved once, every result is checked, and TCP connects to the selected numeric address so the transport cannot trigger a second DNS lookup.

The TCP transport validates the manager banner, frames actions with CRLF headers, injects an internal ActionID, allows one outstanding operation at a time, bounds response/list duration and buffered input, and publishes unsolicited event frames to internal listeners. It also assigns a process-unique connection generation and monotonic frame sequence. Event-list items and completion frames are correlated by ActionID and retain their source ordering metadata; a request may declare one item-event name or an explicit allowlist of multiple item-event names for provider actions such as `QueueStatus`. Correlated list items are not mixed into the live-event path. `AsteriskProvider` normalizes a deliberately bounded live-event subset and uses `CoreShowChannels` for a minimal authoritative channel snapshot. Agent capability remains `UNKNOWN` until a supported queue Agent lifecycle event is actually observed, at which point it becomes `SUPPORTED`; queue support alone does not imply AGENT-class event visibility. Cancelled, inconsistent, or incomplete lists are rejected rather than treated as valid state. Managed runtime entries subscribe before connect, so their `Login` requests events; one-shot connection verification has no event subscriber and keeps events disabled.

`ProviderRuntimeManager` owns at most one provider lifecycle per enabled PBX. With `APP_PBX_NETWORK_MODE=plain_tcp`, it connects asynchronously, publishes an initial channel snapshot when available, then refreshes that snapshot on the normal 45-second reconciliation interval while live normalized events continue through a separate subscription boundary. Snapshot consumers and event consumers do not create PBX connections. Snapshot-only degradation keeps the AMI connection and retries on the reconciliation interval; unusable connection health uses bounded reconnect backoff. With the default `disabled` mode, no real provider factory exists and no PBX network socket can be opened. Provider/PBX failures never make application readiness fail. Plain AMI TCP is not sufficient protection on an untrusted network; TLS or a protected private/tunneled deployment path remains a production prerequisite.

## Realtime and failure handling

`TelephonyStateEngine` now subscribes before provider runtime start and consumes authoritative channel snapshots, capability-aware chan_sip endpoint snapshots, outbound-registration trunk snapshots, queue/member/caller snapshots, normalized channel/queue/Agent live events, runtime connection-state changes, and profile-reset signals. Before the first snapshot it buffers events without claiming current state. Snapshot items use per-frame ordering to decide which interleaved events must be replayed; later reconciliation snapshots replace drift and replay only events newer than the relevant snapshot item boundary. New connection generations wait for a fresh snapshot, connection loss marks state `STALE`, and profile replacement/removal clears the old in-memory state. The engine emits ordered internal revisions and deterministic current calls by grouping channels on `linkedId` (falling back to channel ID). Endpoint, trunk, and queue snapshots use their own AMI collection boundaries; PeerStatus, Registry, and queue member/caller updates replay only when newer than the matching resource boundary. Unsupported or denied auxiliary sources remain unavailable rather than guessed. Queue waiting counts are derived from current queue-caller state, and caller numbers/names, channel names, pause reasons, and raw AMI fields are not retained in the queue model. Agent interactions have no authoritative Asterisk snapshot and are explicitly `LIVE_ONLY`: `AgentCalled`/`AgentConnect` create observed `RINGING`/`CONNECTED` interactions, while `AgentRingNoAnswer`, `AgentComplete`, and Asterisk `AgentDump` remove them. Connection loss clears observed Agent interactions; a fresh provider snapshot defines the new live observation boundary before buffered events are replayed. The trunk foundation intentionally models chan_sip outbound registrations only; static/IP-auth and PJSIP trunks remain future provider work. No telephony state is exposed by REST/WebSocket yet; authenticated realtime remains a later phase.

## Git and CI

Use `main` and short-lived feature branches, with Conventional Commits. Use only the user-supplied remote URL and do not overwrite a conflicting remote. Push only after public-source checks; do not force push or alter GitHub authentication. GitHub Actions uses pinned action versions and synthetic fixtures: install from lockfile, lint, typecheck, unit/integration tests with mock AMI, build, documentation checks, secret scan, and license audit. CI never contacts a production PBX.

## Documentation

English and Persian pairs: `README`, `INSTALL`, `CONFIGURATION`, `OPERATIONS`, `TROUBLESHOOTING`. Persian prose uses GitHub-compatible RTL containers while commands and paths stay LTR. Technical source-of-truth files are `PROJECT_CONTEXT`, `MASTER_PLAN`, `DECISIONS`, and `ARCHITECTURE`. Public project policy files are `SECURITY`, `CONTRIBUTING`, `CHANGELOG`, `LICENSE`, and `NOTICE`. Full installation and restore instructions are pending tested deployment.

## Toolchain foundation

Root npm workspaces and a strict shared TypeScript base config are in place. See [Toolchain](TOOLCHAIN.md) for package management, lint, formatting, testing, and current CI scope. Compose declares no runnable services until Phase 2 supplies build contexts.

## Implemented application foundation

`backend/src/index.ts` validates configuration, opens and migrates SQLite, initializes the master key and secret store, then starts a Node HTTP server; it closes secret storage and SQLite on graceful shutdown. `backend/src/server.ts` serves `GET /health` for liveness and `GET /ready` for core application readiness. The frontend renders English/Persian first-admin setup, login, and authenticated PBX management flows using same-origin APIs. `shared/src/index.ts` now contains type-only provider-neutral telephony and system-metric contracts. `backend/src/config.ts` is the sole process environment parsing boundary and validates generic application settings with Zod. Local authentication, Asterisk transport, provider runtime, in-memory channel/call plus chan_sip endpoint, outbound-registration trunk, queue/member/caller and live-only agent interaction state, and the Task 18 system-metrics collector boundary exist; real system collection, metric persistence/history, and realtime metrics delivery are not implemented yet. Storage interfaces in `backend/src/storage/index.ts` isolate SQLite statements from the HTTP layer. Versioned SQL migrations and their checksums are source-controlled in `backend/src/storage/migrations.ts`; applied versions are recorded in `schema_migrations`. Migration 1 contains `application_state` and non-secret `pbx_instance` metadata. Migration 2 adds `pbx_secret` with a foreign key to the PBX instance. Migration 3 adds administrator and session tables. Migration 4 adds profile enablement, provider-scoped Asterisk connection metadata, and the configured-unverified setup state. Migration 5 adds `last_verified_at` to the Asterisk profile configuration. The initial setup state is `SETUP_REQUIRED`; first-admin creation advances it to `SETUP_IN_PROGRESS`. The build writes ignored `dist/`; runtime initialization writes the SQLite database and master key at configured paths outside Git.

## Local authentication foundation

Migration 3 adds `administrator` and `auth_session`. The first administrator is guarded by a protected local bootstrap token and a SQLite write transaction. Creating it moves `application_state` from `SETUP_REQUIRED` to `SETUP_IN_PROGRESS`; PBX onboarding remains future work. Passwords are salted scrypt records. The browser receives a 256-bit random cookie token; SQLite stores only its SHA-256 digest and absolute expiry. `AuthService.principal` is the reusable backend authentication boundary. Same-origin POST checks compare Origin with Host and require HTTPS in production. `/health` stays generic; `/ready` requires initialized authentication storage but does not depend on administrator or PBX setup state. The reverse proxy must preserve a trustworthy Host and enforce HTTPS in production.

## Authenticated PBX onboarding

`GET/POST /api/pbx-instances` and `GET/PATCH/DELETE /api/pbx-instances/:id` pass through the Task 5 session principal boundary; writes retain its Origin check. The API stores a server-generated UUID, display name, provider type, enabled flag, and timestamps in `pbx_instance`. `asterisk_config` stores the AMI host, port, and username. `pbx_secret` stores the encrypted AMI password; responses expose only presence. `PbxOnboardingService` owns validated changes and one SQLite transaction across metadata, secret writes, and setup state. The browser never receives decrypted credentials and clears entered secrets after submission. The browser can now display in-memory provider connection state and trigger an authenticated same-origin connection test. A successful test records the last verification time and safe discovery metadata; connection-affecting edits invalidate verification. The provider-status endpoint exposes safe health only. The Task 7 SSRF/network policy remains mandatory for all real connections.
