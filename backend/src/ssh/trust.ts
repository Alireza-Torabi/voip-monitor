import { createHash, timingSafeEqual } from 'node:crypto';
import type { SshConfigRecord } from '../storage/index.js';
import { validateResolvedTarget } from '../network/policy.js';

export class SshTrustError extends Error {
  constructor(readonly code: 'INVALID_FINGERPRINT' | 'HOST_KEY_MISMATCH') {
    super(`SSH trust ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SshTrustError';
  }
}

export function parseSha256HostKeyFingerprint(fingerprint: string): Buffer {
  const match = /^SHA256:([A-Za-z0-9+/]{43})$/u.exec(fingerprint);
  const payload = match?.[1];
  if (!payload) throw new SshTrustError('INVALID_FINGERPRINT');

  const decoded = Buffer.from(payload, 'base64');
  const canonical = decoded.toString('base64').replace(/=+$/u, '');
  if (decoded.length !== 32 || canonical !== payload) {
    decoded.fill(0);
    throw new SshTrustError('INVALID_FINGERPRINT');
  }
  return decoded;
}

export function isValidSha256HostKeyFingerprint(fingerprint: string): boolean {
  let decoded: Buffer | undefined;
  try {
    decoded = parseSha256HostKeyFingerprint(fingerprint);
    return true;
  } catch {
    return false;
  } finally {
    decoded?.fill(0);
  }
}

/**
 * Verify an SSH server key against an administrator-pinned OpenSSH SHA256 fingerprint.
 * There is intentionally no trust-on-first-use or accept-new path.
 */
export function verifyPinnedSshHostKey(
  fingerprint: string,
  presentedPublicKeyBlob: Uint8Array,
): void {
  if (presentedPublicKeyBlob.length === 0) throw new SshTrustError('HOST_KEY_MISMATCH');

  const expected = parseSha256HostKeyFingerprint(fingerprint);
  const actual = createHash('sha256').update(presentedPublicKeyBlob).digest();
  try {
    if (!timingSafeEqual(expected, actual)) {
      throw new SshTrustError('HOST_KEY_MISMATCH');
    }
  } finally {
    expected.fill(0);
    actual.fill(0);
  }
}

/**
 * Reuse the application network boundary after one future DNS-resolution step.
 * This function performs no DNS lookup and opens no socket.
 */
export function validateSshResolvedTarget(
  config: Pick<SshConfigRecord, 'host'>,
  resolvedAddresses: readonly string[],
): string[] {
  return validateResolvedTarget(config.host, resolvedAddresses);
}
