import type {
  CapabilityState,
  PbxInstanceId,
  SystemMetricCapabilities,
  SystemMetricsSample,
} from '@voip-monitor/shared';
import { SystemMetricsCollectorError, type SystemMetricsCollector } from './collector.js';
import {
  computeCpuUtilizationPercent,
  parseDfPosix,
  parseProcMeminfo,
  parseProcStatCpu,
  parseProcUptime,
  parseSystemctlServiceStates,
  SystemMetricsParseError,
} from './parsers.js';
import {
  DEFAULT_RESTRICTED_SSH_LIMITS,
  RestrictedSshTransportError,
  resolveRestrictedSshCommand,
  runRestrictedSshCommand,
  type RestrictedSshExecutionLimits,
  type RestrictedSshTransport,
} from './ssh-transport.js';

export interface RestrictedSshSystemMetricsCollectorOptions {
  transport: RestrictedSshTransport;
  serviceIds?: readonly string[];
  cpuSampleIntervalMs?: number;
  limits?: RestrictedSshExecutionLimits;
  now?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface DimensionResult<T> {
  capability: CapabilityState;
  value?: T;
}

const DEFAULT_CPU_SAMPLE_INTERVAL_MS = 250;
const MAX_CPU_SAMPLE_INTERVAL_MS = 5_000;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  });
}

function validateInterval(milliseconds: number): number {
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 0 ||
    milliseconds > MAX_CPU_SAMPLE_INTERVAL_MS
  ) {
    throw new SystemMetricsCollectorError('INVALID_SAMPLE');
  }
  return milliseconds;
}

function capabilityFromTransportError(
  error: RestrictedSshTransportError,
): CapabilityState | undefined {
  if (error.code === 'PERMISSION_DENIED') return 'PERMISSION_DENIED';
  if (error.code === 'UNSUPPORTED') return 'UNSUPPORTED';
  return undefined;
}

export class RestrictedSshSystemMetricsCollector implements SystemMetricsCollector {
  readonly source = 'SSH' as const;

  private readonly transport: RestrictedSshTransport;
  private readonly serviceIds: readonly string[];
  private readonly cpuSampleIntervalMs: number;
  private readonly limits: RestrictedSshExecutionLimits;
  private readonly now: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: RestrictedSshSystemMetricsCollectorOptions) {
    this.transport = options.transport;
    this.serviceIds = [...(options.serviceIds ?? [])];
    if (this.serviceIds.length > 0) {
      try {
        resolveRestrictedSshCommand({ id: 'SERVICE_STATUS', serviceIds: this.serviceIds });
      } catch (error) {
        if (error instanceof RestrictedSshTransportError && error.code === 'INVALID_COMMAND') {
          throw new SystemMetricsCollectorError('INVALID_SAMPLE');
        }
        throw error;
      }
    }
    this.cpuSampleIntervalMs = validateInterval(
      options.cpuSampleIntervalMs ?? DEFAULT_CPU_SAMPLE_INTERVAL_MS,
    );
    this.limits = { ...(options.limits ?? DEFAULT_RESTRICTED_SSH_LIMITS) };
    this.now = options.now ?? (() => new Date().toISOString());
    this.sleep = options.sleep ?? defaultSleep;
  }

  async collect(instanceId: PbxInstanceId): Promise<SystemMetricsSample> {
    try {
      const cpu = await this.collectCpu();
      const memory = await this.collectDimension('MEMINFO', (output) => parseProcMeminfo(output));
      const filesystems = await this.collectDimension('FILESYSTEMS', (output) =>
        parseDfPosix(output),
      );
      const uptime = await this.collectDimension('UPTIME', (output) => parseProcUptime(output));
      const services = await this.collectServices();

      const capabilities: SystemMetricCapabilities = {
        cpu: cpu.capability,
        memory: memory.capability,
        filesystems: filesystems.capability,
        uptime: uptime.capability,
        services: services.capability,
      };

      return {
        instanceId,
        source: this.source,
        observedAt: this.now(),
        capabilities,
        ...(cpu.value === undefined ? {} : { cpu: { utilizationPercent: cpu.value } }),
        ...(memory.value === undefined ? {} : { memory: memory.value }),
        ...(filesystems.value === undefined ? {} : { filesystems: filesystems.value }),
        ...(uptime.value === undefined ? {} : { uptime: uptime.value }),
        ...(services.value === undefined ? {} : { services: services.value }),
      };
    } catch (error) {
      if (error instanceof SystemMetricsCollectorError) throw error;
      if (error instanceof SystemMetricsParseError) {
        throw new SystemMetricsCollectorError('INVALID_SAMPLE');
      }
      if (error instanceof RestrictedSshTransportError && error.code === 'INVALID_COMMAND') {
        throw new SystemMetricsCollectorError('INVALID_SAMPLE');
      }
      throw new SystemMetricsCollectorError('COLLECTION_FAILED');
    }
  }

  private async collectCpu(): Promise<DimensionResult<number>> {
    const first = await this.executeDimension('CPU_STAT');
    if (first.capability !== 'SUPPORTED' || first.output === undefined) {
      return { capability: first.capability };
    }

    await this.sleep(this.cpuSampleIntervalMs);

    const second = await this.executeDimension('CPU_STAT');
    if (second.capability !== 'SUPPORTED' || second.output === undefined) {
      return { capability: second.capability };
    }

    return {
      capability: 'SUPPORTED',
      value: computeCpuUtilizationPercent(
        parseProcStatCpu(first.output),
        parseProcStatCpu(second.output),
      ),
    };
  }

  private async collectDimension<T>(
    id: 'MEMINFO' | 'FILESYSTEMS' | 'UPTIME',
    parse: (output: string) => T,
  ): Promise<DimensionResult<T>> {
    const result = await this.executeDimension(id);
    if (result.capability !== 'SUPPORTED' || result.output === undefined) {
      return { capability: result.capability };
    }
    return { capability: 'SUPPORTED', value: parse(result.output) };
  }

  private async collectServices(): Promise<DimensionResult<SystemMetricsSample['services']>> {
    if (this.serviceIds.length === 0) return { capability: 'NOT_CONFIGURED' };

    try {
      const result = await runRestrictedSshCommand(
        this.transport,
        { id: 'SERVICE_STATUS', serviceIds: this.serviceIds },
        this.limits,
      );
      return {
        capability: 'SUPPORTED',
        value: parseSystemctlServiceStates(result.stdout, this.serviceIds),
      };
    } catch (error) {
      if (error instanceof RestrictedSshTransportError) {
        const capability = capabilityFromTransportError(error);
        if (capability) return { capability };
      }
      throw error;
    }
  }

  private async executeDimension(
    id: 'CPU_STAT' | 'MEMINFO' | 'FILESYSTEMS' | 'UPTIME',
  ): Promise<{ capability: CapabilityState; output?: string }> {
    try {
      const result = await runRestrictedSshCommand(this.transport, { id }, this.limits);
      return { capability: 'SUPPORTED', output: result.stdout };
    } catch (error) {
      if (error instanceof RestrictedSshTransportError) {
        const capability = capabilityFromTransportError(error);
        if (capability) return { capability };
      }
      throw error;
    }
  }
}
