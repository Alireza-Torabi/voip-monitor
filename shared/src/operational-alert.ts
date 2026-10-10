/** Phase 17 / Task 65: provider-neutral, immutable alert observations.
 * No collector, rule evaluator, persistence, notification or lifecycle mutation.
 */
export type OperationalAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type OperationalAlertDimension =
  'PROVIDER' | 'TRUNKS' | 'ENDPOINTS' | 'QUEUES' | 'SYSTEM' | 'SECURITY' | 'CALL_QUALITY';
export type OperationalAlertEntityKind =
  'PBX' | 'TRUNK' | 'ENDPOINT' | 'QUEUE' | 'HOST' | 'FILESYSTEM' | 'SERVICE' | 'CALL_LEG';
export type OperationalAlertAvailability = 'AVAILABLE' | 'UNKNOWN' | 'UNSUPPORTED' | 'STALE';

export interface OperationalAlertObservation {
  schemaVersion: 1;
  instanceId: string;
  /** Stable rule identifier; never contains phone numbers or secrets. */
  ruleId: string;
  dimension: OperationalAlertDimension;
  severity: OperationalAlertSeverity;
  /** Stable, bounded entity key within this PBX (e.g. service id). */
  entity: { kind: OperationalAlertEntityKind; id: string };
  /** Machine-readable safe reason code; UI localizes it. */
  reasonCode: string;
  observedAt: string;
  /** For unavailable source evidence, DO NOT emit an active alert. */
  evidence:
    | { availability: 'AVAILABLE'; value?: number; unit?: string }
    | { availability: 'UNKNOWN' | 'UNSUPPORTED' | 'STALE'; reason: string };
}

/** A fingerprint is for deduplication, NOT a public UI or notification title. */
export function operationalAlertFingerprint(
  observation: Pick<OperationalAlertObservation, 'instanceId' | 'ruleId' | 'entity'>,
): string {
  return JSON.stringify([
    observation.instanceId,
    observation.ruleId,
    observation.entity.kind,
    observation.entity.id,
  ]);
}

const safeId = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;
const safeCode = /^[A-Z][A-Z0-9_]{0,95}$/;

/** Reject untrusted/unbounded measurements at the shared boundary. */
export function validateOperationalAlertObservation(value: OperationalAlertObservation): boolean {
  const e = value.evidence;
  if (
    value.schemaVersion !== 1 ||
    !safeId.test(value.instanceId) ||
    !safeId.test(value.ruleId) ||
    !safeId.test(value.entity.id) ||
    !safeCode.test(value.reasonCode) ||
    !['PBX', 'TRUNK', 'ENDPOINT', 'QUEUE', 'HOST', 'FILESYSTEM', 'SERVICE', 'CALL_LEG'].includes(
      value.entity.kind,
    ) ||
    !['PROVIDER', 'TRUNKS', 'ENDPOINTS', 'QUEUES', 'SYSTEM', 'SECURITY', 'CALL_QUALITY'].includes(
      value.dimension,
    ) ||
    !['INFO', 'WARNING', 'CRITICAL'].includes(value.severity) ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.observedAt) ||
    !Number.isFinite(Date.parse(value.observedAt))
  )
    return false;
  if (e.availability === 'AVAILABLE') {
    return (
      (e.value === undefined || Number.isFinite(e.value)) &&
      (e.unit === undefined || /^[A-Z][A-Z0-9_]{0,31}$/.test(e.unit))
    );
  }
  return (
    ['UNKNOWN', 'UNSUPPORTED', 'STALE'].includes(e.availability) &&
    typeof e.reason === 'string' &&
    safeCode.test(e.reason)
  );
}

/** Missing/stale metrics never become a zero or a triggered alert. */
export function actionableOperationalAlert(
  observation: OperationalAlertObservation,
): OperationalAlertObservation | undefined {
  return validateOperationalAlertObservation(observation) &&
    observation.evidence.availability === 'AVAILABLE'
    ? observation
    : undefined;
}
