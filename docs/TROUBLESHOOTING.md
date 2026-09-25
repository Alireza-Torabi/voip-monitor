# Troubleshooting

**Status:** The development skeleton is runnable; production monitoring is not implemented.

- If `node` or `npm` is missing, install the pinned Node.js 24 toolchain from a trusted source. Docker remains optional for this local task and Compose has no services yet.
- If `python3 scripts/check_foundation.py` fails, read the reported file and fix the public-source or documentation issue before committing.
- If `git check-ignore .local/DEPLOYMENT_CONTEXT.md` prints nothing, repair `.gitignore` before recording private context.
- If pushing fails, inspect the exact Git error and current remote/authentication state. Do not change credentials automatically or force push.
- If a secret was staged or committed, stop. Determine whether it was pushed, rotate affected credentials, and coordinate cleanup; deletion in a later commit does not remove history.

PBX connectivity, database recovery, and dashboard troubleshooting will be added when those components exist. Never troubleshoot against a production PBX by changing its configuration without a reviewed change plan.

For the backend, run `npm run build -w backend` before `npm run start -w backend`; then check `GET /health` on its local bind address. If the port is busy, set a different `APP_PORT`. For the frontend, run `npm run dev -w frontend` and use the URL printed by Vite. If dependencies are inconsistent, rerun `npm ci --ignore-scripts` with TLS verification enabled.

- If first-admin setup is required, read the bootstrap token file using trusted local access to the configured secret directory. A missing token is generated only before an administrator exists. Unsafe file permissions stop startup; repair ownership and permissions without publishing its contents.
- If setup returns 403, check the token, same-origin HTTPS Origin in production (HTTP in development/test), and whether an administrator already exists. Repeated guesses can return 429 for one minute. There is no automatic administrator reset.
- If login returns 401, check the normalized username and password. Disabled accounts also return 401. A 403 on POST indicates an Origin mismatch. A 401 from `/auth/me` can mean an expired or revoked session; log in again. Production cookies require HTTPS.

- If the onboarding UI cannot load profiles during local development, start the backend on port 3000 with `APP_ENV=development`, then start Vite. Its proxy preserves the browser Origin. Production POST requests require HTTPS and a controlled Host header.
- A PBX API 401 means the administrator session is absent or expired; log in again. A 403 on a write means the Origin check failed. A 400 means a field did not meet the schema (for example host syntax, port range, unsupported provider, or empty credential replacement); rejected values are not logged.
- “Configured, unverified” is expected. There is no PBX connection test or connectivity claim in this phase. Do not probe a PBX to troubleshoot profile entry.
