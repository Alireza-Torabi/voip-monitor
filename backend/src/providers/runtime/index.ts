import type {
  PbxConnectionState,
  PbxHealth,
  PbxProvider,
  ProviderDiscoveryResult,
  ProviderEvent,
  ProviderEventListener,
} from '@voip-monitor/shared';
import type { SecretStore } from '../../security/secret-store.js';
import type { AppStorage, PbxProfileRecord } from '../../storage/index.js';
import { AsteriskProvider } from '../asterisk/provider.js';
import { NodeAddressResolver } from '../asterisk/resolver.js';
import { TcpAmiTransport } from '../asterisk/tcp-transport.js';

const AMI_SECRET = 'ami-password';

export type ProviderRuntimeErrorCode =
  'NETWORK_DISABLED' | 'NOT_FOUND' | 'CREDENTIAL_MISSING' | 'BUSY' | 'PROVIDER_FAILED';

export class ProviderRuntimeError extends Error {
  constructor(readonly code: ProviderRuntimeErrorCode) {
    super(`Provider runtime ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'ProviderRuntimeError';
  }
}

export interface ProviderFactory {
  create(profile: PbxProfileRecord): PbxProvider;
}

export class AsteriskProviderFactory implements ProviderFactory {
  constructor(private readonly secrets: SecretStore) {}

  create(profile: PbxProfileRecord): PbxProvider {
    return new AsteriskProvider({
      instanceId: profile.id,
      displayName: profile.displayName,
      host: profile.amiHost,
      port: profile.amiPort,
      amiUsername: profile.amiUsername,
      readAmiPassword: () => this.secrets.getSecret(profile.id, AMI_SECRET) ?? Buffer.alloc(0),
      resolver: new NodeAddressResolver(),
      transport: new TcpAmiTransport(),
    });
  }
}

export interface ProviderRuntimeOptions {
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  reconcileMs?: number;
  random?: () => number;
}

interface EntrySnapshot {
  state: PbxConnectionState;
  health?: PbxHealth;
  discovery?: ProviderDiscoveryResult;
}

class ProviderEntry {
  private stopped = false;
  private timer: NodeJS.Timeout | undefined;
  private operation: Promise<void> = Promise.resolve();
  private retryAttempt = 0;
  private snapshot: EntrySnapshot = { state: 'DISCONNECTED' };
  private readonly unsubscribeProviderEvents: () => void;

  constructor(
    readonly instanceId: string,
    private readonly provider: PbxProvider,
    private readonly options: Required<ProviderRuntimeOptions>,
    onEvent: ProviderEventListener,
  ) {
    this.unsubscribeProviderEvents = provider.subscribeEvents(onEvent);
  }

  start(): void {
    this.schedule(0, 'connect');
  }

  status(): EntrySnapshot {
    return {
      state: this.snapshot.state,
      ...(this.snapshot.health ? { health: structuredClone(this.snapshot.health) } : {}),
      ...(this.snapshot.discovery ? { discovery: structuredClone(this.snapshot.discovery) } : {}),
    };
  }

  async verify(): Promise<ProviderDiscoveryResult> {
    return this.enqueue(async () => {
      this.clearTimer();
      if (this.stopped) throw new ProviderRuntimeError('PROVIDER_FAILED');
      try {
        if (this.snapshot.state !== 'CONNECTED') {
          await this.connectProvider();
        }
        const discovery = await this.provider.discover();
        this.snapshot.discovery = discovery;
        await this.refreshHealth();
        this.retryAttempt = 0;
        this.schedule(this.options.reconcileMs, 'reconcile');
        return discovery;
      } catch {
        await this.failAndScheduleReconnect();
        throw new ProviderRuntimeError('PROVIDER_FAILED');
      }
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimer();
    await this.enqueue(async () => {
      try {
        await this.provider.disconnect();
      } catch {
        // Shutdown is best-effort; callers receive the final disconnected snapshot.
      }
      this.snapshot.state = 'DISCONNECTED';
      try {
        this.snapshot.health = await this.provider.getHealth();
      } catch {
        delete this.snapshot.health;
      }
      this.unsubscribeProviderEvents();
    });
  }

  private schedule(delayMs: number, operation: 'connect' | 'reconcile'): void {
    if (this.stopped) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.enqueue(async () => {
        if (this.stopped) return;
        if (operation === 'connect') await this.connectCycle();
        else await this.reconcileCycle();
      });
    }, delayMs);
    this.timer.unref();
  }

  private async connectCycle(): Promise<void> {
    try {
      await this.connectProvider();
      this.retryAttempt = 0;
      this.schedule(this.options.reconcileMs, 'reconcile');
    } catch {
      await this.failAndScheduleReconnect();
    }
  }

  private async reconcileCycle(): Promise<void> {
    try {
      await this.provider.reconcile();
      await this.refreshHealth();
      this.retryAttempt = 0;
      this.schedule(this.options.reconcileMs, 'reconcile');
    } catch {
      await this.failAndScheduleReconnect();
    }
  }

  private async connectProvider(): Promise<void> {
    await this.provider.connect();
    await this.refreshHealth();
  }

  private async failAndScheduleReconnect(): Promise<void> {
    try {
      await this.refreshHealth();
    } catch {
      // Keep the last known snapshot when provider health cannot be read.
    }
    try {
      await this.provider.disconnect();
    } catch {
      // Provider failures remain isolated from application readiness.
    }
    if (this.stopped) return;
    const exponential = Math.min(
      this.options.reconnectBaseMs * 2 ** this.retryAttempt,
      this.options.reconnectMaxMs,
    );
    this.retryAttempt = Math.min(this.retryAttempt + 1, 30);
    const jitter = 0.8 + this.options.random() * 0.4;
    this.schedule(Math.max(1, Math.round(exponential * jitter)), 'connect');
  }

  private async refreshHealth(): Promise<void> {
    const health = await this.provider.getHealth();
    this.snapshot.health = health;
    this.snapshot.state = health.connection.state;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const run = this.operation.then(action, action);
    this.operation = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export interface VerifyResult {
  discovery: ProviderDiscoveryResult;
  health: PbxHealth;
}

export class ProviderRuntimeManager {
  private readonly entries = new Map<string, ProviderEntry>();
  private readonly testing = new Set<string>();
  private readonly eventListeners = new Set<ProviderEventListener>();
  private started = false;
  private readonly options: Required<ProviderRuntimeOptions>;

  constructor(
    private readonly storage: AppStorage,
    private readonly secrets: SecretStore,
    private readonly factory: ProviderFactory | undefined,
    options: ProviderRuntimeOptions = {},
  ) {
    this.options = {
      reconnectBaseMs: options.reconnectBaseMs ?? 1000,
      reconnectMaxMs: options.reconnectMaxMs ?? 60_000,
      reconcileMs: options.reconcileMs ?? 45_000,
      random: options.random ?? Math.random,
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const profile of this.storage.pbxProfiles.list()) this.activate(profile);
  }

  async stop(): Promise<void> {
    this.started = false;
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(entries.map((entry) => entry.stop()));
  }

  async syncProfile(id: string): Promise<void> {
    const current = this.entries.get(id);
    if (current) {
      this.entries.delete(id);
      await current.stop();
    }
    if (!this.started) return;
    const profile = this.storage.pbxProfiles.get(id);
    if (profile) this.activate(profile);
  }

  async remove(id: string): Promise<void> {
    const current = this.entries.get(id);
    if (!current) return;
    this.entries.delete(id);
    await current.stop();
  }

  subscribeEvents(listener: ProviderEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  connectionState(id: string): PbxConnectionState {
    const active = this.entries.get(id)?.status().state;
    if (active) return active;
    return this.storage.pbxProfiles.get(id)?.lastVerifiedAt ? 'DISCONNECTED' : 'UNVERIFIED';
  }

  status(id: string): { managed: boolean; networkEnabled: boolean; snapshot?: EntrySnapshot } {
    const entry = this.entries.get(id);
    return {
      managed: entry !== undefined,
      networkEnabled: this.factory !== undefined,
      ...(entry ? { snapshot: entry.status() } : {}),
    };
  }

  async verify(id: string): Promise<VerifyResult> {
    if (!this.factory) throw new ProviderRuntimeError('NETWORK_DISABLED');
    const profile = this.storage.pbxProfiles.get(id);
    if (!profile) throw new ProviderRuntimeError('NOT_FOUND');
    if (!this.secrets.hasSecret(id, AMI_SECRET))
      throw new ProviderRuntimeError('CREDENTIAL_MISSING');
    if (this.testing.has(id)) throw new ProviderRuntimeError('BUSY');

    this.testing.add(id);
    try {
      const managed = this.entries.get(id);
      const discovery = managed ? await managed.verify() : await this.verifyEphemeral(profile);
      this.storage.transaction(() => {
        this.storage.pbxInstances.save(discovery.metadata);
        this.storage.pbxProfiles.markVerified(id, discovery.observedAt);
        this.storage.setup.set('COMPLETE');
      });
      const health = managed
        ? managed.status().health
        : {
            instanceId: id,
            connection: { state: 'DISCONNECTED' as const },
            sources: {},
          };
      if (!health) throw new ProviderRuntimeError('PROVIDER_FAILED');
      return { discovery, health };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) throw error;
      throw new ProviderRuntimeError('PROVIDER_FAILED');
    } finally {
      this.testing.delete(id);
    }
  }

  private activate(profile: PbxProfileRecord): void {
    if (!this.factory || !profile.enabled || !this.secrets.hasSecret(profile.id, AMI_SECRET))
      return;
    const entry = new ProviderEntry(
      profile.id,
      this.factory.create(profile),
      this.options,
      (event) => this.emitEvent(event),
    );
    this.entries.set(profile.id, entry);
    entry.start();
  }

  private emitEvent(event: ProviderEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(structuredClone(event));
      } catch {
        // Runtime event consumers are isolated from PBX connection lifecycles.
      }
    }
  }

  private async verifyEphemeral(profile: PbxProfileRecord): Promise<ProviderDiscoveryResult> {
    const provider = this.factory!.create(profile);
    try {
      await provider.connect();
      return await provider.discover();
    } catch {
      throw new ProviderRuntimeError('PROVIDER_FAILED');
    } finally {
      try {
        await provider.disconnect();
      } catch {
        // One-shot verification cleanup must not expose transport details.
      }
    }
  }
}
