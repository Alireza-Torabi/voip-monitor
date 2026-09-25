# Operations

**Status:** The local backend has authenticated PBX onboarding, encrypted AMI credentials, a provider runtime lifecycle, and an authenticated AMI connection test. Telephony event monitoring and tested backup/restore are not implemented yet.

## Current checks

Run from the repository root:

```sh
python3 scripts/check_foundation.py
python3 scripts/check_licenses.py
npm run lint
npm run typecheck
npm run test
npm run build
git status --short --branch
git check-ignore .local/DEPLOYMENT_CONTEXT.md
```

The foundation checker verifies required public files, safe environment examples, ignored local/runtime paths, workspace manifests, and selected credential patterns. The license checker compares lockfile identifiers with reviewed values. It is not a complete secret scanner. Review staged changes manually before each commit.

## Planned runtime

The backend writes SQLite under the validated application data path, normally an operator-selected directory mounted at `/data`. Startup creates the parent directory, opens the database, applies migrations, validates or creates the master key, then starts HTTP. Migration mismatch or database failure stops startup with a generic log code. `GET /health` is liveness; `GET /ready` checks the local database and matching master-key file and returns 503 when either is unavailable. PBX absence or outage does not affect readiness. The master key is stored separately at `<APP_SECRET_DIR>/master.key` (normally `/data/secrets/master.key`) under an owner-controlled mode-0700 directory; the file uses mode 0600. If a key is missing while encrypted records exist, startup fails. Malformed, unreadable, or unsafe key paths also stop startup. Logs will go to container standard output and must redact credentials. Monitoring failures must not affect PBX calls.

Encrypted PBX secrets use AES-256-GCM envelope version 1 and key version 1. Each encryption uses a fresh random nonce; authenticated data binds PBX instance ID, secret name, and both versions. Plaintext exists briefly in backend memory when used. JavaScript cannot guarantee deterministic memory erasure. No key rotation is implemented.

A future recovery needs the SQLite database, matching master key, and runtime configuration as applicable. Use a coordinated SQLite backup or stopped copy, including journal files where relevant; preserve the master key securely with preferably separate access controls. A database backup without the correct key can make encrypted credentials permanently unrecoverable. The key alone cannot reconstruct configuration or encrypted records. Backup, restore, and key rotation are not implemented or validated yet. Detailed deployment, retention, upgrade, rollback, and uninstall procedures remain future work. Do not run production maintenance based on this foundation document.

## First administrator bootstrap

On a fresh database, start the backend and read `<APP_SECRET_DIR>/bootstrap-admin.token` through trusted local server access as the application owner. The file is 0600 inside the 0700 secret directory; avoid copying it to tickets, logs, shell history, or tracked files. The browser setup page or a same-origin HTTPS API client can send JSON `username`, `password`, and `bootstrapToken` to `POST /setup/admin`. `GET /setup/status` exposes only whether setup is required. After a 201 response, use `POST /auth/login` to obtain an HttpOnly cookie. Logout through `POST /auth/logout`; `GET /auth/me` returns the current safe identity. Setup advances to `SETUP_IN_PROGRESS`; the first saved PBX advances it to `PBX_CONFIGURED_UNVERIFIED`, not complete. The token is deleted after successful claim. If deletion fails, the database still prevents another claim and startup retries removal with a content-free warning. No automatic first-admin recovery exists. Preserve the database for account persistence; a lost password needs a separately designed recovery process.

The 12-hour session expiry is absolute. Production cookies require HTTPS and a same-origin HTTPS Origin on POST; use an HTTPS reverse proxy with controlled Host. Development/test allows HTTP. Per-socket-IP and global attempt counters are process-local, reset on restart, and do not trust forwarded IP headers. A distributed deployment needs a shared limiter before it is supported. `GET /ready` remains healthy before and after administrator creation when storage initializes. `GET /health` never exposes setup or account details.

## Local PBX onboarding

After login, use the bilingual browser form to add an Asterisk / FreePBX profile. Enter only synthetic data during development. The form stores a display name, AMI host or IP, AMI port (5038 suggested), AMI username, and a new AMI password. The password is write-only: a saved profile shows only “Password configured.” Editing with the password field empty preserves the stored credential; entering a new nonempty value replaces it; “Remove password” explicitly deletes it. Enable/disable changes the local profile intent; with the default network-disabled mode it opens no PBX connection, while explicit `plain_tcp` mode starts or stops the corresponding managed provider. “Delete local profile” stops its runtime entry and removes the profile plus encrypted secret records from this application's SQLite database.

The same-origin backend routes are `GET/POST /api/pbx-instances` and `GET/PATCH/DELETE /api/pbx-instances/:id`; all require an administrator session, and writes require the Task 5 Origin check. Start the local backend with `APP_ENV=development` on port 3000 before `npm run dev -w frontend`; Vite proxies `/setup`, `/auth`, and `/api` to that backend while preserving browser Origin and Host. Production needs a controlled HTTPS reverse proxy. The first saved profile is `PBX_CONFIGURED_UNVERIFIED`. PBX networking remains disabled unless `APP_PBX_NETWORK_MODE=plain_tcp` is set explicitly. In that opt-in mode, enabled profiles get one persistent provider lifecycle with reconnect/backoff and periodic reconciliation. Use the browser **Test connection** control or same-origin `POST /api/pbx-instances/:id/test-connection`; success records safe discovery metadata and a last-verification timestamp. `GET /api/pbx-instances/:id/provider-status` exposes safe runtime health. A failed PBX or failed test never makes `/ready` fail. Plain TCP AMI is suitable only for a trusted/protected network path.
