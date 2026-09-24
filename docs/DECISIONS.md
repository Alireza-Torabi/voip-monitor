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
