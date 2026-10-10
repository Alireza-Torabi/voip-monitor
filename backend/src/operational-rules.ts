import {
  actionableOperationalAlert,
  type OperationalAlertObservation,
  type OperationalHealthSnapshot,
} from '@voip-monitor/shared';

/** Task 66: deterministic, read-only evaluation of already vetted health reasons.
 * No incident lifecycle, storage or notifications. Never infer per-entity alerts from aggregates.
 */
const rules: Record<string, { ruleId: string; severity: 'WARNING' | 'CRITICAL'; unit?: string }> = {
  PROVIDER_DISCONNECTED: { ruleId: 'PBX_DISCONNECTED', severity: 'CRITICAL' },
  PROVIDER_ERROR: { ruleId: 'PBX_CONNECTION_ERROR', severity: 'CRITICAL' },
  TRUNK_FAILED: { ruleId: 'TRUNK_FAILURES', severity: 'CRITICAL', unit: 'COUNT' },
  TRUNK_REJECTED: { ruleId: 'TRUNK_REJECTIONS', severity: 'CRITICAL', unit: 'COUNT' },
  TRUNK_UNREGISTERED: { ruleId: 'TRUNK_UNREGISTERED', severity: 'CRITICAL', unit: 'COUNT' },
  TRUNK_UNREACHABLE: { ruleId: 'TRUNK_UNREACHABLE', severity: 'CRITICAL', unit: 'COUNT' },
  QUEUE_WAITING: { ruleId: 'QUEUE_WAITING', severity: 'WARNING', unit: 'COUNT' },
  SYSTEM_CPU_HIGH: { ruleId: 'CPU_HIGH', severity: 'WARNING', unit: 'PERCENT' },
  SYSTEM_CPU_CRITICAL: { ruleId: 'CPU_CRITICAL', severity: 'CRITICAL', unit: 'PERCENT' },
  SYSTEM_MEMORY_HIGH: { ruleId: 'MEMORY_HIGH', severity: 'WARNING', unit: 'PERCENT' },
  SYSTEM_MEMORY_CRITICAL: { ruleId: 'MEMORY_CRITICAL', severity: 'CRITICAL', unit: 'PERCENT' },
  SYSTEM_FILESYSTEM_HIGH: { ruleId: 'FILESYSTEM_HIGH', severity: 'WARNING', unit: 'PERCENT' },
  SYSTEM_FILESYSTEM_CRITICAL: {
    ruleId: 'FILESYSTEM_CRITICAL',
    severity: 'CRITICAL',
    unit: 'PERCENT',
  },
  SYSTEM_SERVICE_FAILED: { ruleId: 'SERVICE_FAILURES', severity: 'CRITICAL', unit: 'COUNT' },
  SYSTEM_SERVICE_INACTIVE: { ruleId: 'SERVICE_INACTIVE', severity: 'WARNING', unit: 'COUNT' },
};

export function evaluateCoreOperationalRules(
  health: OperationalHealthSnapshot,
  observedAt: string,
): OperationalAlertObservation[] {
  const results: OperationalAlertObservation[] = [];
  const source = health.components;
  for (const dimension of ['PROVIDER', 'TRUNKS', 'QUEUES', 'SYSTEM'] as const) {
    const component = source[dimension];
    if (component.state !== 'CRITICAL' && component.state !== 'DEGRADED') continue;
    for (const reason of component.reasons) {
      const rule = rules[reason.code];
      if (!rule) continue;
      const n = reason.value ?? reason.count;
      if (n !== undefined && (!Number.isFinite(n) || n < 0)) continue;
      const observation: OperationalAlertObservation = {
        schemaVersion: 1,
        instanceId: health.instanceId,
        ruleId: rule.ruleId,
        dimension,
        severity: rule.severity,
        entity: { kind: dimension === 'SYSTEM' ? 'HOST' : 'PBX', id: health.instanceId },
        reasonCode: reason.code,
        observedAt,
        evidence: {
          availability: 'AVAILABLE',
          ...(n !== undefined ? { value: n } : {}),
          ...(rule.unit ? { unit: rule.unit } : {}),
        },
      };
      const alert = actionableOperationalAlert(observation);
      if (alert) results.push(alert);
    }
  }
  return results;
}
