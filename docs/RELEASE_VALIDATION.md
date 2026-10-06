# Release Validation

**Type:** Release validation procedure
**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-10-06
**Environment:** Isolated validation / production release candidate
**License:** Apache-2.0

## Purpose

Prove that VoIP Monitor can be deployed from a clean source snapshot without importing private runtime state from another installation.

## Automated fresh-deployment drill

Run with Node.js 24:

```sh
./scripts/validate-fresh-deployment.sh \
  --source-repo /path/to/voip-monitor \
  --source-index \
  --node-bin /path/to/node24/bin/node
```

The validator builds a temporary Git seed from the staged index, creates a real fresh clone from that seed, and verifies:

1. no `.local`, runtime database, key, environment file, or private artifact is present in the clone;
2. `npm ci --ignore-scripts` succeeds from the lockfile;
3. `npm audit --audit-level=high` reports no high/critical vulnerability;
4. production build, foundation and license gates pass;
5. an isolated self-signed TLS deployment starts with `APP_PBX_NETWORK_MODE=disabled`;
6. health and readiness pass;
7. first-administrator onboarding succeeds;
8. a synthetic PBX profile and encrypted AMI secret are stored without opening a PBX connection and without secret leakage;
9. a stopped-service recovery set is created;
10. the recovery set is restored into empty paths;
11. the restored application restarts, login still works, and PBX metadata/secret-presence state survives.

All runtime files are created under a temporary directory and removed at exit.

## Current Task 50 evidence

On 2026-10-06 the staged-index fresh-deployment drill passed end-to-end with Node.js 24.21.0/npm 11.19.0. A transitive `source-map-js` advisory was discovered during the first clean install; the lockfile was updated from 1.2.1 to patched 1.2.2 and the repeated clean-clone audit reported zero vulnerabilities.

No real PBX, external source database, production credential, or existing runtime data was used by the automated drill.

## Physical reboot gate

The automated drill intentionally does not reboot the validation host. A physical reboot is a separate operational gate because a reboot of a service configured with PBX networking enabled can reconnect to a real PBX.

Task 50 is not complete until the current release's boot recovery is proven under an explicitly approved PBX-network state. Acceptable evidence is:

- reboot a host with `APP_PBX_NETWORK_MODE=disabled`, then verify enabled/active systemd state plus HTTPS health/readiness and login; or
- explicitly approve read-only PBX reconnection during the reboot gate and verify the same boot/service checks.

Do not silently reboot a host whose current configuration would reconnect to a PBX.

## Release acceptance

A release candidate is accepted only when:

- full repository gates pass;
- the fresh-deployment drill passes from the staged release source;
- npm audit reports no high/critical vulnerability;
- systemd unit validation passes;
- physical reboot recovery is explicitly proven;
- secret/public-repository review passes;
- no private deployment value is present in tracked content.

## 2026-10-06 reboot evidence

The current host was rebooted with explicit approval for its existing read-only `plain_tcp` reconnect. The first reboot exposed deployment drift: the installed systemd unit was older than the merged hardened unit. The merged unit was installed and matched against the tracked file, then a second controlled reboot was performed.

After the second boot the service was enabled and active, the installed unit matched the tracked release unit, HTTPS `/health` and `/ready` both returned 200, unauthenticated access to the protected PBX API remained rejected, and the existing AMI transport re-established one TCP session to port 5038. No additional PBX command or probe was sent by the validation workflow.
