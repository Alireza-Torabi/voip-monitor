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
