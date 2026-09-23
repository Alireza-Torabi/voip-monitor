# Operations

**Status:** Only repository foundation checks are operational. There is no monitoring service to run, back up, upgrade, or restore yet.

## Current checks

Run from the repository root:

```sh
python3 scripts/check_foundation.py
git status --short --branch
git check-ignore .local/DEPLOYMENT_CONTEXT.md
```

The checker verifies required public files, safe environment examples, ignored local/runtime paths, workspace manifests, and the absence of suspicious credential patterns in public files. It is not a complete secret scanner. Review staged changes manually before each commit.

## Planned runtime

The backend will own persistent AMI connections and write SQLite under an operator-selected directory mounted at `/data`. The master key will be stored separately at `/data/secrets/master.key` with restricted permissions. Logs will go to container standard output and must redact credentials. Monitoring failures must not affect PBX calls.

Backup must preserve database plus master key, followed by a tested restore. Health/readiness checks, graceful shutdown, retention, upgrade, rollback, and uninstall procedures will be documented once implemented. Do not run production maintenance based on this Phase 1 document.
