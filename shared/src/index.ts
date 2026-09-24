/** Stable identifiers are assigned by the future persistence layer. */
export type PbxInstanceId = string;
export type PbxProviderType = 'ASTERISK';
export type PbxConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
export type DataFreshnessState = 'NEVER_COLLECTED' | 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'ERROR';
export type CapabilityState =
  'SUPPORTED' | 'UNSUPPORTED' | 'NOT_CONFIGURED' | 'PERMISSION_DENIED' | 'UNKNOWN';

export interface PbxCapabilities {
  telephony: {
    channels: CapabilityState;
    calls: CapabilityState;
    endpoints: CapabilityState;
    trunks: CapabilityState;
    queues: CapabilityState;
    agents: CapabilityState;
  };
  system: {
    cpu: CapabilityState;
    memory: CapabilityState;
    filesystems: CapabilityState;
    uptime: CapabilityState;
    services: CapabilityState;
  };
  security: {
    authenticationEvents: CapabilityState;
  };
}

export type DataSourceType = 'PROVIDER' | 'AMI' | 'SSH' | 'SECURITY_LOG';
export type ProviderErrorCode =
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

/** Codes are deliberately bounded; raw provider errors and their messages stay private. */
export interface SafeErrorSummary {
  code: ProviderErrorCode;
}

export interface ProviderError extends SafeErrorSummary {
  source: DataSourceType;
  occurredAt: string;
}

/** Timestamps are ISO 8601 UTC strings. Omitted timestamps mean no observation exists. */
export interface DataSourceHealth {
  source: DataSourceType;
  freshness: DataFreshnessState;
  lastAttempt?: string;
  lastSuccess?: string;
  lastUpdate?: string;
  error?: SafeErrorSummary;
}

export interface ProviderConnectionHealth {
  state: PbxConnectionState;
  lastChangedAt?: string;
  error?: SafeErrorSummary;
}

export interface PbxInstanceMetadata {
  id: PbxInstanceId;
  providerType: PbxProviderType;
  displayName: string;
  product?: string;
  version?: string;
  timezone?: string;
}

export interface PbxHealth {
  instanceId: PbxInstanceId;
  connection: ProviderConnectionHealth;
  sources: Partial<Record<DataSourceType, DataSourceHealth>>;
}

export interface ProviderDiscoveryResult {
  metadata: PbxInstanceMetadata;
  capabilities: PbxCapabilities;
  observedAt: string;
}

/** Provider implementations own their connection and never take browser-specific requests. */
export interface PbxProvider {
  readonly instanceId: PbxInstanceId;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  discover(): Promise<ProviderDiscoveryResult>;
  getCapabilities(): Promise<PbxCapabilities>;
  getHealth(): Promise<PbxHealth>;
  reconcile(): Promise<void>;
}
