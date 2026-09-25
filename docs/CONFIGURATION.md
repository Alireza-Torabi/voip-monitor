# Application configuration

**Status:** Phase 2 Task 6 adds authenticated PBX onboarding to validated backend settings, SQLite, and protected secret storage. It does not load `.env` files automatically. Supply settings through the process environment or your deployment manager; `.env.example` is a tracked example, and a real `.env` is ignored by Git.

| Setting | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | `development`, `test`, or `production` |
| `APP_HOST` | `127.0.0.1` | HTTP listen host |
| `APP_PORT` | `3000` | HTTP port, integer from 1 to 65535 |
| `APP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `DATA_PATH` | `/data` | Absolute application data directory |
| `APP_SECRET_DIR` | `<DATA_PATH>/secrets` | Absolute directory for the protected master key |
| `APP_DATABASE_PATH` | `<DATA_PATH>/monitor.sqlite3` | Absolute path of the SQLite database |

The path settings are validated and exposed through typed configuration. Startup creates the database parent directory and SQLite file when absent, then runs migrations before listening. Keep runtime files outside the checkout and Git. Invalid explicit settings stop the backend before it listens. Configuration errors identify fields, not supplied values. Structured log details redact fields whose names contain `password`, `secret`, `token`, `key`, or `authorization`. The health endpoint remains a generic `{ "status": "ok" }` response.

Application environment settings are distinct from PBX setup. PBX addresses and other non-secret metadata are entered through authenticated onboarding and stored at runtime. PBX credentials use dedicated protected secret storage, not permanent process variables such as `PBX_HOST`, `AMI_USERNAME`, or `AMI_PASSWORD`. Private development and deployment facts belong only under ignored `.local/`; never copy them into tracked examples.

The first-run setup row starts at `SETUP_REQUIRED`. `SETUP_IN_PROGRESS` now follows first-admin creation; `PBX_CONFIGURED_UNVERIFIED` follows the first saved PBX profile; `COMPLETE` awaits future provider verification. Startup creates or validates `<APP_SECRET_DIR>/master.key` after database migrations. The key directory must be owner-controlled with mode 0700 and the raw 32-byte key file with mode 0600. An absent key is created only when no encrypted secret records exist. Secret-storage failure stops startup. No AMI, SSH, or PBX connection exists yet. The host path for a future `/data` mount is selected by the operator; do not use the checkout for runtime data. See [Architecture](ARCHITECTURE.md).

## First administrator and sessions

No bootstrap token, password, or session token is configured through environment variables. On first start without an administrator, the backend creates `<APP_SECRET_DIR>/bootstrap-admin.token` with mode 0600 in the mode-0700 secret directory. Retrieve it only through trusted local server access; do not put it in environment files, shell history, tickets, or logs. Use `GET /setup/status` to see whether administrator setup is required. Supply the token to `POST /setup/admin` with `username` and `password` as JSON. Successful setup removes the token and changes setup state to `SETUP_IN_PROGRESS`, which does not mean PBX setup is complete. Then explicitly log in through `POST /auth/login`. `GET /auth/me` reports the active administrator and `POST /auth/logout` revokes the current session. Passwords need 12–256 Unicode code points (max 1024 UTF-8 bytes); usernames normalize with NFKC and ASCII lowercase.

Sessions expire absolutely after 12 hours. The `vm_session` cookie is HttpOnly, SameSite=Strict, Path=/, and has matching Max-Age; production adds Secure and requires HTTPS Origin for POST requests. Development/test permits HTTP Origin and omits Secure for local HTTP. Deploy production only behind a same-origin HTTPS reverse proxy that controls Host; the application does not trust forwarded IP headers. No OAuth, LDAP, Active Directory, SSO, or automatic account recovery exists.

## PBX profile configuration

Authenticated administrators can manage Asterisk profiles through `/api/pbx-instances`. FreePBX uses the Asterisk provider; other vendors are unsupported. Profile data comprises a server-generated ID, display name, enabled flag, and Asterisk-scoped AMI host, port, and username. Hostnames, IPv4, and IPv6 are syntax-checked without DNS lookup. AMI port 5038 is a UI suggestion, not a fixed requirement. No SSH configuration is requested yet. The AMI password is encrypted in `pbx_secret` and never appears in response JSON. An omitted password on PATCH preserves it, a nonempty password replaces it, and `removeAmiPassword: true` removes it. Empty or conflicting changes are rejected. `enabled` records administrator intent for future monitoring; it starts false and does not activate a connection now.

The first profile changes setup state to `PBX_CONFIGURED_UNVERIFIED`; deleting the final profile returns it to `SETUP_IN_PROGRESS`. Profiles always report `UNVERIFIED` in this phase. No DNS resolution, AMI/SSH connection, discovery, or connection test occurs. The frontend development proxy forwards same-origin API routes to a local backend on port 3000. Start that backend with `APP_ENV=development`; production requires a controlled HTTPS reverse proxy and continues to enforce HTTPS Origin checks.
