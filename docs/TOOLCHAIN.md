# Development toolchain

Phase 2 Tasks 1–6 target Node.js 24.21.0 and npm 11.19.0. `.node-version` pins the Node patch used for validation; `package.json` limits the supported major to Node 24. Use a trusted official Node distribution or an approved host package source. Do not install tooling on a legacy PBX.

The repository uses one npm workspace lockfile for `backend`, `frontend`, and `shared`. Install exact resolved packages from the repository root:

```sh
npm ci --ignore-scripts
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

`--ignore-scripts` was verified for this lockfile; it avoids install-time package scripts. Recheck it if dependencies change. The frontend development server is started with `npm run dev -w frontend`. From the repository root, build all workspaces with `npm run build` and start the backend with `npm run start -w backend`. Its routes include health/readiness, setup/authentication, authenticated PBX CRUD, `GET /api/pbx-instances/:id/provider-status`, and `POST /api/pbx-instances/:id/test-connection`. The backend requires a writable SQLite database path and a protected secret directory; startup creates a master key and, before first-admin setup, a bootstrap token there when safe to do so. It binds to loopback by default; `APP_HOST` and `APP_PORT` may be set for development. PBX network access is disabled by default through `APP_PBX_NETWORK_MODE=disabled`; the explicit `plain_tcp` mode enables the current Asterisk runtime on a trusted/protected path. Normalized telephony event monitoring and internal state reconstruction exist; telephony state is not yet exposed through a browser-facing REST/realtime API.

The backend uses Node's built-in HTTP server and JSON-line application logs. Zod 4.6.5 validates application settings before the server listens. Root typecheck, test, and build scripts build the shared contract workspace before the backend. React/Vite provide the frontend bootstrap. TypeScript uses a strict root base config and workspace-specific configs. ESLint and Prettier are root dev dependencies. Node's built-in test runner tests the backend; Vitest checks bilingual rendering and uses development-only jsdom to exercise credential form clearing. The `shared` workspace holds provider-neutral TypeScript contracts; no provider implementation exists. The frontend development server proxies same-origin `/setup`, `/auth`, and `/api` requests to the local backend on port 3000 while preserving the browser Origin and Host for the existing CSRF check. Run the local backend with `APP_ENV=development`; production still requires HTTPS.

CI runs foundation and lockfile license checks, `npm ci --ignore-scripts`, lint, formatting, typechecks, tests, and both builds. It uses no production credentials or PBX access. Docker Compose remains service-free and Docker validation is deferred until actual image definitions exist.
