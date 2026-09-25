import type {
  CapabilityState,
  PbxInstanceId,
  SystemFilesystemSample,
  SystemMetricsSample,
  SystemServiceHealthSample,
} from '@voip-monitor/shared';
import { SystemMetricsCollectorError, type SystemMetricsCollector } from './collector.js';

export * from './collector.js';
export * from './parsers.js';
export * from './restricted-ssh-collector.js';
export * from './ssh-transport.js';

const CAPABILITY_STATES = new Set<CapabilityState>([
  'SUPPORTED',
  'UNSUPPORTED',
  'NOT_CONFIGURED',
  'PERMISSION_DENIED',
  'UNKNOWN',
]);

function invalid(): never {
  throw new SystemMetricsCollectorError('INVALID_SAMPLE');
}

function validUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !value.endsWith('Z')) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function finitePercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateCapacity(totalBytes: number, availableBytes: number): void {
  if (
    !positiveSafeInteger(totalBytes) ||
    !nonNegativeSafeInteger(availableBytes) ||
    availableBytes > totalBytes
  ) {
    invalid();
  }
}

function validateCapability(capability: unknown): asserts capability is CapabilityState {
  if (!CAPABILITY_STATES.has(capability as CapabilityState)) invalid();
}

function validatePresence(capability: CapabilityState, present: boolean): void {
  if ((capability === 'SUPPORTED') !== present) invalid();
}

function validateFilesystems(filesystems: SystemFilesystemSample[]): void {
  const ids = new Set<string>();
  for (const filesystem of filesystems) {
    if (
      !filesystem ||
      typeof filesystem !== 'object' ||
      typeof filesystem.filesystemId !== 'string' ||
      typeof filesystem.mountPoint !== 'string' ||
      !filesystem.filesystemId.trim() ||
      !filesystem.mountPoint.trim()
    ) {
      invalid();
    }
    if (ids.has(filesystem.filesystemId)) invalid();
    ids.add(filesystem.filesystemId);
    validateCapacity(filesystem.totalBytes, filesystem.availableBytes);
  }
}

function validateServices(services: SystemServiceHealthSample[]): void {
  const ids = new Set<string>();
  for (const service of services) {
    if (
      !service ||
      typeof service !== 'object' ||
      typeof service.serviceId !== 'string' ||
      !service.serviceId.trim()
    ) {
      invalid();
    }
    if (ids.has(service.serviceId)) invalid();
    ids.add(service.serviceId);
    if (
      service.state !== 'ACTIVE' &&
      service.state !== 'INACTIVE' &&
      service.state !== 'FAILED' &&
      service.state !== 'UNKNOWN'
    ) {
      invalid();
    }
  }
}

export function validateSystemMetricsSample(
  expectedInstanceId: PbxInstanceId,
  expectedSource: SystemMetricsCollector['source'],
  sample: SystemMetricsSample,
): void {
  if (!sample || typeof sample !== 'object') invalid();
  if (
    sample.instanceId !== expectedInstanceId ||
    sample.source !== expectedSource ||
    !validUtcTimestamp(sample.observedAt)
  ) {
    invalid();
  }

  if (!sample.capabilities || typeof sample.capabilities !== 'object') invalid();
  validateCapability(sample.capabilities.cpu);
  validateCapability(sample.capabilities.memory);
  validateCapability(sample.capabilities.filesystems);
  validateCapability(sample.capabilities.uptime);
  validateCapability(sample.capabilities.services);

  validatePresence(sample.capabilities.cpu, sample.cpu !== undefined);
  validatePresence(sample.capabilities.memory, sample.memory !== undefined);
  validatePresence(sample.capabilities.filesystems, sample.filesystems !== undefined);
  validatePresence(sample.capabilities.uptime, sample.uptime !== undefined);
  validatePresence(sample.capabilities.services, sample.services !== undefined);

  if (sample.cpu !== undefined) {
    if (
      !sample.cpu ||
      typeof sample.cpu !== 'object' ||
      !finitePercent(sample.cpu.utilizationPercent)
    ) {
      invalid();
    }
  }

  if (sample.memory !== undefined) {
    if (!sample.memory || typeof sample.memory !== 'object') invalid();
    validateCapacity(sample.memory.totalBytes, sample.memory.availableBytes);
  }

  if (sample.filesystems !== undefined) {
    if (!Array.isArray(sample.filesystems)) invalid();
    validateFilesystems(sample.filesystems);
  }

  if (sample.uptime !== undefined) {
    if (
      !sample.uptime ||
      typeof sample.uptime !== 'object' ||
      !nonNegativeSafeInteger(sample.uptime.uptimeSeconds)
    ) {
      invalid();
    }
  }

  if (sample.services !== undefined) {
    if (!Array.isArray(sample.services)) invalid();
    validateServices(sample.services);
  }
}

/**
 * Collect one provider-neutral system sample and enforce the public boundary before
 * any future persistence or API layer consumes it.
 */
export async function collectSystemMetrics(
  collector: SystemMetricsCollector,
  instanceId: PbxInstanceId,
): Promise<SystemMetricsSample> {
  let sample: SystemMetricsSample;
  try {
    sample = await collector.collect(instanceId);
  } catch (error) {
    if (error instanceof SystemMetricsCollectorError) throw error;
    throw new SystemMetricsCollectorError('COLLECTION_FAILED');
  }

  validateSystemMetricsSample(instanceId, collector.source, sample);
  return structuredClone(sample);
}
