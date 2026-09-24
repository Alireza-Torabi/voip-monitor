# Operations

**Status:** A local development backend and frontend run, but SQLite storage exists, but there is no monitoring service, complete backup, upgrade, or restore procedure yet.

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

The backend writes SQLite under the validated application data path, normally an operator-selected directory mounted at `/data`. Startup creates the parent directory, opens the database, applies migrations, then starts HTTP. Migration mismatch or database failure stops startup with a generic log code. `GET /health` is liveness; `GET /ready` checks the local database and returns 503 when unavailable. PBX absence or outage does not affect readiness. The master key will be stored separately at `/data/secrets/master.key` with restricted permissions. Logs will go to container standard output and must redact credentials. Monitoring failures must not affect PBX calls.

A future backup must preserve the database and any associated journal files using a coordinated SQLite backup or stopped copy. Future encrypted secret data will also require the separate master key. Backup and restore are not implemented or validated yet. Detailed deployment, retention, upgrade, rollback, and uninstall procedures remain future work. Do not run production maintenance based on this foundation document.
