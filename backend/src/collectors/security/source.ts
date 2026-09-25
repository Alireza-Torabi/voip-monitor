import type { PbxInstanceId, PbxProvider, SecurityEventListener } from '@voip-monitor/shared';
import { validateSecurityEvent, type SecurityEventCollector } from './collector.js';

/**
 * Bounded security source adapter. Provider-specific parsing is complete before
 * an event reaches this boundary; raw AMI fields never cross it.
 */
export class AsteriskAmiSecurityEventSource implements SecurityEventCollector {
  readonly source = 'AMI' as const;

  constructor(
    private readonly provider: PbxProvider,
    private readonly instanceId: PbxInstanceId,
  ) {}

  subscribeEvents(listener: SecurityEventListener): () => void {
    return this.provider.subscribeSecurityEvents((event) => {
      try {
        validateSecurityEvent(this.instanceId, this.source, event);
      } catch {
        return;
      }
      listener(structuredClone(event));
    });
  }
}
