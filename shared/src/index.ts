/** Stable identifiers are assigned by the future persistence layer. */
export type PbxInstanceId = string;
export type PbxProviderType = 'ASTERISK';
export type PbxConnectionState =
  'UNVERIFIED' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
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

export interface ProviderEventBase {
  instanceId: PbxInstanceId;
  source: 'AMI';
  observedAt: string;
}

export type ProviderEvent =
  | (ProviderEventBase & {
      type: 'CHANNEL_CREATED';
      channelId: string;
      channelName?: string;
      linkedId?: string;
      state?: string;
    })
  | (ProviderEventBase & {
      type: 'CHANNEL_STATE_CHANGED';
      channelId: string;
      channelName?: string;
      linkedId?: string;
      state: string;
    })
  | (ProviderEventBase & {
      type: 'CHANNEL_DESTROYED';
      channelId: string;
      channelName?: string;
      linkedId?: string;
      cause?: string;
      causeText?: string;
    })
  | (ProviderEventBase & {
      type: 'DIAL_STARTED';
      sourceChannelId: string;
      destinationChannelId?: string;
      linkedId?: string;
      dialString?: string;
    })
  | (ProviderEventBase & {
      type: 'DIAL_ENDED';
      sourceChannelId: string;
      destinationChannelId?: string;
      linkedId?: string;
      dialStatus?: string;
    })
  | (ProviderEventBase & {
      type: 'BRIDGE_ENTERED' | 'BRIDGE_LEFT';
      bridgeId: string;
      channelId: string;
      channelName?: string;
      linkedId?: string;
    })
  | (ProviderEventBase & {
      type: 'ENDPOINT_STATUS_CHANGED';
      endpointId: string;
      status: string;
    });

export type ProviderEventListener = (event: ProviderEvent) => void;

export interface ProviderChannelSnapshot {
  channelId: string;
  channelName?: string;
  linkedId?: string;
  state?: string;
  bridgeId?: string;
}

export interface ProviderStateSnapshot {
  instanceId: PbxInstanceId;
  source: 'AMI';
  observedAt: string;
  channels: ProviderChannelSnapshot[];
}

export type ProviderStateSnapshotListener = (snapshot: ProviderStateSnapshot) => void;

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
  getCurrentState(): Promise<ProviderStateSnapshot>;
  /** Runtime owners register before connect so the provider can enable its event stream. */
  subscribeEvents(listener: ProviderEventListener): () => void;
  reconcile(): Promise<ProviderStateSnapshot>;
}
