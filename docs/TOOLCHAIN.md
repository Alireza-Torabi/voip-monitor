# Development toolchain

Phase 2 Task 1 targets Node.js 24.21.0 and npm 11.19.0. `.node-version` pins the Node patch used for validation; `package.json` limits the supported major to Node 24. Use a trusted official Node distribution or an approved host package source. Do not install tooling on a legacy PBX.

The repository uses one npm workspace lockfile for `backend`, `frontend`, and `shared`. Install exact resolved packages from the repository root:

```sh
npm ci --ignore-scripts
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

`--ignore-scripts` was verified for this lockfile; it avoids install-time package scripts. Recheck it if dependencies change. The frontend development server is started with `npm run dev -w frontend`. The backend is built with `npm run build -w backend` and started with `npm run start -w backend`. Its only route is `GET /health`. It binds to loopback by default; `APP_HOST` and `APP_PORT` may be set for development. No PBX connection or monitoring data exists.

The backend uses Node's built-in HTTP server and JSON-line application logs. React/Vite provide the frontend bootstrap. TypeScript uses a strict root base config and workspace-specific configs. ESLint and Prettier are root dev dependencies. Node's built-in test runner tests the backend; Vitest renders the English and Persian frontend shell without a browser. The `shared` workspace currently has no domain code.

CI runs foundation and lockfile license checks, `npm ci --ignore-scripts`, lint, formatting, typechecks, tests, and both builds. It uses no production credentials or PBX access. Docker Compose remains service-free and Docker validation is deferred until actual image definitions exist.
