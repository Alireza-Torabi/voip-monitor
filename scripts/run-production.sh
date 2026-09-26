#!/usr/bin/env bash

# ============================================================
# Name: run-production.sh
# Description: Start, stop, or inspect the local VoIP Monitor production deployment.
# Version: 1.0.0
# Updated: 2026-09-26
# Requirements: bash, Node.js 24 toolchain, built workspace, TLS certificate/key
# Usage: ./scripts/run-production.sh {start|stop|status|run}
# License: Apache-2.0
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${VOIP_MONITOR_RUNTIME_DIR:-$ROOT_DIR/.local/deployment}"
PID_FILE="$RUNTIME_DIR/production.pid"
LOG_FILE="$RUNTIME_DIR/production.log"
ENV_FILE="${VOIP_MONITOR_ENV_FILE:-$RUNTIME_DIR/production.env}"

node_bin() {
  find "$ROOT_DIR/.local/toolchain" -type f -name node -perm -u+x 2>/dev/null | head -n 1
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Deployment environment file is missing: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

run_stack() {
  load_env
  local node
  node="$(node_bin)"
  if [[ -z "$node" ]]; then
    echo "Node.js 24 toolchain was not found under .local/toolchain." >&2
    exit 1
  fi
  export PATH="$(dirname "$node"):$PATH"
  export APP_ENV=production
  export APP_HOST="${VOIP_MONITOR_BACKEND_HOST:-127.0.0.1}"
  export APP_PORT="${VOIP_MONITOR_BACKEND_PORT:-3000}"
  export APP_PBX_NETWORK_MODE="${APP_PBX_NETWORK_MODE:-disabled}"

  "$node" "$ROOT_DIR/backend/dist/index.js" &
  backend_pid=$!

  cleanup() {
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  healthy=0
  for _ in $(seq 1 50); do
    if curl -fsS "http://${APP_HOST}:${APP_PORT}/health" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    if ! kill -0 "$backend_pid" 2>/dev/null; then
      echo "Backend exited before becoming healthy." >&2
      exit 1
    fi
    sleep 0.1
  done
  if [[ "$healthy" -ne 1 ]]; then
    echo "Backend did not become healthy." >&2
    exit 1
  fi

  "$node" "$ROOT_DIR/scripts/production-gateway.mjs"
}

case "${1:-}" in
  start)
    mkdir -p "$RUNTIME_DIR"
    chmod 700 "$RUNTIME_DIR"
    if running; then
      echo "VoIP Monitor is already running with PID $(cat "$PID_FILE")."
      exit 0
    fi
    nohup setsid "$0" run >>"$LOG_FILE" 2>&1 &
    pid=$!
    echo "$pid" >"$PID_FILE"
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "VoIP Monitor failed to start. Check $LOG_FILE." >&2
      rm -f "$PID_FILE"
      exit 1
    fi
    echo "VoIP Monitor started with PID $pid."
    ;;
  stop)
    if ! running; then
      rm -f "$PID_FILE"
      echo "VoIP Monitor is not running."
      exit 0
    fi
    pid="$(cat "$PID_FILE")"
    kill -TERM -- "-$pid" 2>/dev/null || true
    for _ in $(seq 1 50); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "VoIP Monitor stopped."
    ;;
  status)
    if running; then
      echo "VoIP Monitor is running with PID $(cat "$PID_FILE")."
    else
      echo "VoIP Monitor is not running."
      exit 1
    fi
    ;;
  run)
    run_stack
    ;;
  *)
    echo "Usage: $0 {start|stop|status|run}" >&2
    exit 2
    ;;
esac
