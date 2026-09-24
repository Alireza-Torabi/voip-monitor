# Backend workspace

Node.js 24/TypeScript HTTP server with `GET /health` and `GET /ready`, JSON-line logs, SQLite storage, encrypted local PBX secret records, and graceful signal shutdown. It does not connect to a PBX. Startup requires a writable configured database path and an owner-controlled secret directory for the separate master key.

From the repository root, run `npm run build`, `npm test`, and `npm run start -w backend`. The default bind is loopback on port 3000; `APP_HOST` and `APP_PORT` may be set for development. Authentication and application APIs are future work.
