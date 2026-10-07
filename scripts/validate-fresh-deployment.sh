#!/usr/bin/env bash

# ============================================================
# Name: validate-fresh-deployment.sh
# Description: Validate a clean organization-neutral deployment without using existing runtime state.
# Version: 1.0.0
# Updated: 2026-10-06
# Requirements: bash, git, Node.js 24, npm, OpenSSL, curl, Python 3
# Usage: ./scripts/validate-fresh-deployment.sh [--source-repo PATH_OR_URL] [--ref REF] [--node-bin FILE]
# License: Apache-2.0
# ============================================================

set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_REPO="$ROOT_DIR"
SOURCE_REF="main"
SOURCE_INDEX="false"
NODE_BIN=""
WORK_DIR=""

usage() {
  echo "Usage: $0 [--source-repo PATH_OR_URL] [--ref REF] [--source-index] [--node-bin FILE]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-repo) SOURCE_REPO="$2"; shift 2 ;;
    --ref) SOURCE_REF="$2"; shift 2 ;;
    --source-index) SOURCE_INDEX="true"; shift ;;
    --node-bin) NODE_BIN="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node || true)"
fi
[[ -x "$NODE_BIN" ]] || { echo "Node.js executable not found." >&2; exit 1; }
[[ "$("$NODE_BIN" --version)" == v24.* ]] || { echo "Node.js 24 is required." >&2; exit 1; }
NPM_BIN="$(dirname "$NODE_BIN")/npm"
[[ -x "$NPM_BIN" ]] || { echo "npm was not found beside the selected Node.js runtime." >&2; exit 1; }

for command in git openssl curl python3; do
  command -v "$command" >/dev/null || { echo "Required command not found: $command" >&2; exit 1; }
done

WORK_DIR="$(mktemp -d -t voip-monitor-fresh-validation-XXXXXX)"
CLONE_DIR="$WORK_DIR/source"
DATA_DIR="$WORK_DIR/runtime-data"
SECRETS_DIR="$DATA_DIR/secrets"
RUNTIME_DIR="$WORK_DIR/runtime"
ENV_FILE="$WORK_DIR/voip-monitor.env"
TLS_DIR="$WORK_DIR/tls"
BACKUP_DIR="$WORK_DIR/recovery-set"
COOKIE_JAR="$WORK_DIR/cookies.txt"
ORIGINAL_DIR="$WORK_DIR/pre-restore"
LOG_FILE="$WORK_DIR/validator.log"

cleanup() {
  if [[ -d "$CLONE_DIR" && -x "$CLONE_DIR/scripts/run-production.sh" ]]; then
    VOIP_MONITOR_RUNTIME_DIR="$RUNTIME_DIR"     VOIP_MONITOR_ENV_FILE="$ENV_FILE"     VOIP_MONITOR_NODE_BIN="$NODE_BIN"       "$CLONE_DIR/scripts/run-production.sh" stop >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

echo "Cloning clean release source..."
if [[ "$SOURCE_INDEX" == "true" ]]; then
  [[ -d "$SOURCE_REPO/.git" ]] || { echo "--source-index requires a local Git working tree." >&2; exit 1; }
  SEED_DIR="$WORK_DIR/seed"
  mkdir -p "$SEED_DIR"
  TREE_ID="$(git -C "$SOURCE_REPO" write-tree)"
  git -C "$SOURCE_REPO" archive "$TREE_ID" | tar -x -C "$SEED_DIR"
  git -C "$SEED_DIR" init --quiet
  git -C "$SEED_DIR" add .
  git -C "$SEED_DIR" -c user.name='Release Validator' -c user.email='validator@example.invalid' commit --quiet -m 'validation seed'
  git clone --quiet --no-local "$SEED_DIR" "$CLONE_DIR"
else
  git clone --quiet --no-local --single-branch --branch "$SOURCE_REF" "$SOURCE_REPO" "$CLONE_DIR"
fi
[[ -z "$(git -C "$CLONE_DIR" status --porcelain)" ]] || { echo "Fresh clone is not clean." >&2; exit 1; }

for forbidden in .local runtime data secrets .env; do
  [[ ! -e "$CLONE_DIR/$forbidden" ]] || { echo "Fresh clone contains forbidden runtime path: $forbidden" >&2; exit 1; }
done
if find "$CLONE_DIR" -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.key' -o -name '*.pem' -o -name '*.p12' -o -name '*.pfx' \) -print -quit | grep -q .; then
  echo "Fresh clone contains a forbidden runtime artifact." >&2
  exit 1
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"
echo "Installing dependencies from lockfile..."
(
  cd "$CLONE_DIR"
  "$NPM_BIN" ci --ignore-scripts
  "$NPM_BIN" audit --audit-level=high
  "$NPM_BIN" run build:production
  GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$CLONE_DIR" python3 scripts/check_foundation.py
  python3 scripts/check_licenses.py
)

mkdir -p "$DATA_DIR" "$SECRETS_DIR" "$RUNTIME_DIR" "$TLS_DIR"
chmod 700 "$DATA_DIR" "$SECRETS_DIR" "$RUNTIME_DIR" "$TLS_DIR"

BACKEND_PORT="$("$NODE_BIN" -e "const n=require('node:net');const s=n.createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});")"
HTTPS_PORT="$("$NODE_BIN" -e "const n=require('node:net');const s=n.createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});")"

