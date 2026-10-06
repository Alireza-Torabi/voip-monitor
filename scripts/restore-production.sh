#!/usr/bin/env bash

# ============================================================
# Name: restore-production.sh
# Description: Validate and restore a stopped-service VoIP Monitor recovery set.
# Version: 1.0.0
# Updated: 2026-10-06
# Requirements: bash, coreutils
# Usage: ./scripts/restore-production.sh --backup-dir DIR --database FILE --master-key FILE --env-file FILE --confirm-stopped [--tls-cert FILE --tls-key FILE] [--allow-overwrite]
# License: Apache-2.0
# ============================================================

set -euo pipefail
umask 077

BACKUP_DIR=""
DATABASE=""
MASTER_KEY=""
ENV_FILE=""
TLS_CERT=""
TLS_KEY=""
CONFIRM_STOPPED="false"
ALLOW_OVERWRITE="false"

usage() {
  echo "Usage: $0 --backup-dir DIR --database FILE --master-key FILE --env-file FILE --confirm-stopped [--tls-cert FILE --tls-key FILE] [--allow-overwrite]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --database) DATABASE="$2"; shift 2 ;;
    --master-key) MASTER_KEY="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --tls-cert) TLS_CERT="$2"; shift 2 ;;
    --tls-key) TLS_KEY="$2"; shift 2 ;;
    --confirm-stopped) CONFIRM_STOPPED="true"; shift ;;
    --allow-overwrite) ALLOW_OVERWRITE="true"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

for value in "$BACKUP_DIR" "$DATABASE" "$MASTER_KEY" "$ENV_FILE"; do
  [[ -n "$value" ]] || { usage >&2; exit 2; }
done
[[ "$CONFIRM_STOPPED" == "true" ]] || { echo "Refusing restore without --confirm-stopped." >&2; exit 1; }
[[ -d "$BACKUP_DIR" ]] || { echo "Backup directory does not exist." >&2; exit 1; }
for file in monitor.sqlite3 master.key voip-monitor.env manifest.txt SHA256SUMS; do
  [[ -f "$BACKUP_DIR/$file" ]] || { echo "Backup is missing required file: $file" >&2; exit 1; }
done
grep -qx 'format=voip-monitor-backup-v1' "$BACKUP_DIR/manifest.txt" || { echo "Unsupported backup format." >&2; exit 1; }
[[ "$(wc -c <"$BACKUP_DIR/master.key")" -eq 32 ]] || { echo "Backup master key must be exactly 32 bytes." >&2; exit 1; }
expected_sqlite_header="53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00"
actual_sqlite_header="$(od -An -tx1 -N16 "$BACKUP_DIR/monitor.sqlite3" | tr -s ' ' | sed 's/^ //')"
[[ "$actual_sqlite_header" == "$expected_sqlite_header" ]] || { echo "Backup database is not a SQLite 3 database." >&2; exit 1; }
(
  cd "$BACKUP_DIR"
  sha256sum -c SHA256SUMS
)

if [[ -f "$BACKUP_DIR/server.crt" || -f "$BACKUP_DIR/server.key" ]]; then
  [[ -f "$BACKUP_DIR/server.crt" && -f "$BACKUP_DIR/server.key" ]] || { echo "Backup contains incomplete TLS material." >&2; exit 1; }
  [[ -n "$TLS_CERT" && -n "$TLS_KEY" ]] || { echo "TLS restore destinations are required for this backup." >&2; exit 1; }
elif [[ -n "$TLS_CERT" || -n "$TLS_KEY" ]]; then
  echo "TLS restore destinations were supplied but this backup has no TLS material." >&2
  exit 1
fi

if [[ "$ALLOW_OVERWRITE" != "true" ]]; then
  for path in "$DATABASE" "$MASTER_KEY" "$ENV_FILE" "$TLS_CERT" "$TLS_KEY"; do
    [[ -z "$path" || ! -e "$path" ]] || { echo "Restore destination already exists: $path" >&2; exit 1; }
  done
fi

install -d -m 0700 "$(dirname "$DATABASE")" "$(dirname "$MASTER_KEY")" "$(dirname "$ENV_FILE")"
install -m 0600 "$BACKUP_DIR/monitor.sqlite3" "$DATABASE"
install -m 0600 "$BACKUP_DIR/master.key" "$MASTER_KEY"
install -m 0600 "$BACKUP_DIR/voip-monitor.env" "$ENV_FILE"
if [[ -f "$BACKUP_DIR/server.crt" ]]; then
  install -d -m 0700 "$(dirname "$TLS_CERT")" "$(dirname "$TLS_KEY")"
  install -m 0600 "$BACKUP_DIR/server.crt" "$TLS_CERT"
  install -m 0600 "$BACKUP_DIR/server.key" "$TLS_KEY"
fi

echo "Restore completed from $BACKUP_DIR"
echo "Validate ownership, service account access, health, readiness, login, and encrypted credential usability before production use."
