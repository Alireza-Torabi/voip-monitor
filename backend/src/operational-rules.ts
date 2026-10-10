import type { TelephonyInstanceState } from './telephony/state-engine.js';

import {
  actionableOperationalAlert,
  type OperationalAlertObservation,
  type OperationalHealthSnapshot,
  type CallQualitySample,
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

/** A conservative first-pass policy. Per-source staleness is checked before any rule. */
export function evaluateExtendedOperationalRules(
  instanceId: string,
  observedAt: string,
  telephony: TelephonyInstanceState | undefined,
  quality: readonly CallQualitySample[],
): OperationalAlertObservation[] {
  if (!telephony || telephony.synchronization !== 'CURRENT') return [];
  const now = Date.parse(observedAt);
  if (!Number.isFinite(now)) return [];
  const result: OperationalAlertObservation[] = [];
  const add = (
    ruleId: string,
    dimension: 'ENDPOINTS' | 'QUEUES' | 'CALL_QUALITY',
    severity: 'WARNING' | 'CRITICAL',
    kind: 'ENDPOINT' | 'QUEUE' | 'CALL_LEG',
    entityId: string,
    value: number,
    unit: string,
  ) => {
    if (!Number.isFinite(value) || value < 0) return;
    const observation: OperationalAlertObservation = {
      schemaVersion: 1,
      instanceId,
      ruleId,
      dimension,
      severity,
      entity: { kind, id: entityId },
      reasonCode: ruleId,
      observedAt,
      evidence: { availability: 'AVAILABLE', value, unit },
    };
    const alert = actionableOperationalAlert(observation);
    if (alert) result.push(alert);
  };
  if (
    telephony.endpointCapability === 'SUPPORTED' &&
    telephony.endpointSynchronization === 'CURRENT'
  ) {
    for (const endpoint of telephony.endpoints) {
      const transitions = endpoint.reliability.recentTransitions.filter(
        (t) =>
          t.from !== 'UNKNOWN' &&
          t.to !== 'UNKNOWN' &&
          t.from !== t.to &&
          Number.isFinite(Date.parse(t.observedAt)) &&
          now - Date.parse(t.observedAt) >= 0 &&
          now - Date.parse(t.observedAt) <= 300_000,
      );
      if (transitions.length >= 3)
        add(
          'ENDPOINT_FLAPPING',
          'ENDPOINTS',
          'WARNING',
          'ENDPOINT',
          endpoint.endpointId,
          transitions.length,
          'COUNT',
        );
    }
  }
  if (telephony.queueCapability === 'SUPPORTED' && telephony.queueSynchronization === 'CURRENT') {
    for (const queue of telephony.queues) {
      if (!Number.isSafeInteger(queue.waitingCount) || queue.waitingCount < 0) continue;
      if (queue.waitingCount >= 15)
        add(
          'QUEUE_PRESSURE_CRITICAL',
          'QUEUES',
          'CRITICAL',
          'QUEUE',
          queue.queueId,
          queue.waitingCount,
          'COUNT',
        );
      else if (queue.waitingCount >= 5)
        add(
          'QUEUE_PRESSURE_HIGH',
          'QUEUES',
          'WARNING',
          'QUEUE',
          queue.queueId,
          queue.waitingCount,
          'COUNT',
        );
    }
  }
  // A single report can reflect a transient spike. Require two distinct recent
  // sample timestamps on the same leg/direction with verified numeric evidence.
  const byLeg = new Map<string, CallQualitySample[]>();
  for (const sample of quality) {
    if (sample.instanceId !== instanceId || sample.direction !== 'RECEIVED') continue;
    const at = Date.parse(sample.observedAt);
    if (!Number.isFinite(at) || now - at < 0 || now - at > 120_000) continue;
    const key = JSON.stringify([
      sample.legId,
      sample.direction,
      sample.ssrc,
      sample.reportSourceSsrc,
    ]);
    const list = byLeg.get(key) ?? [];
    list.push(sample);
    byLeg.set(key, list);
  }
  for (const group of byLeg.values()) {
    const sorted = group.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    if (sorted.length < 2 || sorted[0]!.observedAt === sorted[1]!.observedAt) continue;
    const loss = sorted.slice(0, 2).map((s) => s.packetLossPercent);
    const rtt = sorted.slice(0, 2).map((s) => s.rtt);
    if (loss.every((m) => m.availability === 'AVAILABLE' && m.unit === 'PERCENT' && m.value >= 10))
      add(
        'CALL_PACKET_LOSS_HIGH',
        'CALL_QUALITY',
        'WARNING',
        'CALL_LEG',
        sorted[0]!.legId,
        Math.min(...loss.map((m) => (m.availability === 'AVAILABLE' ? m.value : 0))),
        'PERCENT',
      );
    if (
      rtt.every(
        (m) => m.availability === 'AVAILABLE' && m.unit === 'MILLISECONDS' && m.value >= 300,
      )
    )
      add(
        'CALL_RTT_HIGH',
        'CALL_QUALITY',
        'WARNING',
        'CALL_LEG',
        sorted[0]!.legId,
        Math.min(...rtt.map((m) => (m.availability === 'AVAILABLE' ? m.value : 0))),
        'MILLISECONDS',
      );
  }
  return result;
}
