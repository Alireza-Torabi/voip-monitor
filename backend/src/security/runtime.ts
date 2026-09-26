import type { SecurityEvent } from '@voip-monitor/shared';
import { SecurityAlertEvaluator } from './alerts.js';
import type { AppStorage, SecurityAlertRuleConfig } from '../storage/index.js';

export interface SecurityEventSource {
  subscribeSecurityEvents(listener: (event: SecurityEvent) => void): () => void;
}

export class SecurityAlertRuntime {
  private unsubscribe?: () => void;
  private readonly evaluator: SecurityAlertEvaluator;

  constructor(
    private readonly storage: AppStorage,
    private readonly source: SecurityEventSource,
    private readonly retentionCutoff: () => string,
  ) {
    this.evaluator = new SecurityAlertEvaluator(storage.securityEvents);
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.source.subscribeSecurityEvents((event) => this.handle(event));
  }

  stop(): void {
    this.unsubscribe?.();
    delete this.unsubscribe;
  }

  private handle(event: SecurityEvent): void {
    try {
      this.storage.securityEvents.save(event, this.retentionCutoff());
    } catch {
      return;
    }
    let rules: SecurityAlertRuleConfig[];
    try {
      rules = this.storage.securityAlertRules.list(event.instanceId);
    } catch {
      return;
    }
    for (const config of rules) {
      if (!config.enabled) continue;
      const rule =
        config.id === 'AUTHENTICATION_FAILURE_ANY'
          ? { id: config.id, enabled: config.enabled }
          : {
              id: config.id,
              enabled: config.enabled,
              threshold: config.threshold,
              windowSeconds: config.windowSeconds,
              ...(config.reason === undefined ? {} : { reason: config.reason }),
            };
      const evaluation = this.evaluator.evaluate(event, rule);
      if (evaluation.status !== 'MATCHED') continue;
      try {
        this.storage.securityAlerts.save(
          {
            instanceId: event.instanceId,
            ruleId: evaluation.ruleId as
              'AUTHENTICATION_FAILURE_ANY' | 'AUTHENTICATION_FAILURE_THRESHOLD',
            observedAt: event.observedAt,
            matchedEventCount: evaluation.matchedEventCount,
            ...(event.streamGeneration === undefined
              ? {}
              : { streamGeneration: event.streamGeneration }),
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          },
          this.retentionCutoff(),
        );
      } catch {
        // Alert persistence failures never affect provider or event persistence.
      }
    }
  }
}
