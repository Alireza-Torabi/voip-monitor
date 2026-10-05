# Deployment guide for a new organization

Purpose: deploy VoIP Monitor into a new company or environment without copying any data, credentials, topology, certificates, database, or assumptions from another deployment.

## Portability and isolation

Every deployment is organization-local. Never copy another installation's SQLite database, master key, bootstrap token, AMI/SSH credentials, hostnames/IPs, fingerprints, TLS keys, PBX profile IDs, monitoring history, logs, screenshots, packet captures, or `.local/` files. Tracked repository files are public and generic. Runtime facts belong outside Git.

A fresh clone must be deployable by supplying only the new organization's values at deployment time. No tracked default, test, example, document, migration, or source file may depend on the current lab/company environment.

## Deployment model

Run the monitor on a separate Linux host/VM outside the PBX call path. Monitor failure must never stop or alter calls. The current runtime target is Node.js 24 with a same-origin HTTPS gateway. Asterisk/FreePBX monitoring uses read-only AMI. System metrics optionally use a separate restricted SSH credential.

The current AMI transport is plain TCP and should be used only on a trusted/protected network path. `APP_PBX_NETWORK_MODE=disabled` is the safe default. `plain_tcp` is an explicit operator opt-in.

## Host preparation

Create a dedicated service account, private persistent data directory outside the Git checkout, private environment file outside Git, TLS key/certificate, and firewall/upstream rules suitable for the organization.

Generic environment example:

```text
APP_ENV=production
APP_HOST=127.0.0.1
APP_PORT=3000
APP_LOG_LEVEL=info
APP_PBX_NETWORK_MODE=disabled
DATA_PATH=/var/lib/voip-monitor/data
APP_SECRET_DIR=/var/lib/voip-monitor/data/secrets
APP_DATABASE_PATH=/var/lib/voip-monitor/data/monitor.sqlite3
VOIP_MONITOR_TLS_CERT=/etc/voip-monitor/tls/server.crt
VOIP_MONITOR_TLS_KEY=/etc/voip-monitor/tls/server.key
VOIP_MONITOR_HTTPS_PORT=8443
```

These are path examples only. Use organization-approved paths and ownership.

## Build and release gates

From a clean checkout:

```sh
export PATH=/path/to/node24/bin:$PATH
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
python3 scripts/check_foundation.py
python3 scripts/check_licenses.py
git status --short --branch
```

Do not deploy if tracked changes contain customer data or environment-specific values.

## Service installation

Use the repository production installer/runbook with the organization's Node/data/TLS paths. Do not bake real values into tracked files. Self-signed TLS is for controlled temporary deployments only; normal deployments should use a trusted certificate.

After installation verify:

```sh
systemctl is-enabled voip-monitor
systemctl is-active voip-monitor
curl -k https://127.0.0.1:<https-port>/health
curl -k https://127.0.0.1:<https-port>/ready
```

Perform one reboot test and repeat these checks.

## First administrator

On a fresh database, retrieve the generated bootstrap token only through trusted local server access. Use the browser setup flow to create the first administrator. Do not put the token in Git, tickets, chat logs, screenshots, or persistent environment variables.

There is no automatic password-recovery flow. Protect the administrator credential and back up the database plus master key as one recoverable set.

## PBX onboarding

For each PBX:

1. Create a read-only AMI account.
2. Restrict AMI network access to the monitor host or approved network path.
3. Add the PBX profile through the authenticated UI.
4. Keep network access disabled until approved.
5. Explicitly enable `APP_PBX_NETWORK_MODE=plain_tcp` only when approved.
6. Run the read-only connection verification.
7. Confirm provider status and normalized telephony state.

Never reuse another organization's PBX profile, secret, address, or profile ID.

## Optional restricted SSH system metrics

CPU, memory, filesystem, uptime, and service-state metrics do not come from AMI. They require an optional PBX-scoped restricted SSH configuration and credential.

The SSH collector activates only when the PBX profile exists and is enabled, PBX networking is explicitly allowed, PBX-scoped SSH metadata exists, an encrypted password/private-key credential exists, and the pinned SHA-256 host-key fingerprint matches.

Missing SSH configuration or credential is represented as `UNAVAILABLE`. It is not a zero metric and does not make application readiness fail.

The collector executes only the fixed read-only allowlist implemented by the repository: `/proc/stat`, `/proc/meminfo`, `df -P -B1`, `/proc/uptime`, and bounded `systemctl show` queries. Do not grant broader shell/admin privileges.

There is currently no public SSH-configuration UI/API. Until that management surface exists, provisioning must use an approved deployment-local administrative procedure and call the runtime synchronization seam after mutation. Never place SSH values in Git.

## Trunk visibility limitation

Current trunk discovery uses Asterisk `SIPshowregistry`, so it represents outbound SIP registrations. Static SIP peers, inbound-only definitions, and PJSIP trunks may not appear even when they exist on the PBX. An empty trunk list is not proof that the PBX has no trunks.

Broader trunk inventory requires a separately designed provider-neutral discovery task and compatibility tests. Do not add ad-hoc PBX actions to deployment scripts.

## Verification checklist

Verify health/readiness, HTTPS login, provider state, telephony synchronization, current calls/channels/queues/endpoints, security SSE reconnect, and system metrics. System metrics should be either `CURRENT` or explicitly `UNAVAILABLE` when SSH is not configured.

Confirm that no secret or real deployment fact appears in `git status`, tracked files, public logs, or screenshots intended for the public repository.

## Backup and restore

Back up together the SQLite database using a coordinated/stopped copy, the matching master key, deployment environment/service configuration, and TLS material according to organization policy. A database without its matching master key can make encrypted credentials unrecoverable.

Test restore in an isolated environment before claiming recovery readiness.

## Upgrade and rollback

Before upgrade: take a coordinated database + master-key backup, record the running release/commit and lockfile state, run all release gates, build from a clean checkout, deploy/restart, and verify health/readiness/UI/PBX state.

Rollback must restore a compatible application version and, when migrations require it, the matching pre-upgrade database backup. Never downgrade a migrated database blindly.

## Uninstall

Stop and disable the service, archive or securely destroy runtime data according to company policy, remove local TLS/environment/service files, and remove the checkout. Do not delete the master key before deciding whether backups must remain recoverable.
