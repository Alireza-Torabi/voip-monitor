# Planning decisions — 2026-09-23

Earlier product architecture decisions remain proposals. The Phase 2 Task 1 choices below are implemented and locally validated.

1. **Separate observer:** Run monitoring on a separate VM, outside PBX call processing. The backend owns one persistent AMI connection per enabled PBX.
2. **Provider boundary:** Use a `PbxProvider` interface for lifecycle, read-only discovery, capabilities, health, snapshot, events, and reconciliation. Asterisk specifics live in the Asterisk adapter. No other provider support is claimed.
3. **Persistence:** Start with SQLite behind repository interfaces. Key all PBX data by instance ID.
4. **Secrets:** Encrypt PBX credentials at rest using Node crypto authenticated encryption. Store a random master key in a protected persistent file outside Git. Back up key and database together.
5. **Realtime:** Use authenticated WebSocket snapshots and revisioned incremental updates. Browser count must not drive PBX requests.
6. **Public source:** Use Apache-2.0, with private deployment facts only in ignored `.local/`.

7. **Toolchain foundation:** Use Node.js 24 LTS with npm workspaces, one lockfile, strict shared TypeScript options, and workspace-specific configs when source exists. No packages were installed during Phase 1; see `docs/TOOLCHAIN.md` for the Phase 2 toolchain.
8. **Compose staging:** Keep `docker-compose.yml` free of dummy runnable services until actual backend/frontend images exist. CI currently validates only existing foundation artifacts.

## 2026-09-23 — Phase 2 Task 1 implementation choices

9. **User-owned toolchain:** Use the official Node.js 24.21.0 Linux archive verified against its published SHA-256 list in an ignored local directory for development. No sudo, OS repository, or PBX toolchain change is needed. Public contributors may use another trusted installation method that supplies the pinned Node version.
10. **Minimal HTTP server:** Use Node's built-in HTTP server for the current single `/health` route, avoiding a framework dependency until API requirements justify one. Log JSON records and handle SIGINT/SIGTERM gracefully.
11. **Minimal i18n:** Keep English and Persian messages in a typed dictionary and switch document direction with language. Defer a larger localization library until translation volume justifies it.
12. **Quality gates:** Use one npm lockfile, ESLint, Prettier, TypeScript, Node's test runner, and Vitest. CI installs with scripts disabled and reviews lockfile license identifiers.

## 2026-09-24 — Phase 2 Task 2 implementation choices

13. **Shared contract boundary:** Keep provider-neutral PBX identity, capability, health, discovery, and provider interface types in `shared`; implementations remain in backend provider modules. Current types describe only the known Asterisk provider and proposed data-source categories.
14. **Central application configuration:** Parse named process environment settings once in `backend/src/config.ts` with Zod 4.6.5. Reject invalid explicit values before listening. Defaults cover only generic application settings; path settings are reserved and do not create storage.
15. **PBX setup separation:** Do not model PBX instance addresses or credentials as permanent process environment variables. Future PBX metadata belongs in runtime persistence and credentials in dedicated protected secret storage.
16. **Explicit source health:** Model capability support separately from source freshness and connection state. Use bounded safe error codes rather than raw provider error messages in shared contracts.
17. **Safe startup diagnostics:** Configuration errors report field names only. Structured log details redact sensitive field names. The health endpoint remains generic.

## 2026-09-24 — Phase 2 Task 3 implementation choices

18. **SQLite runtime:** Use Node.js 24.21.0 built-in `node:sqlite` (`DatabaseSync`, release candidate stability 1.2) behind backend storage interfaces. It supports prepared statements, explicit SQL transactions, and an online backup API. `better-sqlite3` is mature and MIT licensed, but adds a native addon, install/build requirements, and Docker platform considerations without a current capability benefit. Neither option needs an ORM. Node's bundled SQLite is covered by the Node distribution license; no direct dependency was added. Reevaluate the release candidate API before a production release. [Node SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [better-sqlite3 package](https://github.com/WiseLibs/better-sqlite3/blob/master/package.json), [license](https://github.com/WiseLibs/better-sqlite3/blob/master/LICENSE).
19. **Storage lifecycle:** Open from validated `AppConfig.databasePath`, create its parent with mode 0700 where absent, create the database with a restrictive umask and mode 0600, enable foreign keys, set a 5-second busy timeout, run ordered transactional migrations, and only then listen. Startup storage failure logs a safe code and exits with status 1. Close the database after HTTP shutdown. Use SQLite's default journal mode for now; no concurrent writer workload warrants WAL yet. Future backups should use the SQLite backup API or a coordinated stopped copy, including any journal files where relevant.
20. **Setup and PBX persistence:** The single setup row starts at `SETUP_REQUIRED`; `SETUP_IN_PROGRESS` and `COMPLETE` are reserved future transitions, not claims that an administrator exists today. Persist only provider-neutral PBX identity and discovery metadata currently present in shared contracts. Addresses, ports, connection state, capabilities, and secrets await justified models. Future PBX-owned rows must carry `pbx_instance_id`.
21. **Readiness:** `/health` is process liveness and `/ready` checks the core storage connection after configuration and migrations succeeded. An offline or absent PBX never changes application readiness.

## 2026-09-24 — Phase 2 Task 4 implementation choices

22. **Key creation and storage:** During startup, after SQLite migrations and before HTTP, create a random 256-bit master key at `<APP_SECRET_DIR>/master.key` if absent and no encrypted records exist. Use exclusive creation, mode 0600, and a mode-0700 directory. Existing keys are loaded only if they are regular, owner-controlled, restricted, and exactly 32 bytes. A missing key with encrypted records, malformed key, unsafe permissions, or unusable directory stops startup; nothing is silently replaced. The key remains outside SQLite, Git, images, HTTP, and logs.
23. **Envelope and binding:** Encrypt each secret with Node `crypto` AES-256-GCM, a fresh random 96-bit nonce, and a 128-bit tag. Envelope version 1 and key version 1 are stored alongside nonce, tag, and ciphertext. AAD is the deterministic JSON array `[pbxInstanceId, secretName, envelopeVersion, keyVersion]`, so swapping records or metadata fails authentication. Secret names and instance IDs are validated as bounded data, and SQL uses bound parameters. No protocol-specific secret names are required by storage.
24. **Readiness and recovery:** `/ready` requires a working database and an intact matching master-key file; `/health` remains process liveness. Backup and restore are not implemented. Future recovery needs the corresponding database and master key, plus runtime configuration as applicable, with separate access controls where practical. A database without its key may leave encrypted credentials permanently unrecoverable; the key alone cannot recreate database records. Key rotation is not implemented; envelope and key versions allow a future controlled decrypt-and-re-encrypt migration with both keys available. JavaScript cannot guarantee deterministic erasure of plaintext or key copies from memory.

## 2026-09-24 — Phase 2 Task 5 authentication decisions

