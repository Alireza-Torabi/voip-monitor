# Planning decisions — 2026-09-23

These decisions are proposed and implementation remains unverified.

1. **Separate observer:** Run monitoring on a separate VM, outside PBX call processing. The backend owns one persistent AMI connection per enabled PBX.
2. **Provider boundary:** Use a `PbxProvider` interface for lifecycle, read-only discovery, capabilities, health, snapshot, events, and reconciliation. Asterisk specifics live in the Asterisk adapter. No other provider support is claimed.
3. **Persistence:** Start with SQLite behind repository interfaces. Key all PBX data by instance ID.
4. **Secrets:** Encrypt PBX credentials at rest using Node crypto authenticated encryption. Store a random master key in a protected persistent file outside Git. Back up key and database together.
5. **Realtime:** Use authenticated WebSocket snapshots and revisioned incremental updates. Browser count must not drive PBX requests.
6. **Public source:** Use Apache-2.0, with private deployment facts only in ignored `.local/`.

7. **Toolchain foundation:** Use Node.js 24 LTS with npm workspaces, one lockfile, strict shared TypeScript options, and workspace-specific configs when source exists. No package installation is authorized in this phase; see `docs/TOOLCHAIN.md`.
8. **Compose staging:** Keep `docker-compose.yml` free of dummy runnable services until actual backend/frontend images exist. CI currently validates only existing foundation artifacts.
