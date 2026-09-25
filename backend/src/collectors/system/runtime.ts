import type { DataSourceHealth, PbxInstanceId, SystemMetricsSample } from '@voip-monitor/shared';
import type { SecretStore } from '../../security/secret-store.js';
import type { AppStorage } from '../../storage/index.js';
import type { SshConfigurationService } from '../../ssh/configuration.js';
import { NodeAddressResolver } from '../../providers/asterisk/resolver.js';
import { Ssh2RestrictedSshTransport } from './ssh-client-transport.js';
import { collectSystemMetrics } from './index.js';
import type { SystemMetricsCollector } from './collector.js';
import { RestrictedSshSystemMetricsCollector } from './restricted-ssh-collector.js';

export interface SystemMetricsCollectorFactory {
  create(instanceId: PbxInstanceId): SystemMetricsCollector;
}

export class RestrictedSshSystemMetricsCollectorFactory implements SystemMetricsCollectorFactory {
  constructor(
    private readonly configuration: SshConfigurationService,
    private readonly secrets: SecretStore,
  ) {}

  create(instanceId: PbxInstanceId): SystemMetricsCollector {
    const transport = new Ssh2RestrictedSshTransport({
      configuration: this.configuration,
      secrets: this.secrets,
      pbxInstanceId: instanceId,
      resolveAddresses: (host) => new NodeAddressResolver().resolve(host),
    });
    return new RestrictedSshSystemMetricsCollector({ transport });
  }
}

export interface SystemMetricsRuntimeOptions {
  intervalMs?: number;
  failureBackoffBaseMs?: number;
  failureBackoffMaxMs?: number;
  random?: () => number;
}

export interface SystemMetricsSourceStatus {
  instanceId: PbxInstanceId;
  health: DataSourceHealth;
  sample?: SystemMetricsSample;
  consecutiveFailures: number;
}

export type SystemMetricsSampleListener = (sample: SystemMetricsSample) => void;
export type SystemMetricsHealthListener = (status: SystemMetricsSourceStatus) => void;

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_FAILURE_BACKOFF_BASE_MS = 5_000;
const DEFAULT_FAILURE_BACKOFF_MAX_MS = 60_000;

function unavailable(instanceId: PbxInstanceId): SystemMetricsSourceStatus {
  return {
    instanceId,
    health: { source: 'SSH', freshness: 'UNAVAILABLE' },
    consecutiveFailures: 0,
  };
}

function errorCode(error: unknown): DataSourceHealth['error'] {
  if (!(error instanceof Error)) return { code: 'UNKNOWN' };
  const message = error.message;
  if (message.includes('TIMEOUT')) return { code: 'TIMEOUT' };
  if (message.includes('PERMISSION_DENIED')) return { code: 'PERMISSION_DENIED' };
  if (message.includes('UNSUPPORTED')) return { code: 'UNSUPPORTED' };
  if (message.includes('CONNECTION_FAILED')) return { code: 'CONNECTION_FAILED' };
  return { code: 'UNKNOWN' };
}

function validatePositive(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('invalid runtime option');
  return value;
}

class SystemMetricsEntry {
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  private running = false;
  private failures = 0;
  private lastSample: SystemMetricsSample | undefined;
  private health: DataSourceHealth = { source: 'SSH', freshness: 'NEVER_COLLECTED' };

  constructor(
    readonly instanceId: PbxInstanceId,
    private readonly collector: SystemMetricsCollector,
    private readonly options: Required<SystemMetricsRuntimeOptions>,
    private readonly emitSample: SystemMetricsSampleListener,
    private readonly emitHealth: SystemMetricsHealthListener,
  ) {}

