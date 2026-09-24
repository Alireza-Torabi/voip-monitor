# Troubleshooting

**Status:** The development skeleton is runnable; production monitoring is not implemented.

- If `node` or `npm` is missing, install the pinned Node.js 24 toolchain from a trusted source. Docker remains optional for this local task and Compose has no services yet.
- If `python3 scripts/check_foundation.py` fails, read the reported file and fix the public-source or documentation issue before committing.
- If `git check-ignore .local/DEPLOYMENT_CONTEXT.md` prints nothing, repair `.gitignore` before recording private context.
- If pushing fails, inspect the exact Git error and current remote/authentication state. Do not change credentials automatically or force push.
- If a secret was staged or committed, stop. Determine whether it was pushed, rotate affected credentials, and coordinate cleanup; deletion in a later commit does not remove history.

PBX connectivity, database recovery, and dashboard troubleshooting will be added when those components exist. Never troubleshoot against a production PBX by changing its configuration without a reviewed change plan.

For the backend, run `npm run build -w backend` before `npm run start -w backend`; then check `GET /health` on its local bind address. If the port is busy, set a different `APP_PORT`. For the frontend, run `npm run dev -w frontend` and use the URL printed by Vite. If dependencies are inconsistent, rerun `npm ci --ignore-scripts` with TLS verification enabled.
