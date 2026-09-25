# VoIP Monitoring Platform

An Apache-2.0 public project for a separate-server VoIP/PBX monitor. Initial support targets Asterisk and FreePBX-based Asterisk. One controlled real Asterisk 13.x compatibility baseline has passed; broader release and feature coverage remains to be validated. PBX networking is disabled by default and production monitoring is not complete.

[فارسی](README.fa.md) · [Development setup](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md) · [Project plan](docs/MASTER_PLAN.md)

The current Phase 2 foundation has SQLite, protected secret storage, first-administrator setup, local login, server-side sessions, Asterisk provider runtime lifecycle, authenticated connection-test/discovery, normalized AMI events, authoritative channel snapshot/reconciliation support, and an internal deterministic channel/call state engine. The bilingual browser can manage Asterisk / FreePBX profiles with encrypted write-only AMI passwords and show safe provider status. PBX network access remains disabled by default; telephony state is not yet exposed through REST/WebSocket and the realtime dashboard is not implemented. It is not a production deployment. See [configuration](docs/CONFIGURATION.md) and [operations](docs/OPERATIONS.md) for the bootstrap flow.

Development uses Node.js 24.21.0 and npm:

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the frontend with `npm run dev -w frontend`. Build and start the backend with `npm run build -w backend` and `npm run start -w backend`. See the [toolchain guide](docs/TOOLCHAIN.md) for details.
