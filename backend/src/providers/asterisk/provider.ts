import type {
  CapabilityState,
  DataSourceHealth,
  PbxCapabilities,
  PbxConnectionState,
  PbxHealth,
  PbxProvider,
  ProviderEventListener,
  ProviderDiscoveryResult,
  ProviderErrorCode,
  ProviderStateSnapshot,
} from '@voip-monitor/shared';
import { AsteriskConnection, type AddressResolver } from './connection.js';
import { normalizeAmiEvent } from './events.js';
import { AmiTransportError, amiField, type AmiResponse, type AmiTransport } from './transport.js';

const UNKNOWN: CapabilityState = 'UNKNOWN';

function unknownCapabilities(): PbxCapabilities {
  return {
    telephony: {
      channels: UNKNOWN,
      calls: UNKNOWN,
      endpoints: UNKNOWN,
      trunks: UNKNOWN,
      queues: UNKNOWN,
      agents: UNKNOWN,
    },
    system: {
      cpu: UNKNOWN,
      memory: UNKNOWN,
      filesystems: UNKNOWN,
      uptime: UNKNOWN,
      services: UNKNOWN,
    },
    security: {
      authenticationEvents: UNKNOWN,
    },
  };
}

function cloneCapabilities(capabilities: PbxCapabilities): PbxCapabilities {
  return {
    telephony: { ...capabilities.telephony },
    system: { ...capabilities.system },
    security: { ...capabilities.security },
  };
}

function providerCode(error: unknown): ProviderErrorCode {
  if (error instanceof AsteriskProviderError) return error.code;
  if (error instanceof AmiTransportError && error.code === 'TIMEOUT') return 'TIMEOUT';
  if (error instanceof AmiTransportError) return 'CONNECTION_FAILED';
  return 'UNKNOWN';
}

function requireSuccess(response: AmiResponse): void {
  if (response.response.toLowerCase() !== 'success') {
    throw new AsteriskProviderError('UNKNOWN');
  }
}

