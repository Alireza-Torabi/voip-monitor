# Backend workspace

Minimal Node.js 24/TypeScript HTTP server with `GET /health`, JSON-line logs, and graceful signal shutdown. It does not connect to a PBX or store data.

From the repository root, run `npm run build`, `npm test`, and `npm run start -w backend`. The default bind is loopback on port 3000; `APP_HOST` and `APP_PORT` may be set for development. Authentication and application APIs are future work.
