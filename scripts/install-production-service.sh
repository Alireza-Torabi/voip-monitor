#!/usr/bin/env bash

# ============================================================
# Name: install-production-service.sh
# Description: Install the VoIP Monitor systemd service with trusted TLS and migrated local data.
# Version: 1.0.0
# Updated: 2026-09-26
# Requirements: root, systemd, OpenSSL, Node.js 24 source tree
# Usage: ./scripts/install-production-service.sh --node-source DIR --data-source DIR --tls-cert FILE --tls-key FILE [--allow-self-signed] [--https-port PORT] [--pbx-network-mode MODE]
# License: Apache-2.0
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_USER="voip-monitor"
SERVICE_GROUP="voip-monitor"
HTTPS_PORT="8443"
PBX_NETWORK_MODE="disabled"
NODE_SOURCE=""
DATA_SOURCE=""
TLS_CERT=""
TLS_KEY=""
ALLOW_SELF_SIGNED="false"

usage() {
  echo "Usage: $0 --node-source DIR --data-source DIR --tls-cert FILE --tls-key FILE [--allow-self-signed] [--https-port PORT] [--pbx-network-mode disabled|plain_tcp]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node-source) NODE_SOURCE="$2"; shift 2 ;;
    --data-source) DATA_SOURCE="$2"; shift 2 ;;
    --tls-cert) TLS_CERT="$2"; shift 2 ;;
    --tls-key) TLS_KEY="$2"; shift 2 ;;
    --allow-self-signed) ALLOW_SELF_SIGNED="true"; shift ;;
    --https-port) HTTPS_PORT="$2"; shift 2 ;;
    --pbx-network-mode) PBX_NETWORK_MODE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This installer must run as root." >&2
  exit 1
fi

for value in "$NODE_SOURCE" "$DATA_SOURCE" "$TLS_CERT" "$TLS_KEY"; do
  [[ -n "$value" ]] || { usage >&2; exit 2; }
done
[[ -x "$NODE_SOURCE/bin/node" ]] || { echo "Node source does not contain bin/node." >&2; exit 1; }
[[ -d "$DATA_SOURCE" ]] || { echo "Data source directory does not exist." >&2; exit 1; }
[[ -f "$TLS_CERT" && -f "$TLS_KEY" ]] || { echo "TLS certificate or key does not exist." >&2; exit 1; }
[[ "$PBX_NETWORK_MODE" == "disabled" || "$PBX_NETWORK_MODE" == "plain_tcp" ]] || { echo "Invalid PBX network mode." >&2; exit 1; }
[[ "$HTTPS_PORT" =~ ^[0-9]+$ ]] && (( HTTPS_PORT >= 1 && HTTPS_PORT <= 65535 )) || { echo "Invalid HTTPS port." >&2; exit 1; }
node_version="$("$NODE_SOURCE/bin/node" --version)"
[[ "$node_version" == v24.* ]] || { echo "Node.js 24 is required." >&2; exit 1; }

subject="$(openssl x509 -in "$TLS_CERT" -noout -subject -nameopt RFC2253 | sed 's/^subject=//')"
issuer="$(openssl x509 -in "$TLS_CERT" -noout -issuer -nameopt RFC2253 | sed 's/^issuer=//')"
if [[ "$subject" == "$issuer" && "$ALLOW_SELF_SIGNED" != "true" ]]; then
  echo "Self-signed TLS certificate detected. Re-run with --allow-self-signed only for a controlled temporary deployment." >&2
  exit 1
fi

cert_key="$(openssl x509 -in "$TLS_CERT" -pubkey -noout | openssl pkey -pubin -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
private_key="$(openssl pkey -in "$TLS_KEY" -pubout -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
[[ -n "$cert_key" && "$cert_key" == "$private_key" ]] || { echo "TLS certificate and private key do not match." >&2; exit 1; }

if pgrep -f "$ROOT_DIR/backend/dist/index.js" >/dev/null 2>&1; then
  echo "The existing VoIP Monitor backend is still running. Stop it before migrating data." >&2
  exit 1
fi

if ! getent group "$SERVICE_GROUP" >/dev/null; then
  groupadd --system "$SERVICE_GROUP"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_GROUP" --home-dir /var/lib/voip-monitor --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -m 0755 "$ROOT_DIR/runtime"
rm -rf "$ROOT_DIR/runtime/node.new"
cp -a "$NODE_SOURCE" "$ROOT_DIR/runtime/node.new"
rm -rf "$ROOT_DIR/runtime/node"
mv "$ROOT_DIR/runtime/node.new" "$ROOT_DIR/runtime/node"
chown -R root:root "$ROOT_DIR/runtime/node"
chmod -R a+rX "$ROOT_DIR/runtime/node"

install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" /var/lib/voip-monitor
cp -a "$DATA_SOURCE/." /var/lib/voip-monitor/
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/lib/voip-monitor

install -d -m 0750 -o root -g "$SERVICE_GROUP" /etc/voip-monitor/tls
install -m 0644 -o root -g root "$TLS_CERT" /etc/voip-monitor/tls/server.crt
install -m 0640 -o root -g "$SERVICE_GROUP" "$TLS_KEY" /etc/voip-monitor/tls/server.key

cat >/etc/voip-monitor/voip-monitor.env <<EOF
DATA_PATH=/var/lib/voip-monitor
APP_LOG_LEVEL=info
APP_PBX_NETWORK_MODE=$PBX_NETWORK_MODE
VOIP_MONITOR_BACKEND_HOST=127.0.0.1
VOIP_MONITOR_BACKEND_PORT=3000
VOIP_MONITOR_HTTPS_HOST=0.0.0.0
VOIP_MONITOR_HTTPS_PORT=$HTTPS_PORT
VOIP_MONITOR_FRONTEND_DIR=$ROOT_DIR/frontend/dist
VOIP_MONITOR_TLS_CERT=/etc/voip-monitor/tls/server.crt
VOIP_MONITOR_TLS_KEY=/etc/voip-monitor/tls/server.key
EOF
chown root:"$SERVICE_GROUP" /etc/voip-monitor/voip-monitor.env
chmod 0640 /etc/voip-monitor/voip-monitor.env

install -m 0644 "$ROOT_DIR/deployment/systemd/voip-monitor.service" /etc/systemd/system/voip-monitor.service
systemctl daemon-reload
systemctl enable --now voip-monitor.service
systemctl --no-pager --full status voip-monitor.service

echo "Systemd service installed. Validate HTTPS and firewall policy before rebooting."
