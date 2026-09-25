import type { PbxInstanceId, SecurityEvent, SecurityEventListener } from '@voip-monitor/shared';

export type SecurityEventCollectorErrorCode = 'COLLECTION_FAILED' | 'INVALID_EVENT';

export class SecurityEventCollectorError extends Error {
  constructor(readonly code: SecurityEventCollectorErrorCode) {
    super(`Security event collector ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SecurityEventCollectorError';
  }
}

/** Provider-neutral boundary for bounded security observations. */
export interface SecurityEventCollector {
  readonly source: 'AMI';
  subscribeEvents(listener: SecurityEventListener): () => void;
}

export function validateSecurityEvent(
  expectedInstanceId: PbxInstanceId,
  expectedSource: SecurityEventCollector['source'],
  event: SecurityEvent,
): void {
  if (!event || typeof event !== 'object') throw new SecurityEventCollectorError('INVALID_EVENT');
  if (
    event.instanceId !== expectedInstanceId ||
    event.source !== expectedSource ||
    typeof event.observedAt !== 'string' ||
    !event.observedAt.endsWith('Z') ||
    !Number.isFinite(Date.parse(event.observedAt))
  ) {
    throw new SecurityEventCollectorError('INVALID_EVENT');
  }
  if (event.type !== 'AUTHENTICATION_SUCCESS' && event.type !== 'AUTHENTICATION_FAILURE') {
    throw new SecurityEventCollectorError('INVALID_EVENT');
  }
  if (event.type === 'AUTHENTICATION_SUCCESS') return;
  if (event.reason === undefined) {
    throw new SecurityEventCollectorError('INVALID_EVENT');
  }
}

export function validateSecurityEvents(
  expectedInstanceId: PbxInstanceId,
  expectedSource: SecurityEventCollector['source'],
  events: SecurityEvent[],
): void {
  if (!Array.isArray(events)) throw new SecurityEventCollectorError('INVALID_EVENT');
  for (const event of events) validateSecurityEvent(expectedInstanceId, expectedSource, event);
}
