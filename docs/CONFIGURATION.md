# Application configuration

**Status:** Phase 2 Task 3 provides validated backend settings and SQLite storage. It does not load `.env` files automatically. Supply settings through the process environment or your deployment manager; `.env.example` is a tracked example, and a real `.env` is ignored by Git.

| Setting | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | `development`, `test`, or `production` |
| `APP_HOST` | `127.0.0.1` | HTTP listen host |
| `APP_PORT` | `3000` | HTTP port, integer from 1 to 65535 |
| `APP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `DATA_PATH` | `/data` | Absolute application data directory |
| `APP_SECRET_DIR` | `<DATA_PATH>/secrets` | Absolute directory reserved for future protected key storage |
| `APP_DATABASE_PATH` | `<DATA_PATH>/monitor.sqlite3` | Absolute path of the SQLite database |

The path settings are validated and exposed through typed configuration. Startup creates the database parent directory and SQLite file when absent, then runs migrations before listening. Keep runtime files outside the checkout and Git. Invalid explicit settings stop the backend before it listens. Configuration errors identify fields, not supplied values. Structured log details redact fields whose names contain `password`, `secret`, `token`, `key`, or `authorization`. The health endpoint remains a generic `{ "status": "ok" }` response.

Application environment settings are distinct from PBX setup. PBX addresses and other non-secret metadata will be entered during future authenticated onboarding and stored at runtime. PBX credentials will use dedicated protected secret storage, not permanent process variables such as `PBX_HOST`, `AMI_USERNAME`, or `AMI_PASSWORD`. Private development and deployment facts belong only under ignored `.local/`; never copy them into tracked examples.

The first-run setup row starts at `SETUP_REQUIRED`. Future setup stages may use `SETUP_IN_PROGRESS` and `COMPLETE`; no administrator account or onboarding API exists yet. No AMI, SSH, PBX connection, or secret storage implementation exists yet. The host path for a future `/data` mount is selected by the operator; do not use the checkout for runtime data. See [Architecture](ARCHITECTURE.md).
