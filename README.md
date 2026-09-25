# VoIP Monitoring Platform

An Apache-2.0 public project for a separate-server VoIP/PBX monitor. Initial planned support is Asterisk and FreePBX-based Asterisk, with Asterisk 13.x compatibility to verify. Asterisk provider transport and runtime foundations now exist, but PBX networking is disabled by default and production monitoring is not complete.

[فارسی](README.fa.md) · [Development setup](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md) · [Project plan](docs/MASTER_PLAN.md)

The current Phase 2 foundation has SQLite, protected secret storage, first-administrator setup, local login, server-side sessions, Asterisk provider runtime lifecycle, authenticated connection-test/discovery, normalized AMI events, and synthetic channel snapshot/reconciliation support. The bilingual browser can manage Asterisk / FreePBX profiles with encrypted write-only AMI passwords and show safe provider status. PBX network access remains disabled by default; a reliable telephony state engine and realtime dashboard delivery are not implemented. It is not a production deployment. See [configuration](docs/CONFIGURATION.md) and [operations](docs/OPERATIONS.md) for the bootstrap flow.

Development uses Node.js 24.21.0 and npm:

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the frontend with `npm run dev -w frontend`. Build and start the backend with `npm run build -w backend` and `npm run start -w backend`. See the [toolchain guide](docs/TOOLCHAIN.md) for details.
