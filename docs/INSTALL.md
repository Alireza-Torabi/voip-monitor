# Installation status and planned procedure

**Status:** Phase 1 foundation only. There is no installable monitoring application, Docker image, first-run wizard, or supported production deployment yet. Do not point this repository at a PBX.

## Planned architecture and compatibility

The monitor will run on a separate Linux server or VM, outside the PBX call path. Initial target: Asterisk and FreePBX-based Asterisk, with Asterisk 13.x compatibility to verify. The monitoring host target is a supported Linux distribution; No deployment host matrix has been tested.

## Prerequisites to validate before a release

Node.js 24 LTS is the planned development runtime. A supported Docker Engine and Docker Compose plugin will be required for the intended deployment. CPU, memory, disk, and supported host versions are not yet measured. Do not infer minimum hardware requirements from this planning scaffold.

## Planned operator sequence

1. Clone the public repository.
2. Configure an operator-owned persistent data directory outside the checkout.
3. Prepare read-only AMI access on the PBX and firewall rules that permit only the monitoring host to reach AMI. Exact settings must be validated against the PBX version and local policy.
4. Optionally prepare restricted SSH access for system metrics and log reading.
5. Start the Compose deployment after the application services and images exist.
6. Open the HTTPS URL, create the first local administrator, add a PBX, test read-only connectivity, review discovery, confirm, and start monitoring.

No command in this document currently performs installation because services do not exist.

## Data, secrets, and logs

The proposed backend mount is `/data`, backed by an operator-selected host path. The future SQLite file is `/data/monitor.sqlite3`; encrypted credentials are database rows; the separate master key is `/data/secrets/master.key`. All are outside Git. Container logs will use standard output with deployment-managed retention. These paths are design targets, not files created by Phase 1.

## Backup, restore, upgrade, rollback, uninstall

Back up the database, encrypted credentials, and master key as one recoverable set. Encrypted credentials may be unrecoverable without the key. A tested backup/restore procedure, schema migration process, upgrade/rollback commands, log locations, health checks, and uninstall steps remain blocked until the application and Compose services exist. Do not claim recovery readiness before a restore test. See [Operations](OPERATIONS.md) and [Troubleshooting](TROUBLESHOOTING.md).
