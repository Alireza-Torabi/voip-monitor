# Operations

**Status:** The local backend has SQLite and encrypted secret storage. There is no monitoring service or tested backup/restore procedure yet.

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