openssl req -x509 -newkey rsa:2048 -nodes -days 1   -subj '/CN=127.0.0.1'   -keyout "$TLS_DIR/server.key"   -out "$TLS_DIR/server.crt" >/dev/null 2>&1
chmod 600 "$TLS_DIR/server.key"
chmod 644 "$TLS_DIR/server.crt"

cat >"$ENV_FILE" <<EOF
DATA_PATH=$DATA_DIR
APP_SECRET_DIR=$SECRETS_DIR
APP_DATABASE_PATH=$DATA_DIR/monitor.sqlite3
APP_LOG_LEVEL=error
APP_PBX_NETWORK_MODE=disabled
VOIP_MONITOR_BACKEND_HOST=127.0.0.1
VOIP_MONITOR_BACKEND_PORT=$BACKEND_PORT
VOIP_MONITOR_HTTPS_HOST=127.0.0.1
VOIP_MONITOR_HTTPS_PORT=$HTTPS_PORT
VOIP_MONITOR_FRONTEND_DIR=$CLONE_DIR/frontend/dist
VOIP_MONITOR_TLS_CERT=$TLS_DIR/server.crt
VOIP_MONITOR_TLS_KEY=$TLS_DIR/server.key
EOF
chmod 600 "$ENV_FILE"

start_stack() {
  VOIP_MONITOR_RUNTIME_DIR="$RUNTIME_DIR"   VOIP_MONITOR_ENV_FILE="$ENV_FILE"   VOIP_MONITOR_NODE_BIN="$NODE_BIN"     "$CLONE_DIR/scripts/run-production.sh" start >>"$LOG_FILE" 2>&1

  for _ in $(seq 1 80); do
    if curl -kfsS "https://127.0.0.1:$HTTPS_PORT/health" >/dev/null 2>&1 &&
       curl -kfsS "https://127.0.0.1:$HTTPS_PORT/ready" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  echo "Fresh deployment did not become healthy and ready." >&2
  cat "$LOG_FILE" >&2 || true
  return 1
}

stop_stack() {
  VOIP_MONITOR_RUNTIME_DIR="$RUNTIME_DIR"   VOIP_MONITOR_ENV_FILE="$ENV_FILE"   VOIP_MONITOR_NODE_BIN="$NODE_BIN"     "$CLONE_DIR/scripts/run-production.sh" stop >>"$LOG_FILE" 2>&1
}

echo "Starting isolated production launcher..."
start_stack

BOOTSTRAP_TOKEN="$(tr -d '\r\n' <"$SECRETS_DIR/bootstrap-admin.token")"
[[ -n "$BOOTSTRAP_TOKEN" ]] || { echo "Bootstrap token was not created." >&2; exit 1; }

SETUP_PAYLOAD="$WORK_DIR/setup.json"
python3 - "$BOOTSTRAP_TOKEN" >"$SETUP_PAYLOAD" <<'PY'
import json, sys
print(json.dumps({
    "username": "release-admin",
    "password": "synthetic release admin passphrase 2026",
    "bootstrapToken": sys.argv[1],
}))
PY

status="$(curl -ksS -o "$WORK_DIR/setup-response.json" -w '%{http_code}'   -H "Origin: https://127.0.0.1:$HTTPS_PORT"   -H 'Content-Type: application/json'   --data-binary "@$SETUP_PAYLOAD"   "https://127.0.0.1:$HTTPS_PORT/setup/admin")"
[[ "$status" == "201" ]] || { echo "First-admin setup failed with HTTP $status." >&2; exit 1; }

