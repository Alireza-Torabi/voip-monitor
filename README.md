# VoIP Monitoring Platform

An Apache-2.0 public project for a separate-server VoIP/PBX monitor. Initial planned support is Asterisk and FreePBX-based Asterisk, with Asterisk 13.x compatibility to verify. No PBX integration exists yet.

[فارسی](README.fa.md) · [Development setup](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md) · [Project plan](docs/MASTER_PLAN.md)

The current Phase 2 foundation has SQLite, protected secret storage, first-administrator setup, local login, and server-side sessions. The React shell switches between English/LTR and Persian/RTL; setup UI and PBX monitoring are not implemented. It is not a production deployment. See [configuration](docs/CONFIGURATION.md) and [operations](docs/OPERATIONS.md) for the bootstrap flow.

Development uses Node.js 24.21.0 and npm:

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the frontend with `npm run dev -w frontend`. Build and start the backend with `npm run build -w backend` and `npm run start -w backend`. See the [toolchain guide](docs/TOOLCHAIN.md) for details.
