# Installation status and planned procedure

**Status:** The application foundation now includes onboarding, encrypted AMI credentials, provider runtime, read-only connection verification, normalized events, and synthetic channel snapshots. There is still no supported production deployment, Docker image, tested restore, or completed telephony state engine. Real PBX connectivity is allowed only as an explicitly approved controlled validation until the production runbook is complete.

## Planned architecture and compatibility

The monitor will run on a separate Linux server or VM, outside the PBX call path. Initial target: Asterisk and FreePBX-based Asterisk, with Asterisk 13.x compatibility to verify. The monitoring host target is a supported Linux distribution; No deployment host matrix has been tested.

## Prerequisites to validate before a release

Node.js 24 LTS is the planned development runtime. A supported Docker Engine and Docker Compose plugin will be required for the intended deployment. CPU, memory, disk, and supported host versions are not yet measured. Do not infer minimum hardware requirements from this planning scaffold.

## Deployment portability requirement

The public repository must stay reusable across organizations. A fresh deployment starts from the tracked source and generic instructions only; it must not copy another deployment's database, master key, credentials, hostnames, topology, or private `.local/` notes. Organization-specific values are entered during that deployment and remain in its runtime/secret storage outside Git. The production release must turn this planned sequence into a tested installation, verification, upgrade, backup/restore, rollback, and uninstall runbook.

## Planned operator sequence

1. Clone the public repository.
2. Configure an operator-owned persistent data directory outside the checkout.
3. Prepare read-only AMI access on the PBX and firewall rules that permit only the monitoring host to reach AMI. Exact settings must be validated against the PBX version and local policy.
4. Optionally prepare restricted SSH access for system metrics and log reading.
5. Start the Compose deployment after the application services and images exist.
6. Open the HTTPS URL, create the first local administrator, add a PBX, test read-only connectivity, review discovery, confirm, and start monitoring.

For local development only, install Node.js 24.21.0 and npm from a trusted source, then run from the repository root:

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev -w frontend
```

In another terminal, build and start the backend with `npm run build -w backend` and `npm run start -w backend`. `GET /health` returns `{"status":"ok"}` on the backend bind address. The backend defaults to loopback and port 3000; the frontend development server prints its local URL. These commands start only the skeleton, not monitoring. No Compose installation command exists because services do not yet exist.

## Data, secrets, and logs

The proposed backend mount is `/data`, backed by an operator-selected host path. The future SQLite file is `/data/monitor.sqlite3`; encrypted credentials are database rows; the separate master key is `/data/secrets/master.key`. All are outside Git. Container logs will use standard output with deployment-managed retention. These paths are design targets, not files created by Phase 1.

## Backup, restore, upgrade, rollback, uninstall

Back up the database, encrypted credentials, and master key as one recoverable set. Encrypted credentials may be unrecoverable without the key. A tested backup/restore procedure, schema migration process, upgrade/rollback commands, log locations, health checks, and uninstall steps remain blocked until the application and Compose services exist. Do not claim recovery readiness before a restore test. See [Operations](OPERATIONS.md) and [Troubleshooting](TROUBLESHOOTING.md).
