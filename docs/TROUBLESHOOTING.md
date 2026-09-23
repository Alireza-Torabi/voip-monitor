# Troubleshooting

**Status:** The application is not runnable yet. These checks apply to the Phase 1 repository foundation.

- If `node`, `npm`, or `docker` is missing, no application build or Compose validation can run. Install tooling only under the operator's approved host policy.
- If `python3 scripts/check_foundation.py` fails, read the reported file and fix the public-source or documentation issue before committing.
- If `git check-ignore .local/DEPLOYMENT_CONTEXT.md` prints nothing, repair `.gitignore` before recording private context.
- If pushing fails, inspect the exact Git error and current remote/authentication state. Do not change credentials automatically or force push.
- If a secret was staged or committed, stop. Determine whether it was pushed, rotate affected credentials, and coordinate cleanup; deletion in a later commit does not remove history.

PBX connectivity, database recovery, and dashboard troubleshooting will be added when those components exist. Never troubleshoot against a production PBX by changing its configuration without a reviewed change plan.
