import type { OperationalHealthSnapshot, OperationalHealthState } from './operational-health.js';

export interface FleetHealthCounts {
  HEALTHY: number;
  DEGRADED: number;
  CRITICAL: number;
  UNKNOWN: number;
  STALE: number;
}

export interface FleetOverviewItem {
  instanceId: string;
  displayName: string;
  enabled: boolean;
  health: OperationalHealthSnapshot;
  activeCalls: number;
  trunkFailures: number;
  unreachableEndpoints: number;
  waitingCallers: number;
  criticalAlerts: number;
  lastTelephonyUpdate?: string;
}

export interface FleetOverviewSnapshot {
  observedAt: string;
  healthCounts: FleetHealthCounts;
  totalPbx: number;
  activeCalls: number;
  trunkFailures: number;
  unreachableEndpoints: number;
  waitingCallers: number;
  criticalAlerts: number;
  items: FleetOverviewItem[];
}

export function emptyFleetHealthCounts(): FleetHealthCounts {
  return { HEALTHY: 0, DEGRADED: 0, CRITICAL: 0, UNKNOWN: 0, STALE: 0 };
}

export function incrementFleetHealth(
  counts: FleetHealthCounts,
  state: OperationalHealthState,
): void {
  counts[state] += 1;
}
