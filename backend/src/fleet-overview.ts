import {
  emptyFleetHealthCounts,
  incrementFleetHealth,
  type FleetOverviewItem,
  type FleetOverviewSnapshot,
} from '@voip-monitor/shared';
import type { SystemMetricsRuntime } from './collectors/system/runtime.js';
import type { SafePbxProfile } from './onboarding/index.js';
import type { ProviderRuntimeManager } from './providers/runtime/index.js';
import type { AppStorage } from './storage/index.js';
import type { TelephonyStateEngine } from './telephony/state-engine.js';
import { buildOperationalHealthSnapshot } from './operational-health.js';

export function buildFleetOverviewSnapshot(options: {
  profiles: SafePbxProfile[];
  runtime?: ProviderRuntimeManager | undefined;
  telephonyState?: TelephonyStateEngine | undefined;
  systemMetrics?: SystemMetricsRuntime | undefined;
  storage: AppStorage;
  now?: (() => string) | undefined;
}): FleetOverviewSnapshot {
  const items: FleetOverviewItem[] = options.profiles.map((profile) => {
    const telephony = options.telephonyState?.current(profile.id);
    const systemSample = options.storage.systemMetrics.getCurrent(profile.id);
    const securityAlerts = options.storage.securityAlerts.listCurrent(profile.id);
    const health = buildOperationalHealthSnapshot({
      instanceId: profile.id,
      providerState: options.runtime?.connectionState(profile.id) ?? profile.connectionStatus,
      securityAlerts,
      ...(telephony ? { telephony } : {}),
      ...(options.systemMetrics ? { systemStatus: options.systemMetrics.status(profile.id) } : {}),
      ...(systemSample ? { systemSample } : {}),
    });
    const trunkFailures =
      telephony?.trunks.filter(
        (trunk) =>
          trunk.registrationState === 'UNREGISTERED' ||
          trunk.registrationState === 'REJECTED' ||
          trunk.registrationState === 'FAILED' ||
          trunk.reachability === 'UNREACHABLE',
      ).length ?? 0;
    const endpointFailures =
      telephony?.endpoints.filter((endpoint) => endpoint.reachability === 'UNREACHABLE').length ??
      0;
    const waitingCallers =
      telephony?.queues.reduce((sum, queue) => sum + Math.max(0, queue.waitingCount), 0) ?? 0;
    return {
      instanceId: profile.id,
      displayName: profile.displayName,
      enabled: profile.enabled,
      health,
      activeCalls: telephony?.calls.length ?? 0,
      trunkFailures,
      endpointFailures,
      waitingCallers,
      criticalAlerts: securityAlerts.length,
      ...(telephony?.lastEventAt || telephony?.lastSnapshotAt
        ? { lastTelephonyUpdate: telephony.lastEventAt ?? telephony.lastSnapshotAt }
        : {}),
    };
  });

  const healthCounts = emptyFleetHealthCounts();
  for (const item of items) incrementFleetHealth(healthCounts, item.health.overall);
  return {
    observedAt: options.now?.() ?? new Date().toISOString(),
    healthCounts,
    totalPbx: items.length,
    activeCalls: items.reduce((sum, item) => sum + item.activeCalls, 0),
    trunkFailures: items.reduce((sum, item) => sum + item.trunkFailures, 0),
    endpointFailures: items.reduce((sum, item) => sum + item.endpointFailures, 0),
    waitingCallers: items.reduce((sum, item) => sum + item.waitingCallers, 0),
    criticalAlerts: items.reduce((sum, item) => sum + item.criticalAlerts, 0),
    items: items.sort((left, right) => {
      const rank = { CRITICAL: 0, STALE: 1, DEGRADED: 2, UNKNOWN: 3, HEALTHY: 4 } as const;
      const stateOrder = rank[left.health.overall] - rank[right.health.overall];
      return stateOrder !== 0 ? stateOrder : left.displayName.localeCompare(right.displayName);
    }),
  };
}
