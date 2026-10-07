import {
  evaluateOperationalHealth,
  type OperationalHealthInput,
  type OperationalHealthSnapshot,
  type PbxConnectionState,
  type SystemMetricsSample,
} from '@voip-monitor/shared';
import type { SystemMetricsSourceStatus } from './collectors/system/runtime.js';
import type { SecurityAlertRecord } from './storage/index.js';
import type { TelephonyInstanceState } from './telephony/state-engine.js';

export interface OperationalHealthSources {
  instanceId: string;
  providerState: PbxConnectionState;
  telephony?: TelephonyInstanceState | undefined;
  systemStatus?: SystemMetricsSourceStatus | undefined;
  systemSample?: SystemMetricsSample | undefined;
  securityAlerts: SecurityAlertRecord[];
}

function memoryPercent(sample: SystemMetricsSample | undefined): number | undefined {
  if (!sample?.memory || sample.memory.totalBytes <= 0) return undefined;
  return (
    (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
  );
}

function maxFilesystemPercent(sample: SystemMetricsSample | undefined): number | undefined {
  if (!sample?.filesystems || sample.filesystems.length === 0) return undefined;
  let maximum: number | undefined;
  for (const filesystem of sample.filesystems) {
    if (filesystem.totalBytes <= 0) continue;
    const used =
      (100 * (filesystem.totalBytes - filesystem.availableBytes)) / filesystem.totalBytes;
    maximum = maximum === undefined ? used : Math.max(maximum, used);
  }
  return maximum;
}

export function buildOperationalHealthSnapshot(
  sources: OperationalHealthSources,
): OperationalHealthSnapshot {
  const input: OperationalHealthInput = {
    instanceId: sources.instanceId,
    providerState: sources.providerState,
    security: { currentAlertCount: sources.securityAlerts.length },
    ...(sources.telephony
      ? {
          telephony: {
            synchronization: sources.telephony.synchronization,
            trunkCapability: sources.telephony.trunkCapability,
            trunkSynchronization: sources.telephony.trunkSynchronization,
            trunks: sources.telephony.trunks.map((trunk) => ({
              registrationState: trunk.registrationState,
              ...(trunk.reachability ? { reachability: trunk.reachability } : {}),
            })),
            endpointCapability: sources.telephony.endpointCapability,
            endpointSynchronization: sources.telephony.endpointSynchronization,
            endpoints: sources.telephony.endpoints.map((endpoint) => ({
              reachability: endpoint.reachability,
            })),
            queueCapability: sources.telephony.queueCapability,
            queueSynchronization: sources.telephony.queueSynchronization,
            queues: sources.telephony.queues.map((queue) => ({ waitingCount: queue.waitingCount })),
          },
        }
      : {}),
    ...(sources.systemStatus
      ? {
          system: {
            freshness: sources.systemStatus.health.freshness,
            ...(sources.systemSample?.cpu
              ? { cpuPercent: sources.systemSample.cpu.utilizationPercent }
              : {}),
            ...(memoryPercent(sources.systemSample) !== undefined
              ? { memoryPercent: memoryPercent(sources.systemSample)! }
              : {}),
            ...(maxFilesystemPercent(sources.systemSample) !== undefined
              ? { maxFilesystemPercent: maxFilesystemPercent(sources.systemSample)! }
              : {}),
            ...(sources.systemSample?.services ? { services: sources.systemSample.services } : {}),
          },
        }
      : {}),
  };
  return evaluateOperationalHealth(input);
}
