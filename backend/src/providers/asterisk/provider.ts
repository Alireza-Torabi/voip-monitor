import type {
  CapabilityState,
  DataSourceHealth,
  PbxCapabilities,
  PbxConnectionState,
  PbxHealth,
  PbxProvider,
  ProviderDiscoveryResult,
  ProviderErrorCode,
} from '@voip-monitor/shared';
import { AsteriskConnection, type AddressResolver } from './connection.js';
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
 * Provider connection/discovery foundation.
 *
 * The runtime application does not instantiate this provider yet. A later task
 * will own lifecycle/reconnect and event subscriptions per enabled PBX.
 */
export class AsteriskProvider implements PbxProvider {
  readonly instanceId: string;
  private readonly connection: AsteriskConnection;
  private readonly capabilities = unknownCapabilities();
  private connectionState: PbxConnectionState = 'DISCONNECTED';
  private lastChangedAt: string;
  private amiHealth: DataSourceHealth = {
    source: 'AMI',
    freshness: 'NEVER_COLLECTED',
  };

  constructor(private readonly options: AsteriskProviderOptions) {
    this.instanceId = options.instanceId;
    this.connection = new AsteriskConnection(options.resolver, options.transport);
    this.lastChangedAt = this.now();
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
            Events: 'off',
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

  async reconcile(): Promise<void> {
    this.requireConnected();
    const attempt = this.now();
    try {
      const response = await this.options.transport.request({ action: 'Ping' });
      requireSuccess(response);
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
      this.markOperationFailure(attempt, error);
      throw new AsteriskProviderError(providerCode(error));
    }
  }

  private requireConnected(): void {
    if (!this.options.transport.connected || this.connectionState !== 'CONNECTED') {
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
