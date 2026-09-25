#!/usr/bin/env bash

# ============================================================
# Name: setup-real-pbx-verification.sh
# Description: Store real PBX compatibility-test inputs under ignored local storage without exposing the AMI password in shell history.
# Version: 0.1.0
# Updated: 2026-09-25
# Requirements: bash, chmod, git
# Usage: ./scripts/setup-real-pbx-verification.sh
# License: Apache-2.0
# ============================================================

set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local/real-pbx-verification"
CONFIG_FILE="${LOCAL_DIR}/config.json"
PASSWORD_FILE="${LOCAL_DIR}/ami-password"

if ! git -C "${ROOT_DIR}" check-ignore -q ".local/real-pbx-verification/config.json"; then
  printf '%s\n' "Refusing to continue: .local verification files are not ignored by Git." >&2
  exit 1
fi

mkdir -p "${LOCAL_DIR}"
chmod 700 "${LOCAL_DIR}"
read -r -p "PBX host or IP: " PBX_HOST
read -r -p "AMI port [5038]: " AMI_PORT
AMI_PORT="${AMI_PORT:-5038}"
read -r -p "AMI username: " AMI_USERNAME
read -r -s -p "AMI password: " AMI_PASSWORD
printf '\n'

if [[ -z "${PBX_HOST}" || ! "${PBX_HOST}" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  printf '%s\n' "Invalid PBX host or IP." >&2
  exit 1
fi
if [[ ! "${AMI_PORT}" =~ ^[0-9]+$ ]] || (( AMI_PORT < 1 || AMI_PORT > 65535 )); then
  printf '%s\n' "Invalid AMI port." >&2
  exit 1
fi
if [[ -z "${AMI_USERNAME}" || ! "${AMI_USERNAME}" =~ ^[A-Za-z0-9_.@-]+$ ]]; then
  printf '%s\n' "Invalid AMI username." >&2
  exit 1
fi
if [[ -z "${AMI_PASSWORD}" ]]; then
  printf '%s\n' "AMI password must not be empty." >&2
  exit 1
fi
printf '%s' "${AMI_PASSWORD}" > "${PASSWORD_FILE}"
unset AMI_PASSWORD
chmod 600 "${PASSWORD_FILE}"

cat > "${CONFIG_FILE}" <<JSON
{
  "host": "${PBX_HOST}",
  "port": ${AMI_PORT},
  "username": "${AMI_USERNAME}",
  "passwordFile": "ami-password",
  "resultFile": "last-result.json"
}
JSON
chmod 600 "${CONFIG_FILE}"

printf '%s\n' "Local compatibility-verification inputs were stored under .local/real-pbx-verification/."
printf '%s\n' "No password was placed on the command line or written to Git."