export class AsteriskProviderError extends Error {
  constructor(readonly code: ProviderErrorCode) {
    super(`Asterisk provider ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'AsteriskProviderError';
  }
}

export interface AsteriskProviderOptions {
  instanceId: string;
  displayName: string;
  host: string;
  port: number;
  amiUsername: string;
  readAmiPassword: () => Buffer;
  resolver: AddressResolver;
  transport: AmiTransport;
  now?: () => Date;
}

/**
 * Asterisk provider connection, discovery, reconciliation, and event normalization.
 *
 * Runtime lifecycle remains outside the provider so one provider instance is
 * owned per enabled PBX rather than per browser.
 */
export class AsteriskProvider implements PbxProvider {
  readonly instanceId: string;
  private readonly connection: AsteriskConnection;
  private readonly capabilities = unknownCapabilities();
  private connectionState: PbxConnectionState = 'DISCONNECTED';
  private lastChangedAt: string;
  private readonly eventListeners = new Set<ProviderEventListener>();
  private amiHealth: DataSourceHealth = {
    source: 'AMI',
    freshness: 'NEVER_COLLECTED',
  };

  constructor(private readonly options: AsteriskProviderOptions) {
    this.instanceId = options.instanceId;
    this.connection = new AsteriskConnection(options.resolver, options.transport);
    this.lastChangedAt = this.now();
    options.transport.subscribeEvents((event) => {
      const observedAt = this.now();
      const normalized = normalizeAmiEvent(this.instanceId, event, observedAt);
      if (!normalized) return;
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        ...(this.amiHealth.lastAttempt ? { lastAttempt: this.amiHealth.lastAttempt } : {}),
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      for (const listener of this.eventListeners) {
        try {
          listener(normalized);
        } catch {
          // Event consumers are isolated from provider connection processing.
        }
      }
    });
  }

  async connect(): Promise<void> {
    const attempt = this.now();
    this.setConnectionState('CONNECTING');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'NEVER_COLLECTED',
      lastAttempt: attempt,
    };

    try {
      await this.connection.connect({ host: this.options.host, port: this.options.port });
      const password = this.options.readAmiPassword();
      if (password.length === 0) throw new AsteriskProviderError('AUTHENTICATION_FAILED');
      let passwordText = '';
      try {
        passwordText = password.toString('utf8');
        if (passwordText.includes('\r') || passwordText.includes('\n')) {
          throw new AsteriskProviderError('AUTHENTICATION_FAILED');
        }
        const login = await this.options.transport.request({
          action: 'Login',
          fields: {
            Username: this.options.amiUsername,
            Secret: passwordText,
            Events: this.eventListeners.size > 0 ? 'on' : 'off',
          },
        });
        if (login.response.toLowerCase() !== 'success') {
          throw new AsteriskProviderError('AUTHENTICATION_FAILED');
        }
      } finally {
        password.fill(0);
        passwordText = '';
      }

      const success = this.now();
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: success,
        lastUpdate: success,
      };
    } catch (error) {
      const code = providerCode(error);
      await this.connection.disconnect().catch(() => undefined);
      this.setConnectionState('ERROR');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'ERROR',
        lastAttempt: attempt,
        error: { code },
      };
      throw new AsteriskProviderError(code);
    }
  }

  async disconnect(): Promise<void> {
    if (this.options.transport.connected) {
      try {
        await this.options.transport.request({ action: 'Logoff' });
      } catch {
        // The socket can close while Asterisk processes Logoff.
      }
    }
    await this.connection.disconnect();
    this.setConnectionState('DISCONNECTED');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'UNAVAILABLE',
      ...(this.amiHealth.lastAttempt ? { lastAttempt: this.amiHealth.lastAttempt } : {}),
      ...(this.amiHealth.lastSuccess ? { lastSuccess: this.amiHealth.lastSuccess } : {}),
      ...(this.amiHealth.lastUpdate ? { lastUpdate: this.amiHealth.lastUpdate } : {}),
    };
  }

  async discover(): Promise<ProviderDiscoveryResult> {
    this.requireConnected();
    const attempt = this.now();
    try {
      const response = await this.options.transport.request({ action: 'CoreSettings' });
      requireSuccess(response);
      const version = amiField(response.fields, 'AsteriskVersion');
      const observedAt = this.now();
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      return {
        metadata: {
          id: this.instanceId,
          providerType: 'ASTERISK',
          displayName: this.options.displayName,
          product: 'Asterisk',
          ...(version ? { version } : {}),
        },
        capabilities: cloneCapabilities(this.capabilities),
        observedAt,
      };
    } catch (error) {
      this.markOperationFailure(attempt, error);
      throw new AsteriskProviderError(providerCode(error));
    }
  }

  async getCapabilities(): Promise<PbxCapabilities> {
    return cloneCapabilities(this.capabilities);
  }

  async getCurrentState(): Promise<ProviderStateSnapshot> {
    this.requireConnected();
    const attempt = this.now();
    try {
      const result = await this.options.transport.requestEventList(
        { action: 'CoreShowChannels' },
        { itemEvent: 'CoreShowChannel', completeEvent: 'CoreShowChannelsComplete' },
      );
      requireSuccess(result.response);

      const channels = result.events.map((event) => {
        const channelId = amiField(event.fields, 'Uniqueid')?.trim();
        if (!channelId) throw new AsteriskProviderError('UNKNOWN');
        const channelName = amiField(event.fields, 'Channel')?.trim();
        const linkedId = amiField(event.fields, 'Linkedid')?.trim();
        const state =
          amiField(event.fields, 'ChannelStateDesc')?.trim() ||
          amiField(event.fields, 'ChannelState')?.trim();
        const bridgeId = amiField(event.fields, 'BridgeId')?.trim();
        return {
          channelId,
          ...(channelName ? { channelName } : {}),
          ...(linkedId ? { linkedId } : {}),
          ...(state ? { state } : {}),
          ...(bridgeId ? { bridgeId } : {}),
        };
      });

      const listItems = amiField(result.completion.fields, 'ListItems')?.trim();
      if (listItems !== undefined) {
        if (!/^[0-9]+$/.test(listItems) || Number(listItems) !== channels.length) {
          throw new AsteriskProviderError('UNKNOWN');
        }
      }

      const observedAt = this.now();
      this.capabilities.telephony.channels = 'SUPPORTED';
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      return {
        instanceId: this.instanceId,
        source: 'AMI',
        observedAt,
        channels,
      };
    } catch (error) {
      this.markOperationFailure(attempt, error);
      throw new AsteriskProviderError(providerCode(error));
    }
  }

  subscribeEvents(listener: ProviderEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  async getHealth(): Promise<PbxHealth> {
    return {
      instanceId: this.instanceId,
      connection: {
        state: this.connectionState,
        lastChangedAt: this.lastChangedAt,
        ...(this.amiHealth.error ? { error: { ...this.amiHealth.error } } : {}),
      },
      sources: {
        AMI: {
          ...this.amiHealth,
          ...(this.amiHealth.error ? { error: { ...this.amiHealth.error } } : {}),
        },
      },
    };
  }

  async reconcile(): Promise<ProviderStateSnapshot> {
    return this.getCurrentState();
  }

  private requireConnected(): void {
    if (
      !this.options.transport.connected ||
      (this.connectionState !== 'CONNECTED' && this.connectionState !== 'DEGRADED')
    ) {
      throw new AsteriskProviderError('CONNECTION_FAILED');
    }
  }

  private markOperationFailure(attempt: string, error: unknown): void {
    const code = providerCode(error);
    this.setConnectionState(this.options.transport.connected ? 'DEGRADED' : 'ERROR');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'ERROR',
      lastAttempt: attempt,
      ...(this.amiHealth.lastSuccess ? { lastSuccess: this.amiHealth.lastSuccess } : {}),
      ...(this.amiHealth.lastUpdate ? { lastUpdate: this.amiHealth.lastUpdate } : {}),
      error: { code },
    };
  }

  private setConnectionState(state: PbxConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.lastChangedAt = this.now();
  }

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}
