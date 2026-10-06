# Production Operations Runbook

**Type:** Runbook
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-10-06
**Environment:** Production / staging
**Audience:** System administrators and service operators
**License:** Apache-2.0

## Purpose

Operate, back up, restore, upgrade, validate, and recover VoIP Monitor without embedding organization-specific data in the public repository.

## Scope and safety boundary

VoIP Monitor is an observer and must remain outside the PBX call path. Keep `APP_PBX_NETWORK_MODE=disabled` unless read-only PBX network access was separately approved. Backup and restore operations do not require PBX access.

Runtime database, master key, environment file, TLS private key, credentials, hostnames, addresses, and organization-specific topology are private deployment state and must never be committed.

## Production paths

The tracked systemd unit and installer use these generic production locations:

- Application checkout: `/opt/voip-monitor`
- Runtime data: `/var/lib/voip-monitor`
- SQLite database: `/var/lib/voip-monitor/monitor.sqlite3`
- Master key: `/var/lib/voip-monitor/secrets/master.key`
- Environment file: `/etc/voip-monitor/voip-monitor.env`
- TLS certificate: `/etc/voip-monitor/tls/server.crt`
- TLS private key: `/etc/voip-monitor/tls/server.key`

Use equivalent organization-approved paths when the deployment differs.

## Hardening verification

The tracked service definition applies a restrictive umask, read-only system view, private temporary/device views, kernel/control-group/clock protections, hidden non-service processes, no privilege escalation, empty capability sets, namespace/SUID restrictions, native system-call architecture, and an address-family allowlist limited to Unix/IPv4/IPv6 sockets.

Before installation or upgrade:

```sh
systemd-analyze verify deployment/systemd/voip-monitor.service
systemd-analyze security --offline=yes deployment/systemd/voip-monitor.service
```

The Task 49 baseline measured an offline exposure level of `2.8 OK` on Ubuntu 24.04/systemd available on the development host. Treat the score as host/version dependent; the required result is a valid unit and an explicit review of any weakened directive.

Do not add aggressive syscall filters or `MemoryDenyWriteExecute` without runtime validation against the exact Node/OpenSSL/SSH stack.

## Pre-deployment gates

From a clean checkout with Node.js 24:

```sh
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

Do not deploy a dirty tree containing private deployment values.

## Backup

### Preconditions

1. Confirm the destination is private, access-controlled, and has sufficient free space.
2. Record the running Git commit/release.
3. Stop VoIP Monitor and confirm it is inactive.
4. Do not delete or rotate the master key before backup completes.

```sh
sudo systemctl stop voip-monitor
systemctl is-active voip-monitor
git -C /opt/voip-monitor rev-parse HEAD
```

Create a recovery set:

```sh
sudo /opt/voip-monitor/scripts/backup-production.sh \
  --database /var/lib/voip-monitor/monitor.sqlite3 \
  --master-key /var/lib/voip-monitor/secrets/master.key \
  --env-file /etc/voip-monitor/voip-monitor.env \
  --tls-cert /etc/voip-monitor/tls/server.crt \
  --tls-key /etc/voip-monitor/tls/server.key \
  --destination /secure/backup/location/voip-monitor-YYYYMMDD-HHMMSS \
  --application-ref <GIT_COMMIT_OR_RELEASE> \
  --confirm-stopped
```

The backup directory is created with mode `0700`; contained files use mode `0600`. It contains the database, matching master key, environment file, optional TLS material, metadata manifest, and SHA-256 checksums.

The script does **not** encrypt the backup. Store or transport the recovery set only through organization-approved encrypted storage.

Restart the service after the copy:

```sh
sudo systemctl start voip-monitor
systemctl is-active voip-monitor
```

## Restore drill

A recovery claim is valid only after a restore has been tested. Prefer an isolated VM/namespace/staging host and keep PBX network mode disabled.

Stop the target service, then restore into empty target paths:

```sh
sudo /opt/voip-monitor/scripts/restore-production.sh \
  --backup-dir /secure/backup/location/voip-monitor-YYYYMMDD-HHMMSS \
  --database /var/lib/voip-monitor/monitor.sqlite3 \
  --master-key /var/lib/voip-monitor/secrets/master.key \
  --env-file /etc/voip-monitor/voip-monitor.env \
  --tls-cert /etc/voip-monitor/tls/server.crt \
  --tls-key /etc/voip-monitor/tls/server.key \
  --confirm-stopped