25. **First administrator:** A 256-bit random hex token is created exclusively at `<APP_SECRET_DIR>/bootstrap-admin.token` under a 0700 directory with mode 0600. It is never returned or logged. The operator reads it through trusted local access. A single SQLite `BEGIN IMMEDIATE` transaction guards the first administrator insert and advances setup to `SETUP_IN_PROGRESS`. Any existing administrator makes the token ineffective. Delete the file after success; if deletion fails, warn without its contents and retry cleanup on restart. There is no automatic administrator reset.
26. **Password hashing:** Use Node.js 24 built-in asynchronous scrypt with N=32768, r=8, p=1, a random 16-byte salt, 32-byte output, and 64 MiB maxmem. The encoded record includes algorithm, version, parameters, salt, and digest; verification rejects unsupported parameters. Scrypt is memory-hard, maintained with Node, works with `npm ci --ignore-scripts`, adds no native addon or Docker build step, and inherits Node's distribution license. Argon2id is a strong alternative, but the maintained `node-argon2` package adds native builds and install scripts; Node's built-in Argon2 API is still release candidate in Node 24. Future parameter increases need a compatible verifier and controlled rehash. Usernames use NFKC normalization, ASCII lowercase, and a 3–64 character restricted alphabet; passwords accept 12–256 Unicode code points and at most 1024 UTF-8 bytes, with no character-class rules or truncation. [Node crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html), [node-argon2 project](https://github.com/ranisalt/node-argon2).
27. **Sessions and CSRF:** Generate a 256-bit opaque session token; store only its SHA-256 digest in SQLite. A 12-hour absolute expiry survives restart; logout deletes the row. `vm_session` uses HttpOnly, SameSite=Strict, Path=/, Max-Age=43200, and Secure in production. The API requires an exact same-host Origin with HTTPS in production (HTTP in development/test) for every POST; no proxy IP header is trusted and no credentialed CORS is enabled. A process-local one-minute counter limits setup and login attempts per socket IP and globally; it resets on restart. HTTPS termination and the Host header must be controlled by the deployment reverse proxy.

## 2026-09-25 — Phase 2 Task 6 onboarding decisions

28. **Provider-scoped configuration:** Keep identity and enablement in `pbx_instance`; migration 4 adds `asterisk_config` for validated AMI host, port, and username. FreePBX is represented through the Asterisk provider, not a separate vendor. Only the AMI password is a current credential and is encrypted as `ami-password` through `SecretStore`; SSH setup waits for its collector phase. Host validation is syntactic (DNS name, IPv4, IPv6) and never resolves or connects. Existing imported metadata rows are unchanged and do not become onboarded profiles until provider configuration exists.
29. **Atomic onboarding:** `PbxOnboardingService` wraps profile metadata, encrypted secret writes, and setup-state changes in one SQLite `BEGIN IMMEDIATE` transaction. Creation requires a nonempty password; PATCH omission preserves it, a nonempty value replaces it, and `removeAmiPassword: true` explicitly removes it. Empty replacement and conflicting replace/remove requests fail validation. Responses contain only `hasAmiPassword`, never plaintext or envelope internals. Deletion cascades encrypted records and restores `SETUP_IN_PROGRESS` when the final profile is removed. The first profile advances to `PBX_CONFIGURED_UNVERIFIED`, not `COMPLETE`; all profiles report `UNVERIFIED` until future provider verification.
30. **Browser and network boundary:** A bilingual same-origin browser flow handles first-admin setup, explicit login, and authenticated PBX management. Vite proxies local development API calls to the backend without weakening Origin checks; production still needs a controlled HTTPS reverse proxy. Only language preference uses localStorage. Development-only jsdom tests exercise form submission and clearing; no form/state runtime library was added. No onboarding code resolves names or opens PBX sockets. Before future provider connectivity, define a deliberate SSRF/network policy for administrator-entered private addresses, loopback, link-local and metadata-service ranges, DNS rebinding, and allowed monitoring-network scope. Do not apply a superficial hostname blacklist or assume all private addresses are forbidden.

## 2026-09-25 — Phase 2 Task 7 network-boundary and mock transport decisions

31. **PBX network boundary:** Private RFC1918 IPv4 and IPv6 ULA addresses are intentionally allowed because monitored PBXs commonly live on administrator-managed private networks. Unspecified, loopback, link-local, multicast, IPv4 broadcast, and the known IPv6 AWS metadata endpoint `fd00:ec2::254` are rejected before transport use. Hostnames must be resolved once by an injected resolver; every returned address is checked, and a future real transport must connect to one of those already-approved addresses rather than perform a second name resolution. This makes DNS rebinding a deliberate transport responsibility instead of relying on a hostname blacklist.
32. **No real transport yet:** Task 7 adds only an `AmiTransport` interface, deterministic `MockAmiTransport`, and `AsteriskConnection` orchestration with injected resolver/transport dependencies. There is deliberately no concrete DNS resolver, `net.Socket`, AMI framing, authentication, or provider discovery implementation, so tests and CI cannot contact a PBX through this foundation.
33. **Mock-first provider development:** AMI protocol behavior will be developed against synthetic handlers/fixtures before any approved real-PBX test. Browser count must never create additional provider connections; the eventual runtime owns one provider connection lifecycle per enabled PBX instance.

## 2026-09-25 — Phase 2 Task 8 AMI transport and provider decisions

34. **AMI wire transport:** Implement a small Node `net.Socket` transport rather than adding an AMI dependency. It connects only to the numeric address already approved by the Task 7 network boundary, validates the Asterisk manager banner, emits CRLF-delimited AMI actions with an internal `ActionID`, serializes one outstanding action at a time, applies bounded timeouts and a receive-buffer limit, rejects header injection, and correlates only response frames. Unsolicited events are deliberately ignored until the event-subscription task. The application does not instantiate this transport yet. [AMI v2 specification](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/) · [AMI command syntax](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-Command-Syntax/)
35. **Provider login and discovery:** `AsteriskProvider` authenticates with the standard AMI `Login` action using `Events: off`, then uses `CoreSettings` for the Asterisk version and `Ping` for reconciliation. `CoreSettings` exists since Asterisk 1.6, so it covers the required Asterisk 13 baseline. Discovery does not infer unsupported capabilities; all capability fields remain `UNKNOWN` until later action/permission probing is designed. The password is obtained through an injected reader and its Buffer is zeroed after login; JavaScript cannot guarantee erasure of the temporary string used to serialize the AMI action. [Login action](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/Login/) · [CoreSettings action](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/CoreSettings/)
36. **Plain TCP is not deployment security:** The TCP transport implements the current AMI protocol path but does not claim encryption. Task 9 wires it into runtime only behind the explicit, default-disabled `APP_PBX_NETWORK_MODE=plain_tcp` gate. A production deployment must model AMI TLS or use a trusted/private network or protected tunnel appropriate to the deployment; AMI must not be exposed to an untrusted/public network merely because the client transport exists. The Asterisk sample configuration itself warns against exposing AMI on a public IP.
37. **Mock-first runtime boundary:** Unit tests exercise provider behavior with `MockAmiTransport`; protocol integration tests use an in-process synthetic AMI server bound only to loopback and bypass the production network policy intentionally at the low-level transport seam. No test resolves or connects to a real PBX. Task 9 preserved this mock-first boundary and did not contact a real PBX; future real-PBX tests still require explicit approval.

## 2026-09-25 — Phase 2 Task 9 runtime lifecycle and verification decisions

38. **Explicit PBX network gate:** Add `APP_PBX_NETWORK_MODE` with a safe default of `disabled`. The only current active mode is `plain_tcp`, which is an explicit operator opt-in for a trusted/protected network path. Disabled mode constructs no real provider factory and therefore cannot open a PBX socket. Application readiness remains independent of PBX connectivity.
39. **One runtime owner per enabled PBX:** `ProviderRuntimeManager` owns at most one managed provider instance per enabled profile with a stored AMI credential. It connects asynchronously after startup, reconciles every 45 seconds by default, and reconnects after failures with bounded exponential backoff from 1 second to 60 seconds plus 0.8–1.2 jitter. CRUD reloads or stops the corresponding runtime entry without making browser count drive PBX connections.
40. **Manual verification and discovery:** An authenticated same-origin `POST /api/pbx-instances/:id/test-connection` uses the managed provider when present or one isolated ephemeral provider for a disabled profile. Successful discovery persists safe Asterisk metadata and `last_verified_at`, then advances setup to `COMPLETE`. Connection-affecting profile or credential changes clear that verification; setup falls back to `PBX_CONFIGURED_UNVERIFIED` unless another profile remains verified. `GET /api/pbx-instances/:id/provider-status` exposes only safe runtime health/state.
41. **Network failures are not application failures:** Provider start/reconnect errors are contained inside the runtime manager and never fail `/ready`. API verification maps errors to bounded public codes such as `pbx_network_disabled`, `ami_credential_missing`, and `connection_failed`; raw DNS, socket, AMI, or credential details are not returned.

## 2026-09-25 — Phase 2 Task 10 AMI event decisions

42. **Transport event seam:** Extend `AmiTransport` with listener subscription. `TcpAmiTransport` now publishes parsed AMI event frames while preserving ActionID-correlated request/response handling. Listener exceptions are isolated so one consumer cannot break socket frame processing. `MockAmiTransport.emitEvent()` supplies deterministic synthetic events without network access.
43. **Provider-neutral event boundary:** Add a discriminated `ProviderEvent` union in the shared package and expose `PbxProvider.subscribeEvents()`. Asterisk-specific raw event names and arbitrary AMI fields do not cross this boundary. The initial normalized set covers channel creation/state/destruction, dial begin/end, bridge enter/leave, and chan_sip peer status. Unknown or identity-incomplete AMI events are dropped rather than forwarded as raw maps.
44. **Managed event ownership:** `ProviderEntry` subscribes to its provider before connecting, so managed Asterisk logins request events while one-shot verification providers keep AMI events disabled. `ProviderRuntimeManager.subscribeEvents()` forwards cloned normalized events to future state-engine consumers without creating additional PBX/provider connections. Browser count still cannot drive AMI work.
45. **No state claims yet:** Task 10 is an ingestion/normalization foundation only. It does not maintain current calls/channels, persist events, expose an event API/WebSocket, or reconstruct state after reconnect. The next task must add AMI event-list response correlation and a deterministic initial channel snapshot/reconciliation path before the live state engine can be considered reliable.

## 2026-09-25 — Phase 2 Task 11 snapshot and portability decisions

46. **AMI event-list correlation:** Extend `AmiTransport` with an ActionID-correlated event-list request. A matching successful response starts collection; only the configured item event and completion event with the same ActionID belong to the list. Interleaved unsolicited live events still flow to event subscribers. Cancelled, unexpected, timed-out, or incomplete lists fail closed instead of returning a partial snapshot.
47. **Minimal channel snapshot:** `AsteriskProvider.getCurrentState()` uses `CoreShowChannels` and maps `CoreShowChannel` items into provider-neutral channel identity, channel name, linked ID, state, and bridge ID. Caller identity, connected-line identity, dialplan/application details, raw AMI maps, and arbitrary fields are deliberately excluded from the foundation snapshot. If `ListItems` is supplied, it must match the number of correlated items. A successful channel snapshot marks the channel capability `SUPPORTED`.
48. **Snapshot reconciliation without reconnect storms:** Managed providers publish an initial snapshot after AMI login and refresh it on the normal reconciliation interval. A snapshot failure while AMI remains connected leaves the provider `DEGRADED` and retries reconciliation without disconnecting/reconnecting. Only unusable connection health enters the reconnect path. This distinguishes a PBX/network failure from a missing/denied snapshot capability.
49. **Future state-engine handoff:** Runtime exposes separate normalized live-event and snapshot subscriptions plus a safe current-snapshot read. A future state engine must subscribe before runtime start, buffer live events until the first authoritative snapshot, then apply buffered events idempotently and use later reconciliation snapshots to repair drift. Task 11 does not yet implement that reducer/state machine.
50. **Portable public repository, private deployments:** Tracked source and documentation remain organization-neutral. Deployment-specific hostnames, addresses, credentials, topology, databases, master keys, and operational facts live only in ignored/runtime storage on the deployment host. Before production release, the repository must contain a tested fresh-install/onboarding/upgrade/backup/restore runbook that can create a new service for another organization without reusing private values from an existing deployment.

## 2026-09-25 — Phase 2 Task 12 real-PBX verification decisions

51. **Controlled real-PBX gate:** Real compatibility validation uses the same `AsteriskProvider`, network policy, resolver, and TCP transport as the application rather than a separate protocol implementation. The verifier may perform only AMI login/logoff, `CoreSettings`, `CoreShowChannels`, passive event observation, and snapshot reconciliation. It must not originate, redirect, hang up, reload, execute CLI commands, or write PBX configuration.
52. **Local-only input handoff:** Real target metadata and the AMI password are entered interactively on the monitoring host through `scripts/setup-real-pbx-verification.sh`. The password is never a command-line argument or tracked environment value. Config, password, and detailed result are confined to ignored `.local/real-pbx-verification/`, with directory mode 0700 and files mode 0600; the verifier refuses files outside that local directory.
53. **Safe output boundary:** Console output from the real verifier is limited to PASS/FAIL and bounded error codes. Detailed version, counts, and normalized event-type observations remain in the ignored local result. Raw AMI frames, channel identities, target host, username, and credentials are not printed or committed.
54. **Asterisk 13 permission model:** The Asterisk 13 source registers `CoreSettings` and `CoreShowChannels` with `system|reporting` action authority and authorizes actions when the user's write-permission mask overlaps that authority. The narrower permission for this probe is therefore `write = reporting`; normalized channel/call events require `read = call`. Preserve deployment ACL restrictions and do not add broader categories such as `system`, `command`, `originate`, `config`, or `all` automatically.
55. **No CI real-PBX access:** CI only syntax-checks the compatibility tooling and continues to use synthetic/loopback tests for provider behavior. CI never receives real PBX values and never opens a connection to a production PBX.
56. **Compatibility claim boundary:** One controlled real Asterisk 13.x gate has passed for login, discovery, channel snapshot/reconciliation, normalized live call events, and clean disconnect using the same provider/runtime boundaries as the application. This is a baseline, not a blanket compatibility claim for all Asterisk/FreePBX releases, channel drivers, queue/agent features, or deployment topologies.

## 2026-09-25 — Phase 2 Task 13 telephony state decisions

57. **Ordered snapshot/event handoff:** AMI frames carry a process-unique connection generation and monotonic frame sequence when produced by the TCP transport. Event-list snapshot items keep their source sequence and snapshots keep their collection-start boundary. The state engine uses per-channel item order, not timestamps alone, to decide which interleaved live events must be replayed after a snapshot.
58. **Deterministic reducer:** The first telephony state model is intentionally minimal: current channels plus current calls. Calls are deterministic groups keyed by `linkedId` when present and otherwise by channel ID. Channel create/state/hangup and bridge enter/leave events update current state; dial events may enrich known channel grouping. Endpoint events are not yet part of this reducer.
59. **Freshness and reconnect semantics:** The state engine subscribes before provider runtime start. Before the first snapshot it buffers events without claiming current state. Connection loss marks initialized state `STALE`; reconnect changes it to `AWAITING_SNAPSHOT`, and only a fresh authoritative snapshot restores `CURRENT`. A newer connection generation is buffered until that snapshot arrives.
60. **Profile lifecycle isolation:** Runtime profile replacement and removal emit an internal reset signal. The state engine discards prior per-instance state on reset so a newly configured provider never inherits the previous provider instance's channels/calls.
61. **Bounded buffering:** Each PBX event journal is capped at 10,000 entries. If events are dropped before a safe snapshot boundary is available, the engine does not manufacture state; it waits for a later snapshot whose collection starts after the discarded boundary.
62. **Internal-only foundation:** Task 13 state stays in memory and is not persisted or exposed by REST/WebSocket. Revisions and internal subscriptions exist for future API/realtime work, but browser count still cannot increase AMI work.

## 2026-09-25 — Phase 2 Task 14 endpoint/registration state decisions

63. **Independent endpoint snapshot boundary:** Channel and endpoint inventories are separate AMI event-list actions and therefore have separate collection windows. `ProviderStateSnapshot.endpointState` carries its own generation/start-sequence/timestamps so PeerStatus events interleaved with `SIPpeers` can be replayed against the correct boundary rather than the earlier channel snapshot boundary.
64. **chan_sip foundation only:** The first authoritative endpoint source is Asterisk `SIPpeers` with `PeerEntry`/`PeerlistComplete`. Endpoint identity is normalized as `<Channeltype>/<ObjectName>` when the channel type is present. PJSIP actions/events are deliberately not inferred from chan_sip behavior and remain future compatibility work.
65. **Provider-neutral endpoint state:** Public internal contracts expose only endpoint ID plus normalized registration (`REGISTERED`/`UNREGISTERED`/`UNKNOWN`) and reachability (`REACHABLE`/`UNREACHABLE`/`UNKNOWN`). Raw peer addresses and arbitrary AMI fields do not cross the provider boundary. For dynamic chan_sip snapshot entries, registration is inferred from the dynamic flag and whether a bound IP address exists; static peers remain registration `UNKNOWN`.
66. **Capability-aware degradation:** Endpoint-list permission denial or unsupported action marks only endpoint capability as `PERMISSION_DENIED` or `UNSUPPORTED`; a valid channel snapshot remains usable. Other endpoint-list failures still fail the provider snapshot so transport/protocol faults are not silently hidden.
67. **Partial live-event semantics:** `PeerStatus` events can describe registration or reachability independently. An `UNKNOWN` dimension in a normalized live event means no authoritative change for that dimension and therefore preserves the current endpoint value. Endpoint events are not promoted to current state before a supported authoritative endpoint snapshot.

## 2026-09-25 — Phase 2 Task 15 trunk state decisions

68. **Trunk scope is explicit:** Do not classify every SIP peer as a trunk. The first provider-neutral trunk kind is `OUTBOUND_REGISTRATION`, representing registrations Asterisk itself maintains toward an external SIP service. Static/IP-auth trunks that do not register are outside this foundation rather than guessed from peer metadata.
69. **chan_sip authoritative trunk source:** For the Asterisk 13 baseline, use the read-only `SIPshowregistry` event-list action with `RegistryEntry` items and `RegistrationsComplete` completion. Each item is reduced to a provider-derived `SIP/<username>@<domain>` trunk identity plus normalized registration state; host/port/refresh/raw fields do not cross the provider boundary. The action has existed since Asterisk 1.6. [SIPshowregistry](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Actions/SIPshowregistry/)
70. **Registration state normalization:** Provider-neutral trunk registration states are `REGISTERED`, `UNREGISTERED`, `REGISTERING`, `REJECTED`, `FAILED`, and `UNKNOWN`. Asterisk 13 chan_sip snapshot states `Request Sent` and `Auth. Sent` map to `REGISTERING`; `No Authentication` maps to `FAILED`. Unknown provider strings remain `UNKNOWN` rather than being guessed.
71. **Live Registry boundary:** Normalize the AMI `Registry` event into the same trunk identity and registration state without forwarding `Cause` or arbitrary raw fields. The event has existed since Asterisk 12 and belongs to the SYSTEM event class. [Registry event](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/Registry/)
72. **Capability-aware degradation:** A denied or unsupported `SIPshowregistry` action marks only trunk capability as `PERMISSION_DENIED` or `UNSUPPORTED`; valid channel and endpoint snapshots remain usable. Other registry-list failures still fail the combined provider snapshot so protocol/transport corruption is not hidden.
73. **Independent ordering and overflow safety:** Trunk snapshots carry their own generation/start sequence/timestamps. Registry events replay only against that trunk boundary. If the bounded event journal has discarded data, every supported independent snapshot boundary (channels plus endpoint/trunk snapshots) must be newer than the dropped boundary before the engine claims current state.

## 2026-09-25 — Phase 2 Task 16 queue state decisions

74. **Mixed-item AMI event lists:** `AmiEventListSpec` supports either one `itemEvent` or an explicit `itemEvents` allowlist. The TCP transport still accepts only ActionID-correlated names declared by the caller and rejects unexpected correlated event types; `QueueStatus` uses exactly `QueueParams`, `QueueMember`, and `QueueEntry` with `QueueStatusComplete` as the completion event.
75. **QueueStatus is the authoritative queue snapshot source:** The Asterisk provider collects queue definitions, members, and currently waiting callers from one read-only `QueueStatus` list. Completion `ListItems` must equal the total accepted correlated item count or the snapshot fails closed. Asterisk documents `QueueStatus` as the queue-status action; `QueueMember` and `QueueEntry` are its response events. See https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/QueueStatus/ .
76. **Minimal queue data boundary:** Queue snapshots expose queue ID/strategy; member ID/name plus normalized availability, pause, and in-call booleans; and queued caller Uniqueid/position/wait seconds. CallerID number/name, channel name, state-interface, pause reason, penalty/statistics, and arbitrary raw AMI fields do not cross the provider boundary.
77. **Queue member availability normalization:** Asterisk numeric device states map to provider-neutral states: `1=AVAILABLE`, `2=IN_USE`, `3=BUSY`, `4=INVALID`, `5=UNAVAILABLE`, `6=RINGING`, `7=RINGING_IN_USE`, `8=ON_HOLD`; all other values become `UNKNOWN`. The mapping follows the documented `QueueMemberStatus` status values. See https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/AMI_Events/QueueMemberStatus/ .
78. **Live queue event scope:** Full member-state events (`QueueMemberStatus`, `QueueMemberAdded`, `QueueMemberPause`, `QueueMemberPenalty`, `QueueMemberRinginuse`) normalize to `QUEUE_MEMBER_CHANGED`; `QueueMemberRemoved` removes a member. `QueueCallerJoin` adds/updates a waiting caller; `QueueCallerLeave` and `QueueCallerAbandon` remove it from current state. Historical abandon/leave analytics are deferred to the future persistence/history phase.
79. **Derived waiting count:** Public current queue `waitingCount` is derived from the current normalized caller map rather than copied from a potentially stale aggregate field. This keeps the value consistent with replayed caller join/leave events between periodic snapshots.
80. **Independent queue ordering and capability:** Queue snapshots have their own generation/start sequence/timestamps and participate in bounded-journal recovery. Denied or unsupported `QueueStatus` marks only queue capability unavailable; valid channel, endpoint, and trunk state remains usable. Live queue events are AGENT-class in Asterisk and require a future controlled compatibility gate before production support is claimed.

## 2026-09-25 — Phase 2 Task 17 agent interaction decisions

81. **Agent interaction scope and identity:** Current queue Agent interactions are provider-neutral records keyed by queue ID + caller channel Uniqueid + member interface. This supports ring-all, where one caller can have simultaneous attempts to multiple members without collisions. Current phases are intentionally only `RINGING` and `CONNECTED`.
82. **Asterisk lifecycle mapping:** `AgentCalled` creates/updates a `RINGING` interaction; `AgentConnect` creates/updates `CONNECTED`; `AgentRingNoAnswer` and `AgentComplete` terminate the matching current interaction. Asterisk 13 `AgentDump` is also normalized as `AGENT_DUMPED` and terminates the matching interaction because source inspection shows it can occur after the member answers but before `AgentConnect`; ignoring it would leave an orphan ringing interaction.
83. **Live-only authority model:** Asterisk exposes no authoritative event-list snapshot of active Agent call attempts equivalent to `QueueStatus`. Agent interaction state is therefore explicitly `LIVE_ONLY`, not `CURRENT`. The first accepted provider snapshot establishes the observation boundary; only Agent events newer than that boundary are replayed into the initial live-only set. Periodic snapshots do not erase already observed Agent interactions.
84. **Reconnect fail-closed behavior:** Connection loss clears all observed Agent interactions and marks Agent synchronization `STALE`. A new connection generation buffers Agent events until a fresh provider snapshot establishes the new observation boundary, then replays only newer events. This deliberately under-reports rather than carrying stale interactions across a disconnect.
85. **Minimal Agent data boundary:** Normalized Agent interaction identity exposes queue ID, caller channel Uniqueid, member interface, and optional member name. CallerID number/name, caller/agent channel names, destination-channel identifiers, raw AMI maps, and `RingTime`/`HoldTime`/`TalkTime` do not cross into current-state contracts. `AgentComplete.Reason` is normalized to `CALLER`, `AGENT`, `TRANSFER`, or `UNKNOWN` on the terminal event but is not retained because history is not implemented.
86. **Observed capability only:** Agent capability begins `UNKNOWN` and becomes `SUPPORTED` only after the provider actually receives one of the supported Agent lifecycle events. Queue capability or AMI login alone is not treated as proof that AGENT-class event visibility is available.
87. **Compatibility claim boundary:** Task 17 is synthetic/mock only. Queue/Agent lifecycle events are AGENT-class in Asterisk 13 and have not yet been verified on the approved production PBX; no production compatibility claim is made for these events. Agent login/logoff presence remains outside Task 17.

## 2026-09-25 — Phase 6 Task 18 system metrics decisions

88. **Provider-neutral system metric contract:** System samples are PBX-instance scoped and model CPU utilization percentage, memory total/available bytes, filesystem ID/mount plus total/available bytes, uptime seconds, and generic service health (`ACTIVE`, `INACTIVE`, `FAILED`, `UNKNOWN`). The shared `SystemMetricCapabilities` type is also the `PbxCapabilities.system` shape so capability semantics cannot drift between discovery and metrics.
89. **Missing is not zero:** A capability marked `SUPPORTED` must carry its matching metric data in a collected sample. Any other capability state must omit that dimension. The collector boundary never substitutes `0` for unavailable, denied, unsupported, unknown, or not-configured data.
90. **Restricted SSH is the planned source, not implemented transport:** `SystemMetricsCollector` currently declares `SSH` as its source because architecture assigns host metrics to a separate restricted SSH path. Task 18 adds no SSH socket, library, command execution, key/password handling, host-key policy, or production network access.
91. **Fail-closed sample validation:** Before future persistence/API use, the collection boundary validates PBX instance/source identity, UTC timestamps, all five capability keys, CPU 0–100 bounds, safe non-negative byte/uptime values, available capacity not exceeding total, non-empty filesystem/service identifiers, and duplicate filesystem/service IDs. Malformed runtime shapes from JavaScript collectors are rejected with `INVALID_SAMPLE`.
92. **Bounded collector failures:** Unknown collector exceptions are converted to `COLLECTION_FAILED`; arbitrary exception text, command output, target details, and other raw transport data are not forwarded across the collection boundary. Already-bounded `SystemMetricsCollectorError` values are preserved.
93. **Defensive ownership boundary:** Accepted samples are returned as a structured clone so a collector cannot mutate data after the boundary hands it to a future state/persistence consumer.
94. **Phase boundary:** Task 18 intentionally stops before scheduling, current metric state, source-health runtime, persistence/history, REST/WebSocket exposure, alerting, or UI. The next task establishes the restricted SSH transport/parser boundary using synthetic/mock validation before any real-host verification.

## 2026-09-25 — Phase 6 Task 19 restricted SSH metrics transport/parser decisions

95. **No arbitrary remote command surface:** System metrics callers submit typed command IDs, not shell strings. `resolveRestrictedSshCommand` maps those IDs to fixed read-only program/argument shapes for `/proc/stat`, `/proc/meminfo`, `df -P -B1`, `/proc/uptime`, and `systemctl show`. Program names, paths, and arbitrary arguments are not caller-controlled.
96. **Bounded service variability only:** Service health may vary only by an explicit bounded service-ID list. IDs use a conservative character allowlist, maximum count/length, duplicate rejection, and are placed after `--` in the resolved `systemctl` argv. Invalid service identifiers are rejected during collector construction before any transport call.
97. **Transport remains injected:** `RestrictedSshTransport` is an execution seam only. Task 19 adds no SSH package, socket, DNS lookup, authentication, host-key trust, or production command execution. The future concrete transport must accept only resolved command objects from this boundary.
98. **Execution limits are part of the contract:** Each command carries a validated timeout and maximum combined stdout/stderr byte count. The wrapper enforces wall-clock timeout plus a post-return byte cap and passes the same limits into the injected transport. A concrete streaming transport must enforce those limits while receiving data, not rely only on the wrapper's post-return check.
99. **Linux/systemd parser baseline:** CPU comes from two `/proc/stat` samples; memory from `MemTotal` and `MemAvailable`; filesystems from `df -P -B1`; uptime from `/proc/uptime`; services from `systemctl show` `Id`/`ActiveState` records. The `df` header line is ignored rather than matched by English labels so locale-specific headings do not affect numeric-row parsing. Malformed, incomplete, duplicate, or unexpected output fails closed with bounded parser/collector errors.
100.  **CPU guest accounting:** Linux `guest` and `guest_nice` counters are excluded from the CPU total because they are already included in `user` and `nice`. CPU idle time is `idle + iowait`; utilization is calculated from deltas between two samples.
101.  **Capability-specific degradation:** Restricted SSH transport errors classified as `PERMISSION_DENIED` or `UNSUPPORTED` degrade only the affected metric dimension and omit its value. Timeout, output-limit, connection, command, parser, or other failures fail the collection safely rather than manufacturing a zero.
102.  **Phase boundary:** Task 19 does not define SSH metadata, encrypted SSH credentials, host-key verification, network target policy, a concrete SSH client, scheduling/source health, persistence, API, alerting, or UI. Task 20 starts with configuration/trust and secret-storage boundaries before any real SSH connection is permitted.

## 2026-09-25 — Phase 6 Task 20 restricted SSH configuration/trust decisions

103. **SSH configuration is PBX-scoped and optional:** Migration 6 adds one optional `ssh_config` row per PBX with host, port, conservative username, auth method, trust policy, pinned fingerprint, and timestamps. The row cascades when the owning PBX is deleted and does not alter AMI configuration or PBX verification state.
104. **SSH credentials reuse the existing encrypted secret envelope:** Password, private key, and optional private-key passphrase are stored under distinct validated secret names in the existing AES-256-GCM `pbx_secret` store. Safe SSH configuration records expose only metadata plus credential/passphrase presence booleans; plaintext never enters `ssh_config` or a safe response object.
105. **Authentication methods are explicit and mutually exclusive:** Supported configuration methods are `PASSWORD` and `PRIVATE_KEY`. Reconfiguring between methods deletes obsolete SSH credential secrets transactionally. Private-key material is byte-size bounded but intentionally not parsed until a concrete SSH client exists.
106. **Pinned host-key trust only:** `host_key_policy` is fixed to `PINNED_SHA256`. Configuration requires a canonical OpenSSH `SHA256:<base64>` fingerprint representing exactly 32 digest bytes. Presented SSH host-key blobs are hashed with SHA-256 and compared with `timingSafeEqual`. There is no trust-on-first-use, accept-new, wildcard, or disabled-verification mode.
107. **Key rotation is explicit:** A different server host key is rejected until an administrator explicitly updates the pinned fingerprint. Task 20 supports one active fingerprint per PBX; multi-key overlap/grace-period rotation is deferred.
108. **Generic network boundary:** Host syntax and resolved-address SSRF classification now live in `backend/src/network/policy.ts`. The Asterisk provider re-exports the same API for compatibility, and SSH uses that generic boundary after a future one-time resolution step. Task 20 performs no DNS lookup and opens no socket.
109. **Conservative SSH username syntax:** SSH usernames are limited to `[A-Za-z0-9._-]+` with a 128-character maximum. This is intentionally narrower than the AMI username syntax to remove ambiguity before a concrete transport is introduced.
110. **Atomic configuration/credential lifecycle:** SSH metadata and encrypted secret writes occur inside one SQLite transaction. A regression test injects a secret-write failure after metadata insertion and confirms the whole change rolls back.
111. **Phase boundary:** Task 20 adds no SSH dependency/client, resolver invocation, socket, command execution, host verification attempt, source-health runtime, scheduler, API/UI, or real-host compatibility claim. Task 21 may add a concrete client only behind the existing resolver/network/trust/secret boundaries and synthetic loopback validation first.

## 2026-09-25 — Phase 6 Task 21 concrete restricted SSH transport decisions

112. **Concrete client boundary:** Use the maintained `ssh2` package as the protocol implementation rather than invoking the system `ssh` binary. The application transport receives only the already-resolved PBX-scoped configuration, encrypted credential material, typed restricted command, and execution limits; it does not expose arbitrary shell input.

113. **One-time resolution and SSRF enforcement:** The concrete transport receives an injected resolver and calls it exactly once per command. The default validator checks every returned address with the shared network policy before any socket is opened, and the connection target is one of those already-validated addresses. Tests may inject a loopback-only validator solely for the synthetic SSH server; production construction retains the shared validator.

114. **Pinned host-key callback:** The transport always supplies an SSH host-key verification callback and validates the presented public-key blob with the existing canonical SHA-256 pin using timing-safe comparison. `hostHash` is intentionally not used because `ssh2` changes the callback argument to a hexadecimal digest when that option is enabled; the raw key callback keeps the trust contract aligned with the existing verifier.

115. **Restricted command execution:** The transport serializes only `RestrictedSshCommand` values produced by the existing command resolver using shell-safe single-argument quoting. No interactive shell, PTY, environment injection, port forwarding, agent forwarding, or arbitrary command string is exposed.

116. **Streaming limits and cleanup:** Combined stdout/stderr bytes are counted as chunks arrive and the channel/connection is closed immediately after a limit breach. A wall-clock timer covers command execution, and final cleanup closes the channel/client and zeroes retrieved credential/passphrase buffers. The unavoidable password string required by the `ssh2` API is a known JavaScript-memory limitation.

117. **Synthetic-only validation:** Task 21 uses an in-process `ssh2` server bound to loopback. Coverage includes successful pinned-key execution, mismatched pin rejection, one-time resolver plus default unsafe-target rejection, streaming output overflow, and wall-clock timeout. No DNS lookup, production host, or PBX was contacted. Private-key authentication is implemented but deferred from this task's separate synthetic authentication fixture.

118. **Dependency/license review:** Add `ssh2@1.17.0` as the concrete SSH client and `@types/ssh2@1.15.6` as a development-only type dependency. The resolved transitive set was reviewed for the repository's allowed license identifiers; `ssh2`, `buildcheck`, and `cpu-features` are recorded as MIT, while `tweetnacl` is recorded as Unlicense and explicitly added to the reviewed SPDX set. The license checker remains fail-closed for every other unreviewed identifier.

## 2026-09-26 — Phase 6 Task 22 system-metrics runtime decisions

119. **One runtime source per PBX:** `SystemMetricsRuntime` owns at most one SSH system-metrics collector lifecycle for each configured PBX instance. It starts/stops with application lifecycle and keeps collection independent of browser activity or AMI event processing.
120. **SSH configuration/credential gate:** A source is activated only when the PBX exists, SSH configuration exists, and its encrypted credential is present. Missing SSH configuration or credentials is represented as `UNAVAILABLE`, not as a collection attempt or synthetic zero.
121. **Explicit network gate:** The production SSH collector factory is created only when `APP_PBX_NETWORK_MODE=plain_tcp`; the default `disabled` mode creates no SSH source runtime. Task 22 validation uses injected fake collectors and performs no real-host connection.
122. **Bounded source health:** Each PBX SSH source reports only `NEVER_COLLECTED`, `CURRENT`, `ERROR`, or `UNAVAILABLE` freshness plus timestamps, bounded shared error codes, and a consecutive-failure count. Raw exception text, command output, host/address, and credentials never cross the runtime health boundary.
123. **Failure backoff:** Failed collections do not throw into the application lifecycle or create a reconnect storm. Retry delay uses bounded exponential backoff with a fixed upper limit and resets after a successful sample. The metric sample itself remains in memory only until the persistence task defines ownership and retention.
124. **Runtime synchronization seam:** SSH configuration changes currently have no public API/UI; callers that mutate SSH configuration must invoke `SystemMetricsRuntime.syncProfile(instanceId)` to activate, replace, or stop the source. A future SSH configuration API must make this synchronization atomic from the runtime's perspective.

## 2026-09-26 — Phase 6 Task 23 system-metrics persistence decisions

125. **Separate current and history ownership:** System metrics persistence has two explicit SQLite boundaries: one PBX-scoped current row for the latest accepted observation and an append-oriented history table for bounded historical observations. Both cascade with the owning PBX.
126. **Monotonic current state:** A persisted current sample is replaced only when its `observedAt` is newer than the stored value. Late or reordered samples may remain in history but cannot move current state backward.
127. **Duplicate-safe history:** Historical samples are uniquely identified by PBX instance, source, and observation timestamp. Re-delivery of the same sample is a no-op rather than a second historical point.
128. **Retention is transactional and bounded:** Each persisted sample carries a retention cutoff; history pruning runs in the same SQLite transaction as current/history persistence. Runtime retention defaults to seven days and is capped at 90 days. Current state is never deleted by historical retention.
129. **Persistence isolation:** Storage failures do not mark down the read-only SSH collector or stop its lifecycle. A separate bounded persistence-health signal is deferred to the API/operations layer so collector health cannot be confused with database health.

## 2026-09-26 — Phase 6 Task 24 system-metrics API/realtime decisions

130. **Authenticated metrics boundary:** Current and history system metrics are exposed only after the existing authenticated principal check. Unauthenticated requests receive the same generic authorization response used by the rest of the API.
131. **PBX-scoped HTTP contract:** Current state is available per PBX, while history requires explicit normalized UTC `from`/`to` bounds and a maximum 500-row limit. The server does not expose database records, SSH configuration, or raw transport details.
132. **Realtime transport:** Use a PBX-scoped Server-Sent Events stream for the current system-metrics publication boundary at this stage. The stream sends an initial state and then normalized sample/source-health events; it does not open PBX connections or perform collection itself.
133. **Realtime safety bounds:** Same-origin protection applies to stream establishment, concurrent metric streams are capped at 64 per process, heartbeats keep idle connections detectable, and disconnects remove listeners and stream accounting.
134. **Authentication test seam:** API tests may inject a minimal authenticated principal so endpoint behavior can be tested independently of cryptographic session issuance. Existing authentication tests remain responsible for session creation, validation, expiry, and cookie behavior.

## 2026-09-26 — Phase 7 Task 25 security-monitoring source boundary decisions

135. **First security source is Asterisk AMI SecurityEvent:** The initial security-monitoring boundary consumes only normalized Asterisk `SecurityEvent` frames already present on the read-only AMI event stream. No Linux journal, SSH log file, firewall, WAF, or production security-log access is introduced by Task 25.
136. **Authentication scope is deliberately bounded:** The normalized contract currently exposes only `AUTHENTICATION_SUCCESS` and `AUTHENTICATION_FAILURE`. Failure reasons are limited to `INVALID_ACCOUNT`, `INVALID_PASSWORD`, `CHALLENGE_RESPONSE_FAILED`, `ACL_FAILURE`, `UNEXPECTED_ADDRESS`, and `UNKNOWN`.
137. **Sensitive AMI security fields do not cross the boundary:** Account identifiers, remote/local addresses, session identifiers, request parameters, severity text, and arbitrary AMI fields are intentionally discarded. The event retains only PBX identity, source, observation time, bounded outcome/reason, and optional provider stream ordering.
138. **Capability is observation-based:** `authenticationEvents` remains `UNKNOWN` until at least one supported Asterisk security event is actually observed. Seeing AMI login success or having an AMI connection does not by itself claim security-event support.
139. **Fail-closed source adapter:** The security source validates PBX/source identity and UTC timestamp plus the bounded event union before forwarding. Invalid events are dropped rather than exposing raw provider payloads; listener failures are isolated from the provider connection lifecycle.
140. **Event delivery enables AMI events before connect:** A registered security listener counts as an event consumer when Asterisk `Login` is constructed, so `Events: on` is requested without requiring a telephony-state subscriber. Unsubscribing removes only the security consumer and never changes PBX state.
141. **Task 25 phase boundary:** No security-event persistence/history, retention, authenticated HTTP/SSE exposure, alerting, UI, or production-log compatibility claim is added. The exact next task is Task 26, which defines bounded security-event current/history persistence and retention.

## 2026-09-26 — Phase 7 Task 26 security-event persistence decisions

142. **Separate security current and history ownership:** Security events use two PBX-scoped SQLite boundaries: one current row containing the latest accepted normalized event and an append-oriented history table containing bounded historical events. Both cascade with the owning PBX.
143. **Duplicate-safe event identity:** History rows use a SHA-256 key over the complete bounded normalized event, including PBX/source, observation time, type/reason, and optional provider stream ordering. Raw AMI fields are never part of the persisted payload.
144. **Monotonic current ordering:** When both stored and incoming events have stream generations, a newer generation wins; within the same generation, a higher stream sequence wins when both sequences exist. If provider ordering is unavailable or incomplete, observation timestamp is the fallback ordering. Older/reordered events remain eligible for history but never move current backward.
145. **Retention is transactional and current-safe:** Each persisted event is inserted into history, current is conditionally advanced, and history older than the supplied cutoff is pruned inside one SQLite transaction. Pruning targets history only and can never delete current state. The runtime uses a seven-day retention boundary for Task 26; public configuration is deferred.
146. **Persistence isolation:** Security-event persistence subscribes to the existing normalized provider/runtime event boundary and storage failures are swallowed at that consumer boundary so a database problem cannot affect the read-only PBX connection or event path.
147. **Task 26 phase boundary:** Only normalized Asterisk AMI authentication events are persisted. No production log access, SSH security-log access, authenticated security API/realtime delivery, alerting, dashboard, or broader security-source compatibility is claimed. The next task is Task 27 for authenticated current/history API and bounded realtime delivery.

## 2026-09-26 — Phase 7 Task 27 security-event API/realtime decisions

148. **Authenticated security HTTP boundary:** Current and history security events use the existing authenticated principal boundary and PBX instance ownership check. Unauthenticated requests receive the generic `401` response; nonexistent PBX instances remain `404` after authentication.
149. **History query bounds:** Security history requires normalized UTC `from`/`to` values with `from <= to` and a maximum 500-row limit, matching the bounded system-metrics API pattern. The server exposes normalized security events only, never raw AMI/provider fields.
150. **Security realtime transport:** Use a PBX-scoped Server-Sent Events stream for the first browser-facing security publication boundary. The stream sends the persisted current snapshot on connect and subsequent normalized security events from the provider runtime; it does not open PBX connections or perform persistence itself.
151. **Realtime safety bounds:** Security SSE establishment requires same-origin validation, concurrent security streams are capped at 64 per process, a 15-second heartbeat is used, and disconnects remove listener registration and stream accounting.
152. **No event enrichment at API edge:** The API/realtime layer does not reconstruct identities, addresses, request parameters, severity, or other provider metadata. Its responsibility is authentication, PBX scoping, query bounds, and delivery of the already-normalized security contract.
153. **Task 27 validation seam:** Synthetic API tests may inject a minimal authenticated principal and security-event listener without issuing real credentials or opening a PBX connection. Production compatibility remains unclaimed.
154. **Task 27 phase boundary:** No security-alert evaluation, notification delivery, dashboard/UI, SSH security-log access, or broader provider security source is introduced. The next task is Task 28 for a bounded fail-closed security-alert/rule evaluation boundary over normalized persisted security events.

## 2026-09-26 — Phase 7 Task 28 security-alert/rule evaluation decisions

155. **Persisted-event boundary:** alert evaluation consumes only normalized `SecurityEvent` records and PBX-scoped persisted history; raw AMI/provider fields and production logs remain outside the evaluator.
156. **Rule allowlist:** Task 28 supports only `AUTHENTICATION_FAILURE_ANY` and `AUTHENTICATION_FAILURE_THRESHOLD`. Thresholds are bounded to 1–100, windows to 1–3600 seconds, optional reasons use the existing authentication-failure union, and history reads are capped at 500 rows.
157. **Fail-closed evaluation:** unknown/malformed rules, invalid events, and storage/evaluation errors never produce a match; they return explicit failure states.
158. **No side effects:** the evaluator does not send messages, call webhooks, modify PBX state, open network connections, or invoke external actions.
159. **Task 28 phase boundary:** rule configuration persistence, alert/current-state persistence, deduplication, delivery, UI, broader security sources, and production compatibility remain future work. Next task is Task 29 for bounded alert persistence/current-state semantics.

## 2026-09-26 — Phase 7 Task 29 security-alert persistence decisions

160. **Alert record boundary:** persisted alerts contain only PBX instance ID, one allowlisted Task 28 rule ID, observation time, bounded matched-event count, and optional provider stream generation/sequence. Raw AMI fields, account/address identity, request details, and rule configuration are not persisted in alert records.
161. **Per-rule current ownership:** current alert state is keyed by PBX instance plus rule ID. Independent rule types cannot overwrite each other's latest state.
162. **Deterministic deduplication:** historical alerts use a SHA-256 identity over the complete bounded alert record. Re-persisting the same alert is a no-op in history.
163. **Monotonic current ordering:** when both stored and incoming alerts carry provider stream ordering, generation and then sequence determine freshness; otherwise normalized observation time is the fallback.
164. **Transactional retention and cascade:** history insert, current advancement, and retention pruning occur inside one SQLite transaction. History pruning never removes current state, and PBX deletion cascades current/history alert rows.
165. **Task 29 phase boundary:** no persistent rule configuration, evaluator scheduling/runtime ownership, alert HTTP/SSE exposure, webhook/notification delivery, dashboard UI, or production-system compatibility claim is added. Next task is Task 30 for authenticated PBX-scoped alert current/history APIs and bounded realtime alert delivery without external notification delivery.

## 2026-09-26 — Phase 7 Task 30 security-alert API/realtime decisions

166. **Authenticated alert boundary:** security-alert current/history endpoints require the existing authenticated principal and an existing PBX instance. Unauthenticated requests receive the generic authorization response and nonexistent PBX instances remain not-found after authentication.
167. **Current and history contracts:** current returns the PBX-scoped per-rule current alert set. History requires normalized UTC from/to bounds, from not later than to, and a maximum 500-row limit.
168. **Persistence-backed realtime:** alert SSE subscribes to the alert repository's post-commit publication boundary. Only a newly inserted deduplicated history alert is published; a duplicate no-op save is not republished.
169. **Realtime safety bounds:** stream establishment is same-origin protected, PBX scoped, concurrent alert streams are capped at 64 per process, a 15-second heartbeat is used, and disconnects remove listener registration and stream accounting.
170. **Failure isolation:** alert listener exceptions are swallowed after persistence succeeds so a browser/realtime consumer can never roll back or break storage.
171. **Task 30 phase boundary:** persistent rule configuration, evaluator runtime scheduling/ownership, external notification delivery, dashboard UI, broader security sources, and production-system compatibility remain future work. Next task is Task 31 for persistent bounded rule configuration and runtime evaluation/persistence wiring without external notification delivery.

## 2026-09-26 — Phase 7 Task 31 alert-rule runtime decisions

172. **Persistent rule ownership:** rule configuration is keyed by PBX + rule and stored separately from alert state. Only the two existing bounded rule shapes are accepted; PBX deletion cascades configuration.
173. **No implicit enablement:** Task 31 creates no default rule rows and enables nothing automatically. Runtime alert generation is inert until persisted configuration exists.
174. **Single runtime path:** one application-owned SecurityAlertRuntime subscribes to normalized security events, persists the event first, then evaluates that PBX's enabled persisted rules and persists matches.
175. **Fail-closed ordering:** event persistence failure prevents evaluation for that event. Rule-load/evaluation failures produce no alert. Alert persistence failures remain isolated from provider/event collection.
176. **No duplicate provider subscription side effects:** the previous standalone event-persistence subscription is replaced by SecurityAlertRuntime rather than retained in parallel.
177. **Task 31 phase boundary:** no authenticated rule-configuration mutation API/UI, external notification delivery, broader rule/source family, or production-system compatibility claim is added. Next task is Task 32 for authenticated PBX-scoped rule-configuration APIs only.
178. **Bilingual master-plan invariant:** docs/MASTER_PLAN.fa.md must remain a complete Persian translation of docs/MASTER_PLAN.md with the same structure and content; summary-only divergence is not allowed.

## 2026-09-26 — Phase 7 Task 32 alert-rule API decisions

179. **Authenticated configuration boundary:** alert-rule configuration APIs require the existing authenticated principal and an existing PBX instance.
180. **Path-owned scope:** PBX instance ID and rule ID come only from the URL. Bodies containing `instanceId` or `id` are rejected rather than allowed to redirect mutation scope.
181. **Bounded mutation contract:** only PUT and DELETE mutate one allowlisted rule. Mutations require same-origin protection; no bulk replace or implicit default creation is introduced.
182. **Rule validation parity:** API validation preserves the Task 28/31 rule allowlist, threshold 1–100, window 1–3600 seconds, failure-reason allowlist, and rejection of unexpected fields.
183. **Read contract:** list returns only configured rules for one PBX; single-rule GET returns not-found when the allowlisted rule has no configuration. Unknown rule IDs are not exposed as configurable resources.
184. **Task 32 phase boundary:** no external notification delivery, broader security source/rule family, or browser UI is added. Next task is Task 33 for the first authenticated security-monitoring UI over the existing bounded alert/rule APIs.

## 2026-09-26 — Phase 7 Task 33 security-monitoring UI decisions

185. **Dedicated security workspace:** security monitoring is a separate authenticated frontend component mounted only when at least one onboarded PBX profile exists.
186. **PBX selection boundary:** the security UI selects only from already-onboarded PBX profiles. It provides no free-form PBX ID/host input and therefore cannot redirect security API scope independently.
187. **Bounded alert presentation:** Task 33 displays only current persisted SecurityAlertRecord fields needed by an operator: rule label, observation time, and matched-event count. Raw provider/security identity fields remain absent.
188. **Fixed rule controls:** the UI exposes only the two existing allowlisted rule IDs. Client-side threshold/window controls mirror backend bounds but backend validation remains authoritative.
189. **No notification controls:** no webhook/email/SMS/chat target, notification credential, or delivery toggle is introduced in Task 33.
190. **Task 33 phase boundary:** the first UI uses snapshot/current reads plus explicit refresh. Existing alert SSE and history endpoints are deliberately left for Task 34, which will add bounded realtime updates and recent history without external notification delivery.
191. **Bilingual source-of-truth invariant reaffirmed:** after observing post-merge Persian-plan drift, MASTER_PLAN.fa.md is regenerated from the finalized English master plan and structural parity is checked before commit.

## 2026-09-26 — Phase 7 Task 34 security-monitoring realtime/history UI decisions

192. **Recent-history window:** the first browser history surface requests only the selected PBX's previous 24 hours with a hard client limit of 100 rows. Server validation/retention remains authoritative.
193. **One selected-PBX realtime stream:** the UI opens at most one Security Alert EventSource for the currently selected PBX and closes it when the selection/component changes.
194. **SSE merge semantics:** an initial current snapshot replaces current per-rule display state. A later persisted alert replaces only its rule's current record and is prepended to recent history.
195. **UI deduplication bound:** identical realtime alerts are ignored in displayed history using the complete bounded alert display identity; history is capped at 100 rows even during a long browser session.
196. **Fail-closed stream parsing:** malformed SSE JSON or invalid bounded alert shapes do not mutate UI state. Stream errors only mark realtime disconnected; they do not erase already loaded state.
197. **No external delivery:** Task 34 adds no notification target/configuration, credential, queue, webhook, or provider action. It closes the currently defined Phase 7 monitoring slice only.
198. **Task 35 boundary:** the next task defines bounded external-notification configuration/queue/deduplication contracts only. Any real provider delivery requires a later explicit scope and approval.

## 2026-09-26 — Task 35 external-notification foundation decisions

199. **Storage-only delivery foundation:** Task 35 defines persistence/contracts only. No alert subscription, delivery worker, provider adapter, DNS resolution, HTTP/SMTP client, or external connection is introduced.
200. **Channel metadata boundary:** notification channels are PBX scoped and currently allowlist only `WEBHOOK`. Public metadata contains stable ID, display name, enabled state, and opaque `secretName`; target URL/auth material is not stored in the channel table.
201. **Immutable channel scope:** an existing channel ID cannot move to another PBX or transport. This prevents queued records from becoming inconsistent with channel ownership.
202. **Queue payload boundary:** delivery rows store only the bounded `SecurityAlertRecord`, channel/PBX/rule identity, deterministic delivery key, queue time, and `PENDING`/`CANCELLED` status. No raw AMI/provider identity or provider response is stored.
203. **Deterministic queue deduplication:** delivery identity is SHA-256 over channel ID and the complete bounded alert identity. Re-enqueueing the same alert/channel pair does not create a second row.
204. **Fail-closed enqueue:** missing or disabled channels and channel/alert PBX mismatches are rejected. Pending queue reads are bounded to at most 500 rows.
205. **Cascade semantics:** channel deletion cascades its queue rows and PBX deletion cascades both channel and queue state.
206. **No implicit secret validity claim:** Task 35 stores only an opaque secret reference and does not claim the referenced encrypted secret exists or has a valid webhook target schema.
207. **Task 36 boundary:** next expose authenticated PBX-scoped notification channel configuration plus encrypted webhook-target secret management. Runtime enqueue/delivery and all real external-provider contact remain out of scope.

## 2026-09-26 — Task 36 notification-channel API decisions

208. Webhook targets are persisted only through SecretStore; API responses never expose target URL or decrypted secret material.
209. Public notification-channel responses omit internal secret names and expose only operational metadata plus hasTarget.
210. Task 36 accepts only bounded HTTPS target syntax without embedded credentials or fragments and performs no DNS resolution/contact.
211. New channels require a target; later updates may retain the existing encrypted target without resubmission.
212. List/get require authentication; PUT/DELETE also require same-origin protection; channel/PBX mismatch fails closed.
213. Deleting a channel also removes its encrypted target secret; Task 35 queue cascade remains database-owned.
214. Task 36 activates no alert subscriber, enqueue runtime, worker, HTTP client, retry policy, redirect handling, or external transmission.
215. Task 37 deploys the existing backend and bilingual frontend on the monitoring host as a managed same-origin service with private local deployment values and no implied new real-PBX access.

## 2026-09-26 — Task 37 live UI deployment decisions

216. **Same-origin gateway:** browser traffic terminates at one HTTPS gateway that serves the built frontend and proxies setup/auth/API/health/readiness to a loopback-only backend.
217. **Secure production session preserved:** the live deployment uses production auth semantics and HTTPS rather than weakening Secure cookies for LAN HTTP.
218. **Private deployment state:** runtime env, database, secret store, TLS private key, PID, and logs remain ignored/local; public Git contains only organization-neutral scripts/unit/instructions.
219. **PBX disabled during UI deployment:** the live deployment explicitly keeps PBX networking disabled; UI deployment is not authorization for a PBX connection.
220. **Local process management:** the non-privileged launcher owns the stack in a dedicated process group and provides start/stop/status/run; stop must remove both backend and gateway listeners.
221. **Reusable OS service definition:** a generic hardened systemd unit is tracked, but installing/enabling it is an administrator operation and was not possible in this session.
222. **TLS trust boundary:** a local self-signed certificate is acceptable only for this initial controlled UI exposure; trusted production TLS is required before calling the deployment fully hardened.
223. **Task 38 boundary:** next install OS-level persistence, trusted TLS/firewall policy, reboot, and verify automatic UI recovery while PBX networking stays disabled unless separately approved.

224. **Read-only SSE origin policy:** authenticated SSE endpoints for system metrics, security events, and security alerts are read-only GET streams and no longer require an Origin header. Authentication, PBX ownership checks, stream limits, and same-origin protection for all state-changing requests remain mandatory.
225. **Post-deployment PBX activation remains private and bounded:** after explicit operator approval, the local deployment may enable only its already-configured read-only monitoring connection. Deployment-specific targets/credentials remain ignored local state and are not documented in public repository content.

## 2026-09-26 — Task 38 persistence/recovery decisions

226. **OS-level service ownership:** production runs under a dedicated `voip-monitor` service account through an enabled systemd unit; backend remains loopback-only and HTTPS gateway remains browser-facing.
227. **Production Node boundary:** systemd must not depend on ignored `.local` toolchains. `VOIP_MONITOR_NODE_BIN` selects a root-owned production runtime path.
228. **Self-signed exception remains explicit:** production installer rejects self-signed TLS by default; temporary acceptance requires explicit `--allow-self-signed` and does not convert it into trusted PKI.
229. **Reboot recovery is a release gate:** Task 38 is considered successful only after a real host reboot proves automatic systemd recovery plus UI, health, readiness, and listener restoration without manual start.
230. **Firewall truth over appearance:** operator-reported UFW is inactive. Reachability is validated, but restrictive host-firewall hardening is not claimed.
231. **PBX scope unchanged:** OS persistence/reboot work does not expand the already-approved read-only PBX monitoring scope.
232. **Task 39 boundary:** next build the first bilingual operator dashboard from existing safe PBX/provider, system-metric, and security-alert APIs only; no new PBX actions or collection scope.


## 2026-10-05 — Task 39 operator-dashboard decisions

233. **Existing-boundary-only dashboard:** consume only existing authenticated provider-status, system-metrics, and security-alert APIs/SSE streams; add no backend route, PBX action, collector, credential surface, or external target.
234. **Provider-status freshness:** refresh the existing local status endpoint every 15 seconds. This observes local runtime state and is not a PBX connection test or probe.
235. **Realtime scope:** system metrics and security alerts reuse existing SSE streams; dashboard stream failure does not affect PBX monitoring or application readiness.
236. **Telephony state remains internal:** Task 39 does not expose TelephonyStateEngine snapshots. Calls/channels/endpoints/trunks/queues/agent interactions remain unavailable until a bounded API exists.
237. **Task 40 boundary:** expose the existing TelephonyStateEngine through authenticated PBX-scoped bounded read-only current-state and realtime APIs only; no new PBX connection, write action, permission expansion, or collection source.


## 2026-10-05 — Task 40 telephony state API/realtime decisions

238. **Engine-owned current state:** the API exposes only the already-normalized `TelephonyInstanceState` produced by the existing engine. The API layer does not replay AMI events, query the provider, or reconstruct additional identity fields.
239. **Authenticated PBX-scoped snapshot:** `GET /api/pbx-instances/:id/telephony-state` requires a valid administrator session and an existing PBX profile and returns the current state or `null` before an authoritative snapshot exists.
240. **Bounded SSE realtime:** `GET /api/pbx-instances/:id/telephony-state/stream` sends one initial current snapshot followed by engine revisions for that PBX only, caps concurrent telephony streams at 64, and uses a 15-second heartbeat.
241. **Reset publication:** provider profile/runtime reset removes engine state and the telephony SSE publishes `current: null` so clients fail closed instead of retaining stale state.
242. **Read-only browser compatibility:** telephony current/SSE routes are GET-only. The read-only SSE route follows the existing browser-compatible policy and does not require a mutation-style Origin check; authentication and PBX scoping remain mandatory.
243. **No new PBX work:** Task 40 creates no provider instance, AMI connection, AMI action, credential read, permission expansion, SSH collection, storage query for telephony history, or PBX mutation.
244. **Current-state limitation:** telephony state remains in memory only. Agent interactions remain `LIVE_ONLY` and Queue/Agent production compatibility is still unverified.
245. **Task 41 boundary:** next consume these telephony current-state/SSE boundaries in the bilingual operator UI only; no PBX write action, telephony history, or broader collection scope.


## 2026-10-05 — Task 41 Chakra telephony dashboard decisions

246. **Chakra UI v3 dashboard scope:** use Chakra UI v3 primitives for the operator dashboard and Task 41 telephony presentation. Do not rewrite unrelated setup, PBX-management, or security-rule forms merely to achieve visual uniformity in this task.
247. **Existing API only:** the UI consumes Task 40 `telephony-state` current/SSE plus the already-existing provider/system/security boundaries. Rendering a browser does not create PBX connections, actions, permissions, collectors, or history reads.
248. **Responsive information hierarchy:** top-level operational state uses responsive summary cards; current telephony entities use bounded responsive detail cards rather than dense desktop-only tables so the same UI remains usable on narrow screens.
249. **RTL with technical LTR islands:** Persian inherits application RTL direction. Provider-neutral technical identifiers remain unmodified and are rendered LTR at the element boundary when bidi ordering could corrupt them.
250. **Dependency/license boundary:** pin `@chakra-ui/react 3.37.0` and `@emotion/react 11.14.0` through the lockfile. Review the transitive `tslib 2.8.1` Zero-Clause BSD license text and add SPDX `0BSD` to the explicit reviewed-license set.
251. **Task 42 boundary:** next define and persist bounded PBX-scoped telephony history/retention using only existing normalized telephony state/events; no new PBX action, collection source, or browser history UI.
252. **Chakra bundle tradeoff is explicit:** Task 41 accepts the current 519,828-byte raw production JavaScript bundle and non-fatal Ark UI `"use client"` Rolldown warnings because the user explicitly selected Chakra UI and the SPA build passes. Future bundle optimization must be measured separately rather than silently replacing the selected design system.


## 2026-10-05 — Task 41 Chakra full-shell correction

253. **Dashboard-only Chakra scope was incorrect:** Decision 246 is superseded. The user-selected Chakra UI design system applies to the complete operator-facing UI, not only the telephony dashboard. Setup/login, application shell, PBX management, security workspace, and operator dashboard must share the same Chakra UI v3 primitives and visual language.
254. **One global Chakra provider:** the production root owns the Chakra provider. Feature components consume that provider rather than creating isolated design-system islands.
255. **Native semantics inside Chakra layout:** when Chakra polymorphic typing does not preserve native form element types, retain native semantic form elements and compose Chakra layout/components inside them rather than weakening TypeScript types.
256. **Minimal global CSS:** global CSS is limited to browser-level reset, minimum viewport, font stack, and page background. Component styling belongs to Chakra primitives/tokens instead of legacy selectors/classes.
257. **RTL boundary remains global:** Persian application direction is RTL at the document/shell boundary; technical identifiers remain explicit LTR islands.


258. **CSP-compatible Chakra styling:** do not relax production CSP with unsafe-inline to accommodate Chakra/Emotion. The HTTPS gateway generates a fresh cryptographic nonce for each HTML document response, adds that nonce to style-src, injects it into the document, and the frontend passes it to a dedicated Emotion cache.
259. **Nonce scope:** the CSP style nonce is document-scoped and generated only for served index.html documents. Static JS/CSS assets retain immutable caching and do not require the nonce.
260. **Emotion cache ownership:** the root frontend composition owns one application Emotion cache, outside ChakraProvider, so all Chakra runtime style injection uses the gateway-provided nonce consistently.


## 2026-10-05 — Portability and operator-workspace correction

261. **Cross-organization portability is release-critical:** tracked source, tests, defaults, migrations, examples, and docs must never depend on the current lab/company environment. Real deployment facts remain outside Git, normally under the deployment manager or ignored `.local/`.
262. **Deployment runbook is tracked and generic:** English/Persian deployment guides cover clean-clone setup, service/TLS/runtime isolation, first-admin bootstrap, PBX onboarding, optional SSH metrics, verification, backup/restore, upgrade/rollback, and uninstall without embedding organization-specific values. Foundation checks require both guides.
263. **System metrics are explicitly optional:** AMI telephony health does not imply host metrics. `UNAVAILABLE` means no active SSH metric source; missing SSH configuration/credential must not be represented as zero and must not affect application readiness.
264. **SSH management is reprioritized:** Task 42 becomes the authenticated PBX-scoped SSH metadata/credential management surface with pinned fingerprint trust, encrypted write-only credentials, and runtime sync. Real-host verification remains separately approval-gated.
265. **Trunk emptiness is not absence:** current trunk discovery uses `SIPshowregistry` and therefore models outbound SIP registrations only. UI must label this limitation; Task 43 will broaden provider-neutral trunk inventory with synthetic/mock compatibility coverage before real-PBX validation.
266. **Telephony history moves to Task 44:** operator-visible configuration/trunk completeness takes priority over history/retention. The earlier Task 42 history plan is superseded, not deleted from historical completion notes.
267. **Dashboard is summary-first:** high-cardinality telephony entities do not render as one long dashboard list. The dashboard uses status cards, CPU/memory/endpoint dial gauges, queue-pressure bars, uptime, and clickable entity counts.
268. **Entity workspaces are bounded:** Calls, Channels, Endpoints, Trunks, Queues, and Agents each have a separate current-state workspace with search, 20-row pagination, PBX scoping, and realtime updates. Current Channels suppress known closed/terminated states.
269. **No chart dependency added:** dashboard gauges and queue bars use Chakra/SVG primitives to avoid adding another visualization dependency and bundle/license surface.


## 2026-10-05 — Task 42 SSH metrics management decisions

270. **Authenticated PBX-scoped SSH API:** expose only GET/PUT/DELETE /api/pbx-instances/:id/ssh-configuration; there is no bulk/global SSH configuration endpoint.
271. **Write-only credential contract:** API responses use SafeSshConfiguration and return only metadata plus credential-presence booleans. Passwords, private keys, passphrases, encrypted envelopes, ciphertext, nonces, and auth tags never leave the backend.
272. **Pinned trust remains mandatory:** public configuration accepts only the existing PINNED_SHA256 policy and a syntactically valid SHA-256 host-key fingerprint. There is no accept-new/TOFU mode.
273. **Mutation and runtime sync are one application operation:** after a successful PUT or DELETE, the HTTP boundary immediately invokes SystemMetricsRuntime.syncProfile(instanceId) so the runtime does not require a service restart or out-of-band synchronization call.
274. **No real-host test in Task 42:** do not add a browser/API Test SSH operation. Saving configuration does not resolve DNS, open sockets, authenticate, or execute commands; real-host verification remains separately approval-gated.
275. **Credential replacement requires explicit resubmission:** Task 42 keeps the existing strict configuration service contract; Save writes a complete validated SSH configuration including a fresh credential. The UI never pre-fills an existing secret.
276. **UI secret clearing:** submitted credential/passphrase fields are cleared after successful Save and are not persisted in localStorage or rendered back to the user.
277. **Task 43 boundary:** next broaden read-only trunk inventory beyond SIPshowregistry using provider-neutral normalization and synthetic/mock compatibility coverage before any separately approved real-PBX verification.


## 2026-10-05 — Dashboard storage/history/Jalali correction

278. **Filesystem count is dynamic:** dashboard storage renders the complete current filesystems array and never assumes a fixed number of disks/mounts.
279. **Storage semantics are filesystem-level:** because the restricted SSH collector uses df -P -B1, dashboard entries represent mounted filesystems. Do not label them as authoritative physical disks.
280. **Reuse bounded history:** the dashboard may consume the existing system-metrics history API for recent visualization. Keep the client window bounded at six hours and maximum 120 samples, and append realtime SSE samples with the same local cap.
281. **No chart dependency:** CPU/memory trend rendering uses compact SVG/Chakra primitives rather than adding another frontend chart package.
282. **Persian date/time is client-local:** the dashboard uses Intl.DateTimeFormat with the Persian calendar and the browser-local clock. It does not infer PBX/server timezone and adds no date library.
283. **Service health is conditional:** render systemd service states only when the existing metrics sample contains them; absence remains an explicit not-configured/no-data state.
284. **Legacy OpenSSH compatibility:** deployment documentation must include a SHA-256 host-key fingerprint fallback for OpenSSH versions where ssh-keygen -E is unavailable, computed from the trusted local host public-key file.
285. **Task 43 remains next:** this correction is presentation/deployment documentation only and does not consume the trunk-discovery task.


## 2026-10-05 — Navigation hierarchy and dashboard storage preferences

286. **Three top-level work areas:** authenticated navigation is limited to Dashboard, Telephony, and Settings. Feature growth must not add every workspace directly to the global header.
287. **Telephony submenu ownership:** Calls, Channels, Endpoints, Trunks, Queues, and Agents belong under a horizontal Telephony submenu.
288. **Settings submenu ownership:** PBX profiles, System metrics SSH, Dashboard storage, Security monitoring, and future administrative surfaces belong under a horizontal Settings submenu.
289. **Storage preference is PBX-scoped and server-persisted:** selection is stored in SQLite rather than browser localStorage so all administrators/browsers see the same deployment configuration.
290. **Filesystem IDs, not hardcoded paths:** the preference stores selected IDs from the current normalized filesystem sample. Repository defaults never name deployment-specific mount paths.
291. **Default-all semantics:** absence of a stored preference means display all current filesystems. A stored empty array means display none. Deleting/resetting the preference restores default-all.
292. **Collection remains complete:** dashboard visibility preference filters presentation only. Restricted SSH collection continues to collect the bounded filesystem sample and does not receive user-provided shell/path arguments.
293. **Bounded preference input:** API accepts at most 128 unique non-empty filesystem IDs, each at most 512 characters, through authenticated PBX-scoped same-origin PUT; GET is read-only and DELETE resets.
294. **Schema migration 12:** dashboard_storage_config is append-only migration state with PBX foreign-key cascade and JSON validity enforcement.


## 2026-10-05 — Dashboard builder and service-monitoring correction

295. **Dashboard becomes a persisted PBX-scoped builder:** one fixed layout is replaced by named dashboard definitions stored server-side so TV/NOC layouts are shared across browsers.
296. **Multiple dashboards:** each PBX may own multiple dashboards. Absence of any saved dashboard causes the UI to create one generic default dashboard; deletion of the last dashboard recreates a generic default.
297. **Allowlisted widget model:** dashboard persistence stores only unique safe widget ID, fixed widget type, bounded width, bounded height, name, and array order. No arbitrary executable/config data is accepted.
298. **Bounded layout:** each dashboard accepts at most 64 widgets; width is 1-12 columns and height is 1-4 units. Drag-and-drop changes array order only.
299. **No grid dependency:** native HTML drag/drop plus Chakra/CSS Grid and bounded resize controls are used instead of adding a dashboard/grid package and its license/bundle surface.
300. **TV fullscreen boundary:** request fullscreen on the dashboard root element, not documentElement. Application navigation is therefore outside fullscreen. Dashboard controls auto-hide after three seconds and reappear on pointer movement.
301. **Service Health configuration is PBX-scoped:** systemd service IDs are explicit persisted monitoring configuration, not application defaults or inferred host services.
302. **Service identifier boundary:** at most 32 unique IDs, each at most 128 characters and matching the existing conservative service-ID allowlist. No shell fragment or arbitrary program/path is accepted.
303. **Service changes resync metrics only:** service-monitoring PUT/DELETE calls SystemMetricsRuntime.syncProfile for that PBX. It does not restart the PBX or application.
304. **Collector factory owns service injection:** production RestrictedSshSystemMetricsCollectorFactory reads the PBX service-monitoring repository and passes those IDs into RestrictedSshSystemMetricsCollector. This corrects the previous permanent NOT_CONFIGURED behavior.
305. **Schema migrations 13-14:** migration 13 stores service-monitoring IDs with PBX cascade; migration 14 stores named operator dashboards with PBX cascade and JSON validity.
306. **Task 43 remains next:** dashboard-builder/service-monitoring work is an operator-requested correction and does not consume the trunk-discovery roadmap task.


## 2026-10-05 — Local administrator account management

307. **Reuse the existing administrator schema:** account management uses the current administrator/auth_session tables; no migration is required merely to expose safe CRUD.
308. **Single role stays explicit:** all local accounts are ADMINISTRATOR. Do not invent viewer/operator roles until a real authorization model is designed and enforced end-to-end.
309. **Safe account metadata only:** list/update responses expose id, username, enabled, fixed role, created/updated, and last-login metadata; never password hashes or session tokens.
310. **Existing auth validation is authoritative:** usernames reuse normalizeUsername and passwords reuse validPassword/hashPassword.
311. **Session revocation on sensitive change:** disabling an account or resetting its password revokes all sessions for that account.
312. **Lockout prevention:** reject self-disable, self-delete, and disable/delete of the last enabled administrator.
313. **Mutation protection:** create/update/password-reset/delete require authenticated same-origin writes.
314. **UI-test account is deployment-local:** Selenium credentials are not repository configuration. Provision them only into the target deployment and keep them under the local/private secret boundary.


## 2026-10-05 — Task 43 broader trunk discovery

315. **Trunk role confidence is explicit:** CONFIRMED means the provider exposed an explicit outbound registration object. Peer/endpoint heuristics are CANDIDATE; the monitor must not claim they are certainly trunks.
316. **Provider-neutral trunk dimensions:** normalized trunk state carries kind (OUTBOUND_REGISTRATION or PEER), technology (CHAN_SIP or PJSIP), confidence, registration state, and optional bounded reachability.
317. **Non-registration peers use NOT_APPLICABLE:** registration state for a peer candidate is NOT_APPLICABLE, never a fabricated REGISTERED/UNREGISTERED value.
318. **chan_sip candidate boundary:** only static SIPpeers entries (Dynamic=no/false/0) become trunk candidates. Dynamic peers remain endpoints only.
319. **PJSIP candidate boundary:** PJSIPShowEndpoints entries become candidates only when OutboundAuths is meaningfully configured. Empty and none-style values are ignored.
320. **PJSIP registrations are confirmed:** PJSIPShowRegistrationsOutbound OutboundRegistrationDetail items become confirmed trunks; associated AuthDetail fields are not forwarded.
321. **Reuse one SIPpeers snapshot:** endpoint inventory and static chan_sip trunk candidates share one SIPpeers request per reconcile.
322. **Bounded source size:** each trunk source is capped at 4096 received items and fails closed when exceeded.
323. **Merge policy:** normalized trunk IDs deduplicate sources; confirmed entries outrank candidates.
324. **Partial source capability:** trunk capability is supported when any trunk source is supported. If none are supported, permission denial takes precedence over unsupported.
325. **No provider-private addressing/auth details:** normalized trunk state does not expose chan_sip IP addresses, PJSIP Contacts, ServerUri/ClientUri, auth object content, or raw AMI payloads.
326. **No new active PBX operation:** Task 43 adds only read-only list actions. No qualify/register/unregister/originate/configuration action is used.
327. **PJSIP/static peer refresh model:** only the existing chan_sip Registry event is live-normalized; PJSIP registrations and peer candidates refresh on normal reconciliation.
328. **Real-PBX verification remains separately gated:** Task 43 completion is based on synthetic/mock compatibility. No production PBX probe is required to merge the implementation.
329. **Task 44 remains next:** after Task 43 merges, implement bounded PBX-scoped telephony history/retention from normalized data only.


## 2026-10-05 — Runtime SSE/backpressure resilience correction

330. **Observed outage classification:** the browser Application unavailable state can occur while the HTTPS shell remains reachable if the backend child dies; systemd Active on the launcher alone is not sufficient proof that the backend API is alive.
331. **OOM evidence boundary:** the observed backend exit was a V8 JavaScript heap OOM. The post-crash evidence does not prove one unique allocation producer, so the SSE backpressure path is documented as a concrete unbounded-memory risk, not asserted as the sole proven OOM source.
332. **Bound SSE server buffering:** each SSE ServerResponse is limited to 256 KiB of queued writable bytes. Exceeding the bound destroys that stream so EventSource can reconnect rather than allowing indefinite process-memory growth.
333. **Idempotent SSE teardown:** stream cleanup is attached to both request and response close boundaries and guarded to run once, removing listeners, timers, reset subscriptions, and stream-set entries.
334. **Backend and gateway are one service failure domain:** the production launcher supervises both child processes. Unexpected exit of either child makes the launcher fail so the existing systemd Restart=on-failure policy can restart the whole stack.
335. **No PBX scope change:** runtime-resilience changes affect HTTP/SSE transport and local process supervision only; no PBX action, collection source, credential flow, or telephony contract changes.
336. **Task 44 waits for correction merge:** telephony-history implementation must branch from main only after this runtime-resilience correction is merged.


## 2026-10-05 — Fullscreen dashboard presentation correction

337. **Fullscreen is presentation-only:** the normal dashboard management toolbar is not rendered while the dashboard root is fullscreen.
338. **No fullscreen edit mode:** entering fullscreen exits edit mode; drag, resize, delete, edit-border, and edit-spacing behaviors remain available only outside fullscreen.
339. **Exit control is overlay-only:** fullscreen exposes one small fixed Exit full screen control that appears on pointer movement and auto-hides after the existing three-second timer; it never reserves dashboard layout space.
340. **Browser-native escape remains valid:** the browser Esc path remains the zero-UI fallback for leaving fullscreen.
341. **Fullscreen target remains dashboard root:** application-level navigation/header stays outside fullscreen; no document-level fullscreen is introduced.
342. **Task 44 remains next:** after this UI correction merges and the merged behavior is Selenium-validated, resume the roadmap with telephony history/retention.


## 2026-10-06 — Source-owned history and read-only database architecture

343. **Product intent is real-time monitoring, not a duplicate historical warehouse:** VoIP Monitor is an operational dashboard. Historical/reporting systems already maintained by the PBX or related source remain authoritative.
344. **Do not add local telephony-history persistence:** the former Task 44 design is superseded. New historical views must query approved read-only source systems rather than copy their rows into the monitor database.
345. **Persistent application storage remains valid for configuration and justified operational state:** user accounts, PBX profiles, encrypted credentials, dashboard definitions, source configuration, and delivery/reliability state may persist because they are application-owned rather than duplicated monitoring telemetry.
346. **External database access is PBX-scoped and read-only by contract:** configuration records declare READ_ONLY access; credentials are write-only and encrypted through SecretStore. Application code must never expose the credential through API responses or logs.
347. **Database connectivity is separately gated:** Task 44 stores configuration only. It performs no DNS resolution, socket connection, schema discovery, or query against a real database. A later transport task must enforce SELECT-only semantics, bounded query time/rows/output, and the shared network boundary.
348. **Source dialect is explicit:** configuration records the declared SQL dialect so later adapters do not infer or silently guess schema/driver behavior. Declaring a dialect does not imply that connectivity has been verified.
349. **No destructive cleanup before replacement is proven:** existing locally persisted metrics/security histories are legacy relative to the new direction. They are not removed until source/in-memory replacements and migration effects are explicitly reviewed and validated.
350. **Roadmap transition:** Tasks 44-48 replace the former local telephony-history task with configuration, bounded read-only transport, source-schema adapters, source-backed views, and a controlled cleanup of legacy duplicate histories.


## 2026-10-06 — Task 44 read-only database source configuration

351. **Task 44 configuration schema is intentionally small:** one optional PBX-scoped row stores declared dialect, host, port, database name, username, fixed `READ_ONLY` intent, and timestamps only. Password material never enters the metadata table.
352. **Initial declared dialect allowlist is configuration-only:** `MYSQL_MARIADB` and `POSTGRESQL` are accepted so future adapters have an explicit driver family. This does not claim connectivity or schema compatibility for either dialect.
353. **Password replacement is explicit and write-only:** Save requires a fresh database password, encrypts it through the existing `SecretStore`, clears the browser password field after success, and exposes only `hasCredential` in safe responses.
354. **No Task 44 connection-test endpoint:** saving database-source settings does not resolve DNS, connect to a host, inspect schemas, or execute SQL. Those operations belong only to later bounded transport/schema tasks and any real compatibility gate requires separate approval.

## 2026-10-06 — Task 45 bounded read-only database transport

355. **Transport is internal, not a public raw-SQL feature:** Task 45 creates a provider-neutral query boundary for later schema adapters. It adds no historical-query HTTP endpoint, browser query action, startup probe, periodic database poller, or automatic connection test.
356. **SELECT-only is fail-closed and intentionally narrow:** accepted SQL must begin with one `SELECT`; comments, statement separators, CTE prefixes, write/admin keywords, `SELECT INTO`, and row-locking forms are rejected before any DNS or driver call. Parameters use one bounded generic placeholder contract rather than string interpolation.
357. **Row limits are applied at the server and verified again locally:** the transport wraps accepted SQL in an outer `SELECT ... LIMIT maxRows+1`, then treats the extra row as a `ROW_LIMIT` failure. Query text, parameter count/size, timeout, row count, and normalized output bytes all have hard maxima.
358. **Database-side read-only enforcement is defense in depth:** MySQL/MariaDB runs `START TRANSACTION READ ONLY`; PostgreSQL runs `BEGIN READ ONLY`; both roll back and close after each operation. The configured database principal must itself remain read-only because SQL parsing alone is not an authorization boundary.
359. **One operation timeout covers resolution, connect, and query:** the timeout starts before hostname resolution and aborts/destroys the active dialect operation when exceeded. Driver errors are mapped to bounded application error codes and raw database/driver details are not propagated.
360. **Shared network policy applies before drivers:** hostnames are resolved once by an injected resolver; every returned address must pass the existing network boundary, and the dialect adapter receives one approved numeric address. Literal IPs skip DNS. The driver must not perform a second hostname resolution.
361. **TLS policy is explicit and persistent:** migration 16 adds `tls_mode` with `REQUIRED` as the default and only `REQUIRED` or `DISABLED` accepted. There is no opportunistic downgrade. `DISABLED` is an explicit trusted-network exception, not an automatic compatibility fallback.
362. **TLS identity is preserved while preventing DNS rebinding:** PostgreSQL connects to the approved numeric address while using the configured hostname as TLS `servername`. MySQL/MariaDB receives the configured hostname for SNI/certificate identity but uses an injected TCP stream that connects only to the approved numeric address.
363. **Returned data is normalized before later consumers see it:** Task 45 accepts only bounded JSON-safe scalar result values (`string`, finite `number`, `boolean`, `null`) and rejects binary/date/object values until a later source-schema adapter explicitly defines their semantics.
364. **Dialect drivers are pinned and reviewed:** Task 45 adds exact runtime versions `mysql2` 3.24.5 and `pg` 8.23.1 plus development types `@types/pg` 8.23.1. Their published package licenses are MIT and the repository license gate remains authoritative for resolved identifiers.
365. **Synthetic validation only:** driver factories, resolver, and dialect adapters are injectable and Task 45 tests use synthetic/mocked targets only. No real PBX database, credential, schema, or production host is contacted and no real compatibility claim is made.
366. **Output-byte bound has a known driver-materialization limit:** row count is capped server-side, but mysql2/pg can materialize a single oversized field before the application can measure normalized output bytes. Task 45 therefore bounds normalized output after driver return; cursor/streaming enforcement is a future hardening option if source schemas can contain unusually large values.
367. **Task 46 remains next after merge:** source-specific historical/reporting schema adapters consume this internal transport only after Task 45 is merged.

## 2026-10-06 — Task 46 source-schema adapters

368. **The first history schema adapter is explicit, not universal:** `ASTERISK_CONVENTIONAL_SQL_V1` targets conventional SQL-backed Asterisk-style `cdr`, `cel`, and `queue_log` shapes only. Its presence does not claim compatibility with every Asterisk/FreePBX installation or custom reporting schema.
369. **Schema support is discovered before data reads:** the adapter queries `information_schema.columns` through the Task 45 read-only transport and classifies each dataset independently as `SUPPORTED`, `NOT_FOUND`, `SCHEMA_MISMATCH`, or `AMBIGUOUS`. Missing/ambiguous schemas are not represented as empty successful history.
370. **Required columns are deliberately minimal:** CDR requires `calldate`, `src`, `dst`, `duration`, `billsec`, `disposition`, and `uniqueid` with optional `linkedid`; CEL requires `eventtime`, `eventtype`, and `uniqueid` with optional `linkedid`, `exten`, and `cid_num`; SQL queue history requires `time`, `callid`, `queuename`, `agent`, and `event`.
371. **Normalized historical contracts are provider-neutral:** shared call, call-event, queue-event, and dataset-capability records expose only bounded normalized fields. Known source dispositions/events map to bounded enums and unknown source event names become `UNKNOWN`/`OTHER` rather than crossing the adapter boundary as arbitrary provider strings.
372. **Naive source timestamps are not relabeled as UTC:** SQL timestamp values are cast to bounded text and retained as `sourceStartedAt` / `sourceOccurredAt`. The adapter does not invent a timezone offset when the source schema does not provide one.
373. **Historical reads remain bounded and non-persistent:** recent reads accept only 1–200 rows and retain Task 45 timeout/output bounds. Task 46 adds no SQLite history table, cache, background poller, startup connection, or user-facing database query endpoint.
374. **Dynamic identifiers come only from inspected schema metadata:** schema/table/column names are taken from `information_schema`, bounded, dialect-quoted, and escaped before generated SQL. User-supplied identifiers are not interpolated into historical queries.
375. **Dialect differences stay inside the adapter:** MySQL/MariaDB and PostgreSQL use dialect-safe identifier quoting and explicit text casts so date/numeric driver behavior is normalized before row parsing while the shared result contract remains unchanged.
376. **Synthetic fixtures are the only Task 46 compatibility evidence:** tests cover supported, missing, mismatched, and ambiguous schemas plus CDR/CEL/queue normalization and fail-closed input handling. No real database/schema/credential was contacted; real compatibility verification still requires separate operator approval.
377. **Task 47 is the first user-facing consumer:** authenticated bounded source-backed historical/reporting APIs and UI may consume these adapters after Task 46 is merged, but must not persist returned source rows locally.

## 2026-10-06 — Task 47 source-backed history exposure

378. **History is GET-only and adapter-owned:** browser/API consumers select only fixed capability/calls/call-events/queue-events operations; there is no raw SQL or identifier input surface.
379. **User-facing row bounds remain 1–200:** the API validates the limit before adapter invocation and underlying transport timeout/row/output limits remain mandatory.
380. **No local copy:** source rows are returned transiently and Task 47 adds no SQLite history table, cache, background poller, or browser persistence.
381. **Schema capability is visible:** unsupported, missing, mismatched, and ambiguous datasets are explicit UI/API states rather than false empty-success history.
382. **Source timestamp semantics remain unchanged:** naive source timestamps are shown as source-reported strings; neither API nor UI invents UTC or another timezone.
383. **Errors are bounded:** database/schema/driver internals, SQL text, host details, and credentials are not exposed through history errors.
384. **Real database access remains separately approved:** Task 47 validation is synthetic/mock only and makes no production schema compatibility claim.
385. **Task 48 is next:** reconcile legacy persisted monitoring histories only after Task 47 merges, with a safe migration/cleanup plan before destructive removal.

## 2026-10-06 — Task 48 non-duplication reconciliation

386. **No new local monitoring-history writes:** system metric, security event, and security alert history are process-local bounded buffers.
387. **Current operational state may remain durable:** latest metric/event state and current alerts are bounded current-state records, not historical warehouses, and remain persisted for restart continuity.
388. **Existing history contracts remain stable:** APIs/UI/evaluator keep using repository history interfaces while their implementation is in-memory.
389. **Bounded memory:** system metrics are capped at 2048 records per PBX; security events and alerts are capped at 500 records per PBX, with existing retention cutoffs applied.
390. **Restart semantics are explicit:** in-memory history starts empty after restart and refills from live monitoring; durable reporting belongs to approved source systems.
391. **No destructive migration in Task 48:** legacy history tables remain untouched and receive no new rows.
392. **Cleanup requires proof:** table removal needs deployment observation, downstream dependency review, and a tested backup/restore point before a separately reviewed migration.
393. **Task 49 is next:** hardening, backup, tested restore, and production deployment runbook includes the explicit legacy-history cleanup decision.

## 2026-10-06 — Task 49 production hardening and recovery

394. **Stopped-service backup is the recovery baseline:** operational consistency is preferred over hot-copy complexity; backup requires explicit confirmation that the service is stopped.
395. **Database and master key are one recovery unit:** backup validates SQLite format and exact 32-byte key size and restores both together with private environment metadata.
396. **Recovery sets are integrity-protected, not encrypted by the script:** SHA-256 checksums and restrictive permissions are built in; encryption at rest/in transit remains organization policy.
397. **Restore is fail-closed:** validation precedes writes and existing target files require explicit `--allow-overwrite`.
398. **Recovery readiness requires a drill:** automated synthetic coverage reopens restored SQLite and checks a probe; production readiness additionally requires an isolated restore of a current production recovery set.
399. **Systemd hardening remains compatibility-aware:** empty capabilities, namespace/device/kernel/process protections and AF_UNIX/AF_INET/AF_INET6 restrictions are accepted; aggressive syscall/JIT restrictions are deferred until exact runtime validation.
400. **Legacy history tables remain:** Task 49 does not destructively drop them; production observation, dependency review, fresh backup, isolated restore, and separate migration approval are mandatory before deletion.
401. **Task 50 is next:** release validation must prove a clean organization-neutral deployment without importing private state from another installation.

## 2026-10-06 — Task 50 release validation

402. **Release validation must start from staged clean source:** a temporary seed commit from the Git index is cloned into a fresh worktree so uncommitted release-candidate changes can be validated without copying runtime state or mutating project refs.
403. **High/critical dependency audit is a release gate:** the clean-clone drill runs npm audit at high severity; the discovered source-map-js 1.2.1 advisory was resolved to patched 1.2.2 before acceptance.
404. **Fresh deployment must prove operational recovery:** acceptance includes isolated HTTPS boot, health/readiness, first-admin onboarding, synthetic secret-safe PBX configuration, stopped-service backup, checksum-validated restore, login/state recovery, and restart recovery.
405. **Physical reboot remains an explicit PBX boundary:** if a host would reconnect to a real PBX on boot, reboot validation requires explicit approval.
406. **Installed service drift blocks release acceptance:** Task 50 detected an older installed systemd unit after the first reboot; acceptance required installing the merged hardened unit and repeating the reboot gate.
407. **No additional PBX probe is needed for reboot evidence:** existing transport reconnection can be verified from local service/network state without sending new PBX commands.
408. **Current approved roadmap ends at Task 50:** no Task 51 is defined; after merge, work stops until an explicit next roadmap item is approved.


## 2026-10-06 — UI/UX-first roadmap decision

409. **UI/UX modernization moves before new monitoring features:** the accepted roadmap begins with Task 51–55 design/system/workspace modernization before unified health, call quality, and operational alerting.
410. **Task 51 is design-first:** production UI implementation is blocked until a desktop master mockup and interaction hierarchy are approved.
411. **Visual direction is Modern NOC / Operations Console:** avoid generic admin-template styling, excessive equal-weight cards, decorative gauges, gaming/cyberpunk aesthetics, and SaaS landing-page patterns.
412. **Overview is problem-first:** current health/problems, realtime telephony load, trunk/endpoint/queue state, infrastructure, and data freshness must drive first-glance hierarchy.
413. **Semantic color is restrained:** healthy/warning/critical/stale colors communicate state rather than decorate the page.
414. **Bilingual behavior is a design constraint:** Persian chrome/prose is RTL while technical identifiers remain stable LTR; charts/time axes must not be semantically mirrored.
415. **Dashboard editing is secondary:** operator decision hierarchy takes precedence over customization in the default experience.
