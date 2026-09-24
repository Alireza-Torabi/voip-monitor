# Application configuration

**Status:** Phase 2 Task 2 provides validated backend application settings. It does not load `.env` files automatically. Supply settings through the process environment or your deployment manager; `.env.example` is a tracked example, and a real `.env` is ignored by Git.

| Setting | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | `development`, `test`, or `production` |
| `APP_HOST` | `127.0.0.1` | HTTP listen host |
| `APP_PORT` | `3000` | HTTP port, integer from 1 to 65535 |
| `APP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `DATA_PATH` | `/data` | Absolute application data directory |
| `APP_SECRET_DIR` | `<DATA_PATH>/secrets` | Absolute directory reserved for future protected key storage |
| `APP_DATABASE_PATH` | `<DATA_PATH>/monitor.sqlite3` | Absolute path reserved for the future database |

The path settings are validated and exposed through typed configuration; this task does not create files or directories. Invalid explicit settings stop the backend before it listens. Configuration errors identify fields, not supplied values. Structured log details redact fields whose names contain `password`, `secret`, `token`, `key`, or `authorization`. The health endpoint remains a generic `{ "status": "ok" }` response.

Application environment settings are distinct from PBX setup. PBX addresses and other non-secret metadata will be entered during future authenticated onboarding and stored at runtime. PBX credentials will use dedicated protected secret storage, not permanent process variables such as `PBX_HOST`, `AMI_USERNAME`, or `AMI_PASSWORD`. Private development and deployment facts belong only under ignored `.local/`; never copy them into tracked examples.

The proposed first-run flow and SQLite design remain future work. No AMI, SSH, PBX connection, database, or secret storage implementation exists yet. The host path for a future `/data` mount is selected by the operator; do not use the checkout for runtime data. See [Architecture](ARCHITECTURE.md).
