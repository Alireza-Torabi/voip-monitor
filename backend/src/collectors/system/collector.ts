import type { PbxInstanceId, SystemMetricsSample } from '@voip-monitor/shared';

export type SystemMetricsCollectorErrorCode = 'COLLECTION_FAILED' | 'INVALID_SAMPLE';

export class SystemMetricsCollectorError extends Error {
  constructor(readonly code: SystemMetricsCollectorErrorCode) {
    super(`System metrics collector ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SystemMetricsCollectorError';
  }
}

export interface SystemMetricsCollector {
  readonly source: 'SSH';
  collect(instanceId: PbxInstanceId): Promise<SystemMetricsSample>;
}
