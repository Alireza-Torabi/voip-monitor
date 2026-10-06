#!/usr/bin/env bash

# ============================================================
# Name: backup-production.sh
# Description: Create a coordinated stopped-service VoIP Monitor recovery set.
# Version: 1.0.0
# Updated: 2026-10-06
# Requirements: bash, coreutils
# Usage: ./scripts/backup-production.sh --database FILE --master-key FILE --env-file FILE --destination DIR --application-ref REF --confirm-stopped [--tls-cert FILE --tls-key FILE]
# License: Apache-2.0
# ============================================================

set -euo pipefail
umask 077

DATABASE=""
MASTER_KEY=""
ENV_FILE=""
DESTINATION=""
APPLICATION_REF=""
TLS_CERT=""
TLS_KEY=""
CONFIRM_STOPPED="false"

usage() {
  echo "Usage: $0 --database FILE --master-key FILE --env-file FILE --destination DIR --application-ref REF --confirm-stopped [--tls-cert FILE --tls-key FILE]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database) DATABASE="$2"; shift 2 ;;
    --master-key) MASTER_KEY="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --destination) DESTINATION="$2"; shift 2 ;;
    --application-ref) APPLICATION_REF="$2"; shift 2 ;;
    --tls-cert) TLS_CERT="$2"; shift 2 ;;
    --tls-key) TLS_KEY="$2"; shift 2 ;;
    --confirm-stopped) CONFIRM_STOPPED="true"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

for value in "$DATABASE" "$MASTER_KEY" "$ENV_FILE" "$DESTINATION" "$APPLICATION_REF"; do
  [[ -n "$value" ]] || { usage >&2; exit 2; }
done
[[ "$CONFIRM_STOPPED" == "true" ]] || { echo "Refusing backup without --confirm-stopped." >&2; exit 1; }
[[ -f "$DATABASE" ]] || { echo "Database file does not exist." >&2; exit 1; }
[[ -f "$MASTER_KEY" ]] || { echo "Master key file does not exist." >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Environment file does not exist." >&2; exit 1; }
[[ "$APPLICATION_REF" =~ ^[A-Za-z0-9._/@:+-]{1,160}$ ]] || { echo "Application ref contains unsupported characters." >&2; exit 1; }
[[ "$(wc -c <"$MASTER_KEY")" -eq 32 ]] || { echo "Master key must be exactly 32 bytes." >&2; exit 1; }
expected_sqlite_header="53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00"
actual_sqlite_header="$(od -An -tx1 -N16 "$DATABASE" | tr -s ' ' | sed 's/^ //')"
[[ "$actual_sqlite_header" == "$expected_sqlite_header" ]] || { echo "Database file is not a SQLite 3 database." >&2; exit 1; }
[[ -z "$TLS_CERT" || -f "$TLS_CERT" ]] || { echo "TLS certificate does not exist." >&2; exit 1; }
[[ -z "$TLS_KEY" || -f "$TLS_KEY" ]] || { echo "TLS key does not exist." >&2; exit 1; }
if [[ -z "$TLS_CERT" && -n "$TLS_KEY" ]] || [[ -n "$TLS_CERT" && -z "$TLS_KEY" ]]; then
  echo "TLS certificate and key must be supplied together." >&2
  exit 1
fi
[[ ! -e "$DESTINATION" ]] || { echo "Backup destination already exists." >&2; exit 1; }

install -d -m 0700 "$DESTINATION"
install -m 0600 "$DATABASE" "$DESTINATION/monitor.sqlite3"
install -m 0600 "$MASTER_KEY" "$DESTINATION/master.key"
install -m 0600 "$ENV_FILE" "$DESTINATION/voip-monitor.env"
if [[ -n "$TLS_CERT" ]]; then
  install -m 0600 "$TLS_CERT" "$DESTINATION/server.crt"
  install -m 0600 "$TLS_KEY" "$DESTINATION/server.key"
fi

{
  printf 'format=voip-monitor-backup-v1\n'
  printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'application_ref=%s\n' "$APPLICATION_REF"
  printf 'tls_included=%s\n' "$([[ -n "$TLS_CERT" ]] && echo yes || echo no)"
} >"$DESTINATION/manifest.txt"
chmod 0600 "$DESTINATION/manifest.txt"

(
  cd "$DESTINATION"
  files=(monitor.sqlite3 master.key voip-monitor.env manifest.txt)
  if [[ -f server.crt ]]; then files+=(server.crt server.key); fi
  sha256sum "${files[@]}" >SHA256SUMS
)
chmod 0600 "$DESTINATION/SHA256SUMS"

echo "Backup recovery set created at $DESTINATION"
echo "Keep this directory encrypted and access-controlled according to organization policy."
