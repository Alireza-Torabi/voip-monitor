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

export type SshAuthMethod = 'PASSWORD' | 'PRIVATE_KEY';
export interface SafeSshConfiguration {
  pbxInstanceId: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  hostKeyPolicy: 'PINNED_SHA256';
  hostKeyFingerprint: string;
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
  registrationState: string;
  reachability: string;
  updatedAt: string;
}

export interface TelephonyTrunkState {
  trunkId: string;
  kind: string;
  technology: string;
  confidence: string;
  registrationState: string;
  reachability?: string;
  updatedAt: string;
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
  providerStatus: (id: string) =>
    request<ProviderStatus>(`/api/pbx-instances/${id}/provider-status`),
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
  sshConfiguration: (id: string) =>
    request<SafeSshConfiguration>(`/api/pbx-instances/${id}/ssh-configuration`),
  putSshConfiguration: (id: string, value: object) =>
    request<SafeSshConfiguration>(`/api/pbx-instances/${id}/ssh-configuration`, 'PUT', value),
  deleteSshConfiguration: (id: string) =>
    request<{ status: string }>(`/api/pbx-instances/${id}/ssh-configuration`, 'DELETE'),
  systemMetricsStreamUrl: (id: string) => `/api/pbx-instances/${id}/system-metrics/stream`,
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
