import type {
  DashboardRefreshRates,
  EndpointReliabilityState,
  FleetOverviewSnapshot,
  HistoricalCallOutcomeAnalytics,
  HistoricalReportWindow,
  HistoricalQueueAbandonmentAnalytics,
  HistoricalQueueCallDetailChunk,
  HistoricalQueuePerformanceReport,
  OperationalHealthSnapshot,
  TrunkReliabilityState,
} from '@voip-monitor/shared';
export interface Principal {
  id: string;
  username: string;
}

export interface AdministratorAccount {
  id: string;
  username: string;
  enabled: boolean;
  role: 'ADMINISTRATOR';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
export type PbxConnectionState =
  'UNVERIFIED' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';

export interface PbxProfile {
  id: string;
  displayName: string;
  providerType: 'ASTERISK';
  enabled: boolean;
  amiHost: string;
  amiPort: number;
  amiUsername: string;
  hasAmiPassword: boolean;
  connectionStatus: PbxConnectionState;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SecurityAlertRuleId = 'AUTHENTICATION_FAILURE_ANY' | 'AUTHENTICATION_FAILURE_THRESHOLD';
export type SecurityAlertReason =
  | 'INVALID_ACCOUNT'
  | 'INVALID_PASSWORD'
  | 'CHALLENGE_RESPONSE_FAILED'
  | 'ACL_FAILURE'
  | 'UNEXPECTED_ADDRESS'
  | 'UNKNOWN';
export type SecurityAlertRuleConfig =
  | { instanceId: string; id: 'AUTHENTICATION_FAILURE_ANY'; enabled: boolean }
  | {
      instanceId: string;
      id: 'AUTHENTICATION_FAILURE_THRESHOLD';
      enabled: boolean;
      threshold: number;
      windowSeconds: number;
      reason?: SecurityAlertReason;
    };
export interface SecurityAlertRecord {
  instanceId: string;
  ruleId: SecurityAlertRuleId;
  observedAt: string;
  matchedEventCount: number;
  streamGeneration?: number;
  streamSequence?: number;
}

export type DataFreshnessState = 'NEVER_COLLECTED' | 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'ERROR';

export interface DataSourceHealth {
  source: 'SSH';
  freshness: DataFreshnessState;
  lastAttempt?: string;
  lastSuccess?: string;
  lastUpdate?: string;
  error?: { code: string };
}

export interface SystemMetricsSample {
  instanceId: string;
  source: 'SSH';
  observedAt: string;
  capabilities?: {
    cpu: string;
    memory: string;
    filesystems: string;
    uptime: string;
    services: string;
  };
  cpu?: { utilizationPercent: number };
  memory?: { totalBytes: number; availableBytes: number };
  filesystems?: Array<{
    filesystemId: string;
    mountPoint: string;
    totalBytes: number;
    availableBytes: number;
  }>;
  uptime?: { uptimeSeconds: number };
  services?: Array<{
    serviceId: string;
    state: 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'UNKNOWN';
  }>;
}

export interface SystemMetricsSourceStatus {
  instanceId: string;
  health: DataSourceHealth;
  consecutiveFailures: number;
}

export interface SystemMetricsResponse {
  current: SystemMetricsSample | null;
  source?: SystemMetricsSourceStatus;
}

export interface DashboardStorageConfig {
  selectedFilesystemIds: string[] | null;
}

export interface DashboardRefreshConfig {
  rates: DashboardRefreshRates;
}

export interface ServiceMonitoringConfig {
  serviceIds: string[];
}

export type DashboardWidgetType =
  | 'clock'
  | 'provider'
  | 'telephony-sync'
  | 'security-alerts'
  | 'live-state'
  | 'cpu'
  | 'memory'
  | 'endpoint-reachability'
  | 'uptime'
  | 'metrics-trend'
  | 'service-health'
  | 'queue-pressure'
  | 'storage'
  | 'calls'
  | 'channels'
  | 'endpoints'
  | 'trunks'
  | 'queues'
  | 'agents';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  width: number;
  height: number;
}

export interface DashboardDefinition {
  id: string;
  pbxInstanceId: string;
  name: string;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatus {
  connectionStatus: PbxConnectionState;
  managed: boolean;
  networkEnabled: boolean;
}

export type DatabaseDialect = 'MYSQL_MARIADB' | 'POSTGRESQL';
export type DatabaseTlsMode = 'REQUIRED' | 'DISABLED';
export interface SafeDatabaseSourceConfiguration {
  pbxInstanceId: string;
  dialect: DatabaseDialect;
  host: string;
  port: number;
  databaseName: string;
  databaseScopes: string[];
  username: string;
  accessMode: 'READ_ONLY';
  tlsMode: DatabaseTlsMode;
  hasCredential: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HistoricalDatasetAvailability =
  'SUPPORTED' | 'NOT_FOUND' | 'SCHEMA_MISMATCH' | 'AMBIGUOUS';

export interface HistoricalSourceCapabilities {
  instanceId: string;
  source: 'DATABASE';
  adapter: 'ASTERISK_CONVENTIONAL_SQL_V1';
  calls: { availability: HistoricalDatasetAvailability };
  callEvents: { availability: HistoricalDatasetAvailability };
  queueEvents: { availability: HistoricalDatasetAvailability };
  queueAbandonment: { availability: HistoricalDatasetAvailability };
  queuePerformance: { availability: HistoricalDatasetAvailability };
}

export interface HistoricalCallRecord {
  instanceId: string;
  source: 'DATABASE';
  recordId: string;
  correlationId?: string;
  sourceStartedAt: string;
  sourceNumber?: string;
  destinationNumber?: string;
  durationSeconds: number;
  billableSeconds: number;
  disposition: 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'UNKNOWN';
}

export interface HistoricalCallEventRecord {
  instanceId: string;
  source: 'DATABASE';
  sourceOccurredAt: string;
  eventType: string;
  callId: string;
  correlationId?: string;
  extension?: string;
  callerNumber?: string;
}

export interface HistoricalQueueEventRecord {
  instanceId: string;
  source: 'DATABASE';
  sourceOccurredAt: string;
  eventType: string;
  callId: string;
  queueId: string;
  agentId?: string;
}

export type SshAuthMethod = 'PASSWORD' | 'PRIVATE_KEY';
export interface SafeSshConfiguration {
  pbxInstanceId: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  hostKeyPolicy: 'PINNED_SHA256';
  hostKeyFingerprint: string;
  lastVerifiedAt?: string;
  hasCredential: boolean;
  hasPrivateKeyPassphrase: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TelephonySynchronization = 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE';
export type TelephonyCapabilityState =
  'SUPPORTED' | 'UNSUPPORTED' | 'NOT_CONFIGURED' | 'PERMISSION_DENIED' | 'UNKNOWN';

export interface TelephonyChannelState {
  channelId: string;
  channelName?: string;
  linkedId?: string;
  state?: string;
  bridgeId?: string;
  updatedAt: string;
}

export interface TelephonyCallState {
  callId: string;
  linkedId?: string;
  channelIds: string[];
  bridgeIds: string[];
  updatedAt: string;
}

export interface TelephonyEndpointState {
  endpointId: string;
  registrationState: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
  reachability: 'REACHABLE' | 'UNREACHABLE' | 'UNKNOWN';
  updatedAt: string;
  reliability?: EndpointReliabilityState;
}

export interface TelephonyTrunkState {
  trunkId: string;
  kind: 'OUTBOUND_REGISTRATION' | 'PEER';
  technology: 'CHAN_SIP' | 'PJSIP';
  confidence: 'CONFIRMED' | 'CANDIDATE';
  registrationState:
    | 'REGISTERED'
    | 'UNREGISTERED'
    | 'REGISTERING'
    | 'REJECTED'
    | 'FAILED'
    | 'NOT_APPLICABLE'
    | 'UNKNOWN';
  reachability?: 'REACHABLE' | 'UNREACHABLE' | 'UNKNOWN';
  updatedAt: string;
  reliability?: TrunkReliabilityState;
}

export interface TelephonyQueueState {
  queueId: string;
  strategy?: string;
  waitingCount: number;
  updatedAt: string;
}

export interface TelephonyQueueMemberState {
  queueId: string;
  memberId: string;
  memberName?: string;
  availability: string;
  paused: boolean;
  inCall: boolean;
  updatedAt: string;
}

export interface TelephonyQueueCallerState {
  queueId: string;
  callerId: string;
  position?: number;
  waitSeconds?: number;
  updatedAt: string;
}

export interface TelephonyAgentInteractionState {
  queueId: string;
  callerId: string;
  memberId: string;
  memberName?: string;
  phase: string;
  updatedAt: string;
}

export interface TelephonyInstanceState {
  instanceId: string;
  revision: number;
  synchronization: TelephonySynchronization;
  lastSnapshotAt: string;
  lastEventAt?: string;
  channels: TelephonyChannelState[];
  calls: TelephonyCallState[];
  endpointCapability: TelephonyCapabilityState;
  endpointSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  endpoints: TelephonyEndpointState[];
  trunkCapability: TelephonyCapabilityState;
  trunkSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  trunks: TelephonyTrunkState[];
  queueCapability: TelephonyCapabilityState;
  queueSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  queues: TelephonyQueueState[];
  queueMembers: TelephonyQueueMemberState[];
  queueCallers: TelephonyQueueCallerState[];
  agentCapability: TelephonyCapabilityState;
  agentSynchronization: 'LIVE_ONLY' | 'STALE';
  agentInteractions: TelephonyAgentInteractionState[];
}

export interface TelephonyStateResponse {
  current: TelephonyInstanceState | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super('Request failed');
  }
}
async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const error = (await response.json()) as { error?: unknown };
      if (typeof error.error === 'string') code = error.error;
    } catch {
      // Error bodies are intentionally optional.
    }
    throw new ApiError(response.status, code);
  }
  return (await response.json()) as T;
}
export const api = {
  setupStatus: () => request<{ adminSetupRequired: boolean }>('/setup/status'),
  createAdmin: (username: string, password: string, bootstrapToken: string) =>
    request<Principal>('/setup/admin', 'POST', { username, password, bootstrapToken }),
  login: (username: string, password: string) =>
    request<Principal>('/auth/login', 'POST', { username, password }),
  me: () => request<Principal>('/auth/me'),
  listAccounts: () => request<{ items: AdministratorAccount[] }>('/api/admin/accounts'),
  createAccount: (username: string, password: string) =>
    request<AdministratorAccount>('/api/admin/accounts', 'POST', { username, password }),
  updateAccount: (id: string, username: string, enabled: boolean) =>
    request<AdministratorAccount>(`/api/admin/accounts/${id}`, 'PUT', { username, enabled }),
  resetAccountPassword: (id: string, password: string) =>
    request<{ status: string }>(`/api/admin/accounts/${id}/password`, 'PUT', { password }),
  deleteAccount: (id: string) => request<{ status: string }>(`/api/admin/accounts/${id}`, 'DELETE'),
  logout: () => request<{ status: string }>('/auth/logout', 'POST'),
  listPbx: () => request<{ items: PbxProfile[] }>('/api/pbx-instances'),
  fleetOverview: () => request<FleetOverviewSnapshot>('/api/fleet-overview'),
  providerStatus: (id: string) =>
    request<ProviderStatus>(`/api/pbx-instances/${id}/provider-status`),
  operationalHealth: (id: string) =>
    request<OperationalHealthSnapshot>(`/api/pbx-instances/${id}/operational-health`),
  systemMetrics: (id: string) =>
    request<SystemMetricsResponse>(`/api/pbx-instances/${id}/system-metrics`),
  dashboardStorage: (id: string) =>
    request<DashboardStorageConfig>(`/api/pbx-instances/${id}/dashboard-storage`),
  putDashboardStorage: (id: string, selectedFilesystemIds: string[]) =>
    request<DashboardStorageConfig>(`/api/pbx-instances/${id}/dashboard-storage`, 'PUT', {
      selectedFilesystemIds,
    }),
  resetDashboardStorage: (id: string) =>
    request<DashboardStorageConfig>(`/api/pbx-instances/${id}/dashboard-storage`, 'DELETE'),
  dashboardRefresh: (id: string) =>
    request<DashboardRefreshConfig>(`/api/pbx-instances/${id}/dashboard-refresh`),
  putDashboardRefresh: (id: string, rates: DashboardRefreshRates) =>
    request<DashboardRefreshConfig>(`/api/pbx-instances/${id}/dashboard-refresh`, 'PUT', rates),
  resetDashboardRefresh: (id: string) =>
    request<DashboardRefreshConfig>(`/api/pbx-instances/${id}/dashboard-refresh`, 'DELETE'),
  serviceMonitoring: (id: string) =>
    request<ServiceMonitoringConfig>(`/api/pbx-instances/${id}/service-monitoring`),
  putServiceMonitoring: (id: string, serviceIds: string[]) =>
    request<ServiceMonitoringConfig>(`/api/pbx-instances/${id}/service-monitoring`, 'PUT', {
      serviceIds,
    }),
  resetServiceMonitoring: (id: string) =>
    request<ServiceMonitoringConfig>(`/api/pbx-instances/${id}/service-monitoring`, 'DELETE'),
  listDashboards: (id: string) =>
    request<{ items: DashboardDefinition[] }>(`/api/pbx-instances/${id}/dashboards`),
  createDashboard: (id: string, name: string, widgets: DashboardWidget[]) =>
    request<DashboardDefinition>(`/api/pbx-instances/${id}/dashboards`, 'POST', { name, widgets }),
  updateDashboard: (id: string, dashboardId: string, name: string, widgets: DashboardWidget[]) =>
    request<DashboardDefinition>(`/api/pbx-instances/${id}/dashboards/${dashboardId}`, 'PUT', {
      name,
      widgets,
    }),
  deleteDashboard: (id: string, dashboardId: string) =>
    request<{ status: string }>(`/api/pbx-instances/${id}/dashboards/${dashboardId}`, 'DELETE'),
  systemMetricsHistory: (id: string, from: string, to: string, limit = 120) =>
    request<{ items: SystemMetricsSample[] }>(
      `/api/pbx-instances/${id}/system-metrics/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`,
    ),
  databaseSource: (id: string) =>
    request<SafeDatabaseSourceConfiguration>(`/api/pbx-instances/${id}/database-source`),
  putDatabaseSource: (id: string, value: object) =>
    request<SafeDatabaseSourceConfiguration>(
      `/api/pbx-instances/${id}/database-source`,
      'PUT',
      value,
    ),
  deleteDatabaseSource: (id: string) =>
    request<{ status: string }>(`/api/pbx-instances/${id}/database-source`, 'DELETE'),
  historyCapabilities: (id: string) =>
    request<HistoricalSourceCapabilities>(`/api/pbx-instances/${id}/history`),
  historyCalls: (id: string, limit = 100) =>
    request<{ items: HistoricalCallRecord[] }>(
      `/api/pbx-instances/${id}/history/calls?limit=${limit}`,
    ),
  historyCallOutcomes: (id: string, window: HistoricalReportWindow) =>
    request<HistoricalCallOutcomeAnalytics>(
      `/api/pbx-instances/${id}/history/call-outcomes?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`,
    ),
  historyQueueOptions: (id: string) =>
    request<{ items: string[] }>(`/api/pbx-instances/${id}/history/queue-options`),
  historyQueuePerformanceDetails: (
    id: string,
    queueIds: readonly string[],
    window: HistoricalReportWindow,
    reportTo: string,
  ) => {
    const parameters = new URLSearchParams({
      from: window.from,
      to: window.to,
      reportTo,
    });
    for (const queueId of queueIds) parameters.append('queue', queueId);
    return request<HistoricalQueueCallDetailChunk>(
      `/api/pbx-instances/${id}/history/queue-performance-details?${parameters.toString()}`,
    );
  },
  historyQueuePerformance: (
    id: string,
    queueIds: readonly string[],
    window: HistoricalReportWindow,
  ) => {
    const parameters = new URLSearchParams({ from: window.from, to: window.to });
    for (const queueId of queueIds) parameters.append('queue', queueId);
    return request<HistoricalQueuePerformanceReport>(
      `/api/pbx-instances/${id}/history/queue-performance?${parameters.toString()}`,
    );
  },
  historyQueueAbandonment: (
    id: string,
    queueId: string,
    window: HistoricalReportWindow,
    longWaitThresholdMinutes: number,
  ) =>
    request<HistoricalQueueAbandonmentAnalytics>(
      `/api/pbx-instances/${id}/history/queue-abandonment?queue=${encodeURIComponent(queueId)}&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&longWaitMinutes=${longWaitThresholdMinutes}`,
    ),
  historyCallEvents: (id: string, limit = 100) =>
    request<{ items: HistoricalCallEventRecord[] }>(
      `/api/pbx-instances/${id}/history/call-events?limit=${limit}`,
    ),
  historyQueueEvents: (id: string, limit = 100) =>
    request<{ items: HistoricalQueueEventRecord[] }>(
      `/api/pbx-instances/${id}/history/queue-events?limit=${limit}`,
    ),
  sshConfiguration: (id: string) =>
    request<SafeSshConfiguration>(`/api/pbx-instances/${id}/ssh-configuration`),
  testSshConfiguration: (id: string, value: object) =>
    request<{ status: 'verified' }>(
      `/api/pbx-instances/${id}/ssh-configuration/test`,
      'POST',
      value,
    ),
  putSshConfiguration: (id: string, value: object) =>
    request<SafeSshConfiguration>(`/api/pbx-instances/${id}/ssh-configuration`, 'PUT', value),
  deleteSshConfiguration: (id: string) =>
    request<{ status: string }>(`/api/pbx-instances/${id}/ssh-configuration`, 'DELETE'),
  systemMetricsStreamUrl: (id: string) => `/api/pbx-instances/${id}/system-metrics/stream`,
  callQuality: (id: string) =>
    request<LiveQualityResponse>(`/api/pbx-instances/${id}/call-quality`),
  telephonyState: (id: string) =>
    request<TelephonyStateResponse>(`/api/pbx-instances/${id}/telephony-state`),
  telephonyStateStreamUrl: (id: string) => `/api/pbx-instances/${id}/telephony-state/stream`,
  createPbx: (value: object) => request<PbxProfile>('/api/pbx-instances', 'POST', value),
  updatePbx: (id: string, value: object) =>
    request<PbxProfile>(`/api/pbx-instances/${id}`, 'PATCH', value),
  deletePbx: (id: string) => request<{ status: string }>(`/api/pbx-instances/${id}`, 'DELETE'),
  listSecurityAlerts: (id: string) =>
    request<{ current: SecurityAlertRecord[] }>(`/api/pbx-instances/${id}/security-alerts`),
  listSecurityAlertHistory: (id: string, from: string, to: string, limit = 100) =>
    request<{ items: SecurityAlertRecord[] }>(
      `/api/pbx-instances/${id}/security-alerts/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`,
    ),
  securityAlertStreamUrl: (id: string) => `/api/pbx-instances/${id}/security-alerts/stream`,
  listSecurityAlertRules: (id: string) =>
    request<{ items: SecurityAlertRuleConfig[] }>(`/api/pbx-instances/${id}/security-alert-rules`),
  putSecurityAlertRule: (id: string, ruleId: SecurityAlertRuleId, value: object) =>
    request<SecurityAlertRuleConfig>(
      `/api/pbx-instances/${id}/security-alert-rules/${ruleId}`,
      'PUT',
      value,
    ),
  deleteSecurityAlertRule: (id: string, ruleId: SecurityAlertRuleId) =>
    request<{ status: string }>(
      `/api/pbx-instances/${id}/security-alert-rules/${ruleId}`,
      'DELETE',
    ),
  testPbxConnection: (id: string) =>
    request<{
      status: 'verified';
      discovery: {
        metadata: {
          id: string;
          providerType: 'ASTERISK';
          displayName: string;
          product?: string;
          version?: string;
        };
        observedAt: string;
      };
    }>(`/api/pbx-instances/${id}/test-connection`, 'POST'),
};

export interface LiveQualityMetric {
  availability: 'AVAILABLE' | 'UNKNOWN' | 'UNSUPPORTED';
  value?: number;
  unit?: string;
  reason?: string;
}
export interface LiveQualitySample {
  instanceId: string;
  observedAt: string;
  legId: string;
  linkedId?: string;
  direction: 'SENT' | 'RECEIVED';
  ssrc?: string;
  reportSourceSsrc?: string;
  reportIndex: number;
  jitter: LiveQualityMetric;
  cumulativeLostPackets: LiveQualityMetric;
  packetLossPercent: LiveQualityMetric;
  rtt: LiveQualityMetric;
  mos: LiveQualityMetric;
  codec: { availability: string; name?: string; reason?: string };
}
export interface LiveQualityResponse {
  instanceId: string;
  capability: 'SUPPORTED' | 'UNKNOWN' | 'UNSUPPORTED';
  samples: LiveQualitySample[];
}