  start(): void {
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  status(): SystemMetricsSourceStatus {
    return {
      instanceId: this.instanceId,
      health: structuredClone(this.health),
      ...(this.lastSample ? { sample: structuredClone(this.lastSample) } : {}),
      consecutiveFailures: this.failures,
    };
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.collectOnce();
    }, delayMs);
    this.timer.unref();
  }

  private async collectOnce(): Promise<void> {
    if (this.stopped || this.running) return;
    this.running = true;
    const lastAttempt = new Date().toISOString();
    this.health = { ...this.health, source: 'SSH', lastAttempt };
    this.emitHealth(this.status());
    try {
      const sample = await collectSystemMetrics(this.collector, this.instanceId);
      this.lastSample = sample;
      this.failures = 0;
      this.health = {
        source: 'SSH',
        freshness: 'CURRENT',
        lastAttempt,
        lastSuccess: sample.observedAt,
        lastUpdate: sample.observedAt,
      };
      this.emitSample(structuredClone(sample));
    } catch (error) {
      this.failures = Math.min(this.failures + 1, 30);
      const errorSummary = errorCode(error);
      this.health = {
        source: 'SSH',
        freshness: 'ERROR',
        lastAttempt,
        ...(this.health.lastSuccess ? { lastSuccess: this.health.lastSuccess } : {}),
        ...(this.health.lastUpdate ? { lastUpdate: this.health.lastUpdate } : {}),
        ...(errorSummary ? { error: errorSummary } : {}),
      };
    } finally {
      this.running = false;
      this.emitHealth(this.status());
      if (!this.stopped) this.schedule(this.nextDelay());
    }
  }

  private nextDelay(): number {
    if (this.failures === 0) return this.options.intervalMs;
    const exponential = Math.min(
      this.options.failureBackoffBaseMs * 2 ** (this.failures - 1),
      this.options.failureBackoffMaxMs,
    );
    return Math.max(1, Math.round(exponential * (0.8 + this.options.random() * 0.4)));
  }
}

export class SystemMetricsRuntime {
  private readonly entries = new Map<PbxInstanceId, SystemMetricsEntry>();
  private readonly sampleListeners = new Set<SystemMetricsSampleListener>();
  private readonly healthListeners = new Set<SystemMetricsHealthListener>();
  private readonly options: Required<SystemMetricsRuntimeOptions>;
  private started = false;

  constructor(
    private readonly storage: AppStorage,
    private readonly sshConfiguration: SshConfigurationService,
    private readonly factory: SystemMetricsCollectorFactory | undefined,
    options: SystemMetricsRuntimeOptions = {},
  ) {
    this.options = {
      intervalMs: validatePositive(options.intervalMs ?? DEFAULT_INTERVAL_MS),
      failureBackoffBaseMs: validatePositive(
        options.failureBackoffBaseMs ?? DEFAULT_FAILURE_BACKOFF_BASE_MS,
      ),
      failureBackoffMaxMs: validatePositive(
        options.failureBackoffMaxMs ?? DEFAULT_FAILURE_BACKOFF_MAX_MS,
      ),
      random: options.random ?? Math.random,
    };
    if (this.options.failureBackoffBaseMs > this.options.failureBackoffMaxMs) {
      throw new Error('invalid runtime backoff options');
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const profile of this.storage.pbxProfiles.list()) this.syncProfile(profile.id);
  }

  stop(): void {
    this.started = false;
    for (const entry of this.entries.values()) entry.stop();
    this.entries.clear();
  }

  syncProfile(instanceId: PbxInstanceId): void {
    const current = this.entries.get(instanceId);
    if (current) {
      current.stop();
      this.entries.delete(instanceId);
    }
    if (!this.started || !this.factory) return;
    const profile = this.storage.pbxProfiles.get(instanceId);
    const config = this.sshConfiguration.get(instanceId);
    if (!profile?.enabled || !config?.hasCredential) return;
    const entry = new SystemMetricsEntry(
      instanceId,
      this.factory.create(instanceId),
      this.options,
      (sample) => this.emitSample(sample),
      (status) => this.emitHealth(status),
    );
    this.entries.set(instanceId, entry);
    entry.start();
  }

  status(instanceId: PbxInstanceId): SystemMetricsSourceStatus {
    return this.entries.get(instanceId)?.status() ?? unavailable(instanceId);
  }

  subscribeSamples(listener: SystemMetricsSampleListener): () => void {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  subscribeHealth(listener: SystemMetricsHealthListener): () => void {
    this.healthListeners.add(listener);
    return () => this.healthListeners.delete(listener);
  }

  private emitSample(sample: SystemMetricsSample): void {
    for (const listener of this.sampleListeners) {
      try {
        listener(structuredClone(sample));
      } catch {
        // Collection lifecycle remains isolated from consumers.
      }
    }
  }

  private emitHealth(status: SystemMetricsSourceStatus): void {
    for (const listener of this.healthListeners) {
      try {
        listener(structuredClone(status));
      } catch {
        // Health consumers remain isolated from collection lifecycle.
      }
    }
  }
}
