# Real PBX Compatibility Verification

**Type:** Runbook
**Version:** 0.1.0
**Status:** Active
**Last Updated:** 2026-09-25
**Environment:** Controlled validation only
**Audience:** VoIP and platform administrators
**License:** Apache-2.0

## Purpose

Validate the Asterisk provider against an explicitly approved real PBX without placing deployment secrets or topology in Git.

This verification is intentionally read-only from a call-control perspective. It logs in to AMI, reads core settings, requests the active-channel list, observes AMI events for a bounded window, requests a reconciliation snapshot, and logs off. It does not originate, redirect, hang up, reload, write configuration, or execute CLI commands.

## Preconditions

- The target PBX and test window are explicitly approved.
- Network access from the monitoring host to the AMI listener is permitted.
- AMI is reachable only through a trusted/private or otherwise protected path.
- A dedicated AMI account is preferred.
- The account must run the read-only actions used by the verifier and receive the required call events.
- The repository has been built with the supported Node.js toolchain.

For Asterisk 13, source registration shows `CoreSettings` and `CoreShowChannels` under the `system`/`reporting` manager action classes, while channel-list and normal call lifecycle events are in the `call` event class. Asterisk action authorization is checked against the manager user's write-permission mask even for read-only query actions. Therefore a narrowly scoped validation account may require `write = system,reporting` and `read = call`. Confirm the exact policy on the target PBX; do not grant broader permissions merely for convenience.

References:

- Asterisk 13 manager source: https://github.com/asterisk/asterisk/blob/13/main/manager.c
- AMI v2 specification: https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/

## Local credential preparation

Do not put a real password on the command line, in an environment file tracked by Git, in a ticket, or in this repository.

From the repository root, run:

```sh
./scripts/setup-real-pbx-verification.sh
```

The helper prompts interactively and writes only to:

```text
.local/real-pbx-verification/config.json
.local/real-pbx-verification/ami-password
```

The directory is mode 0700 and the files are mode 0600. The AMI password is entered with terminal echo disabled. The helper refuses to run if the local verification path is not ignored by Git.

## Verification procedure

Build the current source first:

```sh
npm ci --ignore-scripts
npm run build
```

Run a short compatibility observation:

```sh
node scripts/verify-real-pbx-compatibility.mjs --observe-seconds 60
```

During the observation window, an operator may place one normal test call through the PBX. The verifier itself never originates or modifies calls.

The detailed result is stored only in ignored local storage:

```text
.local/real-pbx-verification/last-result.json
```

Console output reports only a safe PASS/FAIL summary.

## Pass criteria

A compatibility pass requires all of the following:

1. AMI login succeeds.
2. `CoreSettings` discovery succeeds.
3. `CoreShowChannels` returns a complete, internally consistent event list.
4. A second channel snapshot succeeds after the observation window.
5. The provider remains connected or recovers without unsafe reconnect behavior.
6. If a normal test call is placed, expected normalized call/channel events are observed where the target Asterisk version emits them.
7. No raw credential, host, username, channel identity, or call detail is written to Git or CI.

A successful probe validates compatibility only for the tested PBX/version/path. It does not by itself make the application production-ready.

## Failure handling and rollback

- Stop after a failed probe; do not broaden AMI permissions blindly.
- Review only the safe error code first.
- Keep detailed local results under `.local/`.
- If a PBX-side change is proposed, document the exact change, risk, verification, and rollback before applying it.
- The verifier performs no persistent PBX change. Rollback on the monitoring host is simply to stop the probe and remove the local verification files when no longer needed.

```sh
rm -rf .local/real-pbx-verification
```

## Security notes

Never commit the local config, password file, detailed result, packet capture, raw AMI transcript, screenshots containing deployment values, or production database/key material. CI must remain synthetic and must never contact a real PBX.