LOGIN_PAYLOAD="$WORK_DIR/login.json"
python3 >"$LOGIN_PAYLOAD" <<'PY'
import json
print(json.dumps({
    "username": "release-admin",
    "password": "synthetic release admin passphrase 2026",
}))
PY
status="$(curl -ksS -c "$COOKIE_JAR" -o "$WORK_DIR/login-response.json" -w '%{http_code}'   -H "Origin: https://127.0.0.1:$HTTPS_PORT"   -H 'Content-Type: application/json'   --data-binary "@$LOGIN_PAYLOAD"   "https://127.0.0.1:$HTTPS_PORT/auth/login")"
[[ "$status" == "200" ]] || { echo "Fresh administrator login failed with HTTP $status." >&2; exit 1; }

PBX_PAYLOAD="$WORK_DIR/pbx.json"
python3 >"$PBX_PAYLOAD" <<'PY'
import json
print(json.dumps({
    "displayName": "Synthetic Release PBX",
    "providerType": "ASTERISK",
    "enabled": True,
    "amiHost": "pbx.example.test",
    "amiPort": 5038,
    "amiUsername": "synthetic-release-user",
    "amiPassword": "synthetic-release-secret",
}))
PY
status="$(curl -ksS -b "$COOKIE_JAR" -o "$WORK_DIR/pbx-response.json" -w '%{http_code}'   -H "Origin: https://127.0.0.1:$HTTPS_PORT"   -H 'Content-Type: application/json'   --data-binary "@$PBX_PAYLOAD"   "https://127.0.0.1:$HTTPS_PORT/api/pbx-instances")"
[[ "$status" == "201" ]] || { echo "Synthetic PBX onboarding failed with HTTP $status." >&2; exit 1; }
if grep -q 'synthetic-release-secret' "$WORK_DIR/pbx-response.json"; then
  echo "PBX secret leaked through onboarding response." >&2
  exit 1
fi
grep -q '"hasAmiPassword":true' "$WORK_DIR/pbx-response.json" || { echo "PBX secret presence flag missing." >&2; exit 1; }

echo "Stopping deployment for coordinated recovery set..."
stop_stack

APPLICATION_REF="$(git -C "$CLONE_DIR" rev-parse HEAD)"
"$CLONE_DIR/scripts/backup-production.sh"   --database "$DATA_DIR/monitor.sqlite3"   --master-key "$SECRETS_DIR/master.key"   --env-file "$ENV_FILE"   --tls-cert "$TLS_DIR/server.crt"   --tls-key "$TLS_DIR/server.key"   --destination "$BACKUP_DIR"   --application-ref "$APPLICATION_REF"   --confirm-stopped >/dev/null

mkdir -p "$ORIGINAL_DIR"
mv "$DATA_DIR" "$ORIGINAL_DIR/data"
mv "$ENV_FILE" "$ORIGINAL_DIR/voip-monitor.env"
mv "$TLS_DIR" "$ORIGINAL_DIR/tls"

mkdir -p "$TLS_DIR"
"$CLONE_DIR/scripts/restore-production.sh"   --backup-dir "$BACKUP_DIR"   --database "$DATA_DIR/monitor.sqlite3"   --master-key "$SECRETS_DIR/master.key"   --env-file "$ENV_FILE"   --tls-cert "$TLS_DIR/server.crt"   --tls-key "$TLS_DIR/server.key"   --confirm-stopped >/dev/null

echo "Starting restored deployment to validate restart recovery..."
start_stack
status="$(curl -ksS -c "$COOKIE_JAR" -o "$WORK_DIR/relogin-response.json" -w '%{http_code}'   -H "Origin: https://127.0.0.1:$HTTPS_PORT"   -H 'Content-Type: application/json'   --data-binary "@$LOGIN_PAYLOAD"   "https://127.0.0.1:$HTTPS_PORT/auth/login")"
[[ "$status" == "200" ]] || { echo "Login failed after restore/restart with HTTP $status." >&2; exit 1; }

curl -kfsS -b "$COOKIE_JAR" "https://127.0.0.1:$HTTPS_PORT/api/pbx-instances" >"$WORK_DIR/pbx-list.json"
grep -q 'Synthetic Release PBX' "$WORK_DIR/pbx-list.json" || { echo "PBX metadata was not recovered." >&2; exit 1; }
if grep -q 'synthetic-release-secret' "$WORK_DIR/pbx-list.json"; then
  echo "PBX secret leaked after restore." >&2
  exit 1
fi

stop_stack

echo "Fresh deployment validation passed."
echo "Validated: clean clone, lockfile install, build, foundation/license gates, isolated TLS startup, health/readiness, first-admin onboarding, synthetic PBX metadata/secret storage with PBX networking disabled, stopped-service backup, checksum-validated restore, and restart recovery."
echo "A physical host reboot is not performed by this validator; boot integration remains verified separately by the tracked enabled systemd unit and the prior controlled reboot gate."
