import type {
  SystemFilesystemSample,
  SystemMemorySample,
  SystemServiceHealthSample,
  SystemServiceState,
  SystemUptimeSample,
} from '@voip-monitor/shared';

export type SystemMetricsParseErrorCode = 'INVALID_OUTPUT';

export class SystemMetricsParseError extends Error {
  constructor(readonly code: SystemMetricsParseErrorCode) {
    super('System metrics parser invalid output');
    this.name = 'SystemMetricsParseError';
  }
}

interface CpuCounters {
  total: number;
  idle: number;
}

function invalid(): never {
  throw new SystemMetricsParseError('INVALID_OUTPUT');
}

function safeNonNegativeInteger(value: string): number {
  if (!/^[0-9]+$/.test(value)) invalid();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) invalid();
  return parsed;
}

function safePositiveInteger(value: string): number {
  const parsed = safeNonNegativeInteger(value);
  if (parsed <= 0) invalid();
  return parsed;
}

export function parseProcStatCpu(output: string): CpuCounters {
  const line = output
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .find((item) => item.startsWith('cpu '));
  if (!line) invalid();

  const fields = line.split(/\s+/u);
  if (fields.length < 5 || fields[0] !== 'cpu') invalid();

  const counters = fields.slice(1).map(safeNonNegativeInteger);
  const idle = (counters[3] ?? 0) + (counters[4] ?? 0);
  // Linux guest and guest_nice are already included in user and nice respectively.
  const total = counters.slice(0, 8).reduce((sum, value) => {
    const next = sum + value;
    if (!Number.isSafeInteger(next)) invalid();
    return next;
  }, 0);

  if (total <= 0 || idle > total) invalid();
  return { total, idle };
}

export function computeCpuUtilizationPercent(previous: CpuCounters, current: CpuCounters): number {
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;
  if (totalDelta <= 0 || idleDelta < 0 || idleDelta > totalDelta) invalid();

  const utilization = ((totalDelta - idleDelta) / totalDelta) * 100;
  if (!Number.isFinite(utilization) || utilization < 0 || utilization > 100) invalid();
  return utilization;
}

export function parseProcMeminfo(output: string): SystemMemorySample {
  const values = new Map<string, number>();
  for (const line of output.split(/\r?\n/u)) {
    const match = /^([A-Za-z_()]+):\s+([0-9]+)\s+kB\s*$/u.exec(line.trim());
    if (!match) continue;
    const key = match[1];
    const kibibytesText = match[2];
    if (!key || kibibytesText === undefined) invalid();
    const kibibytes = safeNonNegativeInteger(kibibytesText);
    const bytes = kibibytes * 1024;
    if (!Number.isSafeInteger(bytes)) invalid();
    values.set(key, bytes);
  }

  const totalBytes = values.get('MemTotal');
  const availableBytes = values.get('MemAvailable');
  if (
    totalBytes === undefined ||
    availableBytes === undefined ||
    totalBytes <= 0 ||
    availableBytes > totalBytes
  ) {
    invalid();
  }

  return { totalBytes, availableBytes };
}

export function parseDfPosix(output: string): SystemFilesystemSample[] {
  const lines = output.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  // The df header is intentionally ignored because its labels may be locale-dependent.
  if (lines.length < 2) invalid();

  const filesystems: SystemFilesystemSample[] = [];
  const mountPoints = new Set<string>();

  for (const rawLine of lines.slice(1)) {
    const match = /^(\S+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)%\s+(.+)$/u.exec(
      rawLine.trim(),
    );
    if (!match) invalid();

    const totalText = match[2];
    const availableText = match[4];
    const mountPointText = match[6];
    if (totalText === undefined || availableText === undefined || mountPointText === undefined) {
      invalid();
    }
    const totalBytes = safePositiveInteger(totalText);
    const availableBytes = safeNonNegativeInteger(availableText);
    const mountPoint = mountPointText.trim();
    if (!mountPoint || availableBytes > totalBytes || mountPoints.has(mountPoint)) invalid();
    mountPoints.add(mountPoint);

    filesystems.push({
      filesystemId: mountPoint,
      mountPoint,
      totalBytes,
      availableBytes,
    });
  }

  return filesystems;
}

export function parseProcUptime(output: string): SystemUptimeSample {
  const first = output.trim().split(/\s+/u)[0];
  if (!first || !/^[0-9]+(?:\.[0-9]+)?$/u.test(first)) invalid();
  const seconds = Number(first);
  if (!Number.isFinite(seconds) || seconds < 0) invalid();
  return { uptimeSeconds: Math.floor(seconds) };
}

function normalizeServiceState(value: string): SystemServiceState {
  switch (value.trim().toLowerCase()) {
    case 'active':
      return 'ACTIVE';
    case 'inactive':
      return 'INACTIVE';
    case 'failed':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

export function parseSystemctlServiceStates(
  output: string,
  expectedServiceIds: readonly string[],
): SystemServiceHealthSample[] {
  if (expectedServiceIds.length === 0) invalid();

  const expected = new Set(expectedServiceIds);
  if (expected.size !== expectedServiceIds.length) invalid();

  const records = output
    .trim()
    .split(/\r?\n\s*\r?\n/u)
    .filter((record) => record.trim().length > 0);
  const result: SystemServiceHealthSample[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    let serviceId: string | undefined;
    let activeState: string | undefined;

    for (const line of record.split(/\r?\n/u)) {
      const separator = line.indexOf('=');
      if (separator <= 0) invalid();
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key === 'Id') serviceId = value;
      else if (key === 'ActiveState') activeState = value;
      else invalid();
    }

    if (
      !serviceId ||
      activeState === undefined ||
      !expected.has(serviceId) ||
      seen.has(serviceId)
    ) {
      invalid();
    }

    seen.add(serviceId);
    result.push({ serviceId, state: normalizeServiceState(activeState) });
  }

  if (seen.size !== expected.size) invalid();
  return result.sort((left, right) => left.serviceId.localeCompare(right.serviceId));
}