```

The restore script verifies the backup format and every SHA-256 checksum before writing target files. It refuses to overwrite existing targets unless `--allow-overwrite` is explicitly supplied.

After restore, fix deployment ownership when required:

```sh
sudo chown -R voip-monitor:voip-monitor /var/lib/voip-monitor
sudo chown root:voip-monitor /etc/voip-monitor/voip-monitor.env
sudo chmod 0640 /etc/voip-monitor/voip-monitor.env
sudo chown root:root /etc/voip-monitor/tls/server.crt
sudo chown root:voip-monitor /etc/voip-monitor/tls/server.key
sudo chmod 0644 /etc/voip-monitor/tls/server.crt
sudo chmod 0640 /etc/voip-monitor/tls/server.key
```

Start with PBX networking disabled and verify:

```sh
sudo systemctl start voip-monitor
systemctl is-active voip-monitor
curl -k https://127.0.0.1:<HTTPS_PORT>/health
curl -k https://127.0.0.1:<HTTPS_PORT>/ready
```

Then verify login, PBX profiles, encrypted credential presence flags, dashboards/settings, and application state. Only after recovery is proven should separately approved PBX access be re-enabled.

## Upgrade

1. Run the full repository gates.
2. Take a stopped-service recovery set.
3. Record current and target commits.
4. Build the target commit from a clean checkout.
5. Install/restart the service.
6. Verify systemd state, HTTPS health/readiness, login, UI, and monitoring source states.
7. Keep the pre-upgrade recovery set until the rollback window closes.

Never blindly downgrade a database after migrations.

## Rollback

If the target release fails before an irreversible migration, restore the previous application commit and matching runtime state.

If a migration changed the database schema, stop the service and restore the matching pre-upgrade database **and master key** recovery set before starting the older application.

A database and master key are one recovery unit for encrypted credentials.

## Legacy monitoring-history cleanup decision

Task 48 stopped all new writes to:

- `system_metric_history`
- `security_event_history`
- `security_alert_history`

Task 49 does **not** drop these tables.

Destructive removal is allowed only after all of the following are true:

1. the in-memory history replacement has operated successfully in production for an agreed observation window;
2. no downstream reporting, backup, forensic, or operational process depends on the legacy tables;
3. a current production recovery set exists;
4. that recovery set has passed an isolated restore drill;
5. the cleanup migration is separately reviewed and explicitly approved.

Until then, the unused legacy tables are inert compatibility/rollback data. Do not manually delete their rows or alter migration history.

## Post-deployment verification

```sh
systemctl is-enabled voip-monitor
systemctl is-active voip-monitor
systemctl --no-pager --full status voip-monitor
curl -k https://127.0.0.1:<HTTPS_PORT>/health
curl -k https://127.0.0.1:<HTTPS_PORT>/ready
```

Also verify HTTPS trust policy, login, telephony synchronization, source-backed History behavior, system metrics, security monitoring, SSE reconnect, filesystem permissions, backup destination protection, and absence of private data from tracked Git files.

Perform a reboot recovery test for new or materially changed production hosts.

## Troubleshooting

If restore checksum verification fails, do not bypass it. Treat the recovery set as damaged or modified and use another verified backup.

If readiness fails after restore while health succeeds, inspect database/master-key ownership and pairing first. Never generate a replacement key over encrypted records.

If the systemd unit fails after hardening changes, compare the installed unit to the tracked unit and review journal output. Relax one directive only with a documented runtime reason and re-run `systemd-analyze verify`.

## References

- `docs/DEPLOYMENT_GUIDE.md`
- `docs/OPERATIONS.md`
- `deployment/systemd/voip-monitor.service`
- `scripts/backup-production.sh`
- `scripts/restore-production.sh`
