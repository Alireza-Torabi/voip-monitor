import { isIP } from 'node:net';

export type NetworkBlockReason =
  | 'UNSPECIFIED'
  | 'LOOPBACK'
  | 'LINK_LOCAL'
  | 'MULTICAST'
  | 'BROADCAST'
  | 'METADATA_SERVICE'
  | 'INVALID_ADDRESS'
  | 'RESOLUTION_REQUIRED';

export interface NetworkBoundaryDecision {
  allowed: boolean;
  reason?: NetworkBlockReason;
}

export class NetworkBoundaryError extends Error {
  readonly reason: NetworkBlockReason;

  constructor(reason: NetworkBlockReason) {
    super(`PBX network target rejected: ${reason}`);
    this.name = 'NetworkBoundaryError';
    this.reason = reason;
  }
}

function parseIpv4(address: string): [number, number, number, number] | undefined {
  if (isIP(address) !== 4) return undefined;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4) return undefined;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}

function embeddedIpv4(address: string): string | undefined {
  const lower = address.toLowerCase();
  const prefix = '::ffff:';
  if (!lower.startsWith(prefix)) return undefined;
  const candidate = address.slice(prefix.length);
  return isIP(candidate) === 4 ? candidate : undefined;
}

export function classifyAddress(address: string): NetworkBoundaryDecision {
  const mapped = embeddedIpv4(address);
  if (mapped) return classifyAddress(mapped);

  const ipv4 = parseIpv4(address);
  if (ipv4) {
    const [a, b, c, d] = ipv4;
    if (a === 0) return { allowed: false, reason: 'UNSPECIFIED' };
    if (a === 127) return { allowed: false, reason: 'LOOPBACK' };
    if (a === 169 && b === 254) return { allowed: false, reason: 'LINK_LOCAL' };
    if (a >= 224 && a <= 239) return { allowed: false, reason: 'MULTICAST' };
    if (a === 255 && b === 255 && c === 255 && d === 255) {
      return { allowed: false, reason: 'BROADCAST' };
    }
    return { allowed: true };
  }

  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === 'fd00:ec2::254') return { allowed: false, reason: 'METADATA_SERVICE' };
    if (lower === '::') return { allowed: false, reason: 'UNSPECIFIED' };
    if (lower === '::1') return { allowed: false, reason: 'LOOPBACK' };
    const first = Number.parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xffc0) === 0xfe80) return { allowed: false, reason: 'LINK_LOCAL' };
    if ((first & 0xff00) === 0xff00) return { allowed: false, reason: 'MULTICAST' };
    return { allowed: true };
  }

  return { allowed: false, reason: 'INVALID_ADDRESS' };
}

/**
 * Validate a PBX target after one DNS resolution step.
 * Private RFC1918/ULA addresses are intentionally allowed because PBXs normally
 * live on private infrastructure. Loopback, link-local, multicast and
 * unspecified targets are rejected. Future real transports must connect to one
 * of the already-validated resolved addresses rather than resolving again.
 */
export function validateResolvedTarget(
  host: string,
  resolvedAddresses: readonly string[],
): string[] {
  const literalVersion = isIP(host);
  const candidates = literalVersion ? [host] : [...new Set(resolvedAddresses)];

  if (!literalVersion && candidates.length === 0) {
    throw new NetworkBoundaryError('RESOLUTION_REQUIRED');
  }

  for (const address of candidates) {
    const decision = classifyAddress(address);
    if (!decision.allowed) {
      throw new NetworkBoundaryError(decision.reason ?? 'INVALID_ADDRESS');
    }
  }

  return candidates;
}
