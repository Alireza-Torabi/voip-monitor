/** Stable identifiers are assigned by the future persistence layer. */
export type PbxInstanceId = string;
export type PbxProviderType = 'ASTERISK';
export type PbxConnectionState =
  'UNVERIFIED' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
export type DataFreshnessState = 'NEVER_COLLECTED' | 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'ERROR';
export type CapabilityState =
  'SUPPORTED' | 'UNSUPPORTED' | 'NOT_CONFIGURED' | 'PERMISSION_DENIED' | 'UNKNOWN';
export type EndpointRegistrationState = 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
export type EndpointReachability = 'REACHABLE' | 'UNREACHABLE' | 'UNKNOWN';
export type TrunkKind = 'OUTBOUND_REGISTRATION';
export type TrunkRegistrationState =
  'REGISTERED' | 'UNREGISTERED' | 'REGISTERING' | 'REJECTED' | 'FAILED' | 'UNKNOWN';
export type QueueMemberAvailability =
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'IN_USE'
  | 'BUSY'
  | 'INVALID'
  | 'UNAVAILABLE'
  | 'RINGING'
  | 'RINGING_IN_USE'
  | 'ON_HOLD';
export type AgentInteractionPhase = 'RINGING' | 'CONNECTED';
export type AgentCompletionReason = 'CALLER' | 'AGENT' | 'TRANSFER' | 'UNKNOWN';

export type SystemServiceState = 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'UNKNOWN';

export interface SystemCpuSample {
  utilizationPercent: number;
}

export interface SystemMemorySample {
  totalBytes: number;
  availableBytes: number;
}

export interface SystemFilesystemSample {
  filesystemId: string;
  mountPoint: string;
  totalBytes: number;
  availableBytes: number;
}

export interface SystemUptimeSample {
  uptimeSeconds: number;
}

export interface SystemServiceHealthSample {
  serviceId: string;
  state: SystemServiceState;
}

export interface SystemMetricCapabilities {
  cpu: CapabilityState;
  memory: CapabilityState;
  filesystems: CapabilityState;
  uptime: CapabilityState;
  services: CapabilityState;
}

export interface SystemMetricsSample {
  instanceId: PbxInstanceId;
  source: 'SSH';
  observedAt: string;
  capabilities: SystemMetricCapabilities;
  cpu?: SystemCpuSample;
  memory?: SystemMemorySample;
  filesystems?: SystemFilesystemSample[];
  uptime?: SystemUptimeSample;
  services?: SystemServiceHealthSample[];
}

export interface PbxCapabilities {
  telephony: {
    channels: CapabilityState;
    calls: CapabilityState;
    endpoints: CapabilityState;
    trunks: CapabilityState;
    queues: CapabilityState;
    agents: CapabilityState;
  };
  system: SystemMetricCapabilities;
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
  /** Monotonic order within one provider connection when the transport can supply it. */
  streamGeneration?: number;
  streamSequence?: number;
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
      registrationState: EndpointRegistrationState;
      reachability: EndpointReachability;
    })
  | (ProviderEventBase & {
      type: 'TRUNK_REGISTRATION_CHANGED';
      trunkId: string;
      kind: TrunkKind;
      registrationState: TrunkRegistrationState;
    })
  | (ProviderEventBase & {
      type: 'QUEUE_MEMBER_CHANGED';
      queueId: string;
      memberId: string;
      memberName?: string;
      availability: QueueMemberAvailability;
      paused: boolean;
      inCall: boolean;
    })
  | (ProviderEventBase & {
      type: 'QUEUE_MEMBER_REMOVED';
      queueId: string;
      memberId: string;
    })
  | (ProviderEventBase & {
      type: 'QUEUE_CALLER_JOINED';
      queueId: string;
      callerId: string;
      position?: number;
    })
  | (ProviderEventBase & {
      type: 'QUEUE_CALLER_LEFT';
      queueId: string;
      callerId: string;
      disposition: 'LEFT' | 'ABANDONED';
    })
  | (ProviderEventBase & {
      type: 'AGENT_CALLED';
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
    })
  | (ProviderEventBase & {
      type: 'AGENT_RING_NO_ANSWER';
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
    })
  | (ProviderEventBase & {
      type: 'AGENT_CONNECTED';
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
    })
  | (ProviderEventBase & {
      type: 'AGENT_COMPLETED';
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
      reason: AgentCompletionReason;
    })
  | (ProviderEventBase & {
      type: 'AGENT_DUMPED';
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
    });

export type ProviderEventListener = (event: ProviderEvent) => void;

export interface ProviderChannelSnapshot {
  channelId: string;
  channelName?: string;
  linkedId?: string;
  state?: string;
  bridgeId?: string;
  /** Sequence of the source snapshot item within the provider connection. */
  streamSequence?: number;
}

export interface ProviderEndpointSnapshot {
  endpointId: string;
  registrationState: EndpointRegistrationState;
  reachability: EndpointReachability;
  /** Sequence of the source snapshot item within the provider connection. */
  streamSequence?: number;
}

export interface ProviderEndpointStateSnapshot {
  capability: CapabilityState;
  startedAt?: string;
  observedAt: string;
  streamGeneration?: number;
  streamStartedSequence?: number;
  endpoints: ProviderEndpointSnapshot[];
}

export interface ProviderTrunkSnapshot {
  trunkId: string;
  kind: TrunkKind;
  registrationState: TrunkRegistrationState;
  /** Sequence of the source snapshot item within the provider connection. */
  streamSequence?: number;
}

export interface ProviderTrunkStateSnapshot {
  capability: CapabilityState;
  startedAt?: string;
  observedAt: string;
  streamGeneration?: number;
  streamStartedSequence?: number;
  trunks: ProviderTrunkSnapshot[];
}

export interface ProviderQueueSnapshot {
  queueId: string;
  strategy?: string;
  streamSequence?: number;
}

export interface ProviderQueueMemberSnapshot {
  queueId: string;
  memberId: string;
  memberName?: string;
  availability: QueueMemberAvailability;
  paused: boolean;
  inCall: boolean;
  streamSequence?: number;
}

export interface ProviderQueueCallerSnapshot {
  queueId: string;
  callerId: string;
  position?: number;
  waitSeconds?: number;
  streamSequence?: number;
}

export interface ProviderQueueStateSnapshot {
  capability: CapabilityState;
  startedAt?: string;
  observedAt: string;
  streamGeneration?: number;
  streamStartedSequence?: number;
  queues: ProviderQueueSnapshot[];
  members: ProviderQueueMemberSnapshot[];
  callers: ProviderQueueCallerSnapshot[];
}

export interface ProviderStateSnapshot {
  instanceId: PbxInstanceId;
  source: 'AMI';
  /** Snapshot collection start time; used to reconcile events buffered during collection. */
  startedAt?: string;
  observedAt: string;
  streamGeneration?: number;
  streamStartedSequence?: number;
  channels: ProviderChannelSnapshot[];
  endpointState?: ProviderEndpointStateSnapshot;
  trunkState?: ProviderTrunkStateSnapshot;
  queueState?: ProviderQueueStateSnapshot;
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
