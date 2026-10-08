import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AuthService } from './auth/index.js';
import { OnboardingInputError, PbxOnboardingService } from './onboarding/index.js';
import { log } from './logger.js';
import type {
  AppStorage,
  SecurityAlertRecord,
  SecurityAlertRuleConfig,
  SecurityAlertRuleId,
} from './storage/index.js';
import type { SecretStore } from './security/secret-store.js';
import {
  NotificationConfigurationError,
  NotificationConfigurationService,
} from './notifications/configuration.js';
import { SshConfigurationError, SshConfigurationService } from './ssh/configuration.js';
import { SshVerificationError, type SshConnectionVerifier } from './ssh/verification.js';
import {
  DatabaseSourceConfigurationError,
  DatabaseSourceConfigurationService,
} from './database/configuration.js';
import {
  HistoricalSourceSchemaError,
  type AsteriskConventionalSqlHistoryAdapter,
} from './database/source-schema.js';
import { DatabaseQueryError } from './database/query.js';
import type { DatabaseSourceVerifier } from './database/verification.js';
import { ProviderRuntimeError, type ProviderRuntimeManager } from './providers/runtime/index.js';
import type {
  SystemMetricsHealthListener,
  SystemMetricsRuntime,
  SystemMetricsSampleListener,
} from './collectors/system/runtime.js';
import {
  DASHBOARD_REFRESH_RATE_OPTIONS,
  DEFAULT_DASHBOARD_REFRESH_RATES,
  type DashboardRefreshRates,
  type SecurityEvent,
} from '@voip-monitor/shared';
import type { ProviderRuntimeSecurityEventListener } from './providers/runtime/index.js';
import type { TelephonyInstanceState, TelephonyStateEngine } from './telephony/state-engine.js';
import { buildOperationalHealthSnapshot } from './operational-health.js';
import { buildFleetOverviewSnapshot } from './fleet-overview.js';

function send(response: ServerResponse, status: number, data: object, cookie?: string): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(cookie ? { 'set-cookie': cookie } : {}),
  });
  response.end(JSON.stringify(data));
}
function iso(value: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

const MAX_SSE_BUFFERED_BYTES = 256 * 1024;

export function writeSseChunk(response: ServerResponse, chunk: string): boolean {
  if (response.destroyed || response.writableEnded) return false;
  if (response.writableLength > MAX_SSE_BUFFERED_BYTES) {
    response.destroy();
    return false;
  }
  response.write(chunk);
  if (response.writableLength > MAX_SSE_BUFFERED_BYTES) {
    response.destroy();
    return false;
  }
  return true;
}

function writeSse(response: ServerResponse, event: string, data: object): boolean {
  return writeSseChunk(response, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sessionToken(request: IncomingMessage): string | undefined {
  const cookies = request.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const values = cookies.filter((part) => part.startsWith('vm_session='));
  return values.length === 1 ? values[0]!.slice('vm_session='.length) : undefined;
}
function sameOrigin(request: IncomingMessage, secure: boolean): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host || Array.isArray(origin) || Array.isArray(host)) return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === (secure ? 'https:' : 'http:') &&
      parsed.host.toLowerCase() === host.toLowerCase() &&
      parsed.origin === origin
    );
  } catch {
    return false;
  }
}
async function body(request: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    return undefined;
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += chunk.length;
    if (size > 4096) return undefined;
    chunks.push(chunk);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
class AttemptLimiter {
  private attempts = new Map<string, { count: number; until: number }>();
  allow(key: string, limit: number): boolean {
    const now = Date.now();
    if (this.attempts.size > 4096) {
      for (const [entry, value] of this.attempts)
        if (value.until <= now) this.attempts.delete(entry);
    }
    const current = this.attempts.get(key);
    const value = current && current.until > now ? current : { count: 0, until: now + 60_000 };
    value.count += 1;
    this.attempts.set(key, value);
    return value.count <= limit;
  }
}

function parseSecurityAlertRuleApiInput(
  instanceId: string,
  ruleId: SecurityAlertRuleId,
  input: Record<string, unknown> | undefined,
): SecurityAlertRuleConfig | undefined {
  if (!input || input.id !== undefined || input.instanceId !== undefined) return undefined;
  if (ruleId === 'AUTHENTICATION_FAILURE_ANY') {
    if (Object.keys(input).length !== 1 || (input.enabled !== true && input.enabled !== false))
      return undefined;
    return { instanceId, id: ruleId, enabled: input.enabled };
  }
  if (
    !Object.keys(input).every((key) =>
      ['enabled', 'threshold', 'windowSeconds', 'reason'].includes(key),
    ) ||
    (input.enabled !== true && input.enabled !== false) ||
    !Number.isSafeInteger(input.threshold) ||
    (input.threshold as number) < 1 ||
    (input.threshold as number) > 100 ||
    !Number.isSafeInteger(input.windowSeconds) ||
    (input.windowSeconds as number) < 1 ||
    (input.windowSeconds as number) > 3600
  )
    return undefined;
  const reasons = new Set([
    'INVALID_ACCOUNT',
    'INVALID_PASSWORD',
    'CHALLENGE_RESPONSE_FAILED',
    'ACL_FAILURE',
    'UNEXPECTED_ADDRESS',
    'UNKNOWN',
  ]);
  if (
    input.reason !== undefined &&
    (typeof input.reason !== 'string' || !reasons.has(input.reason))
  )
    return undefined;
  return {
    instanceId,
    id: ruleId,
    enabled: input.enabled,
    threshold: input.threshold as number,
    windowSeconds: input.windowSeconds as number,
    ...(input.reason === undefined
      ? {}
      : { reason: input.reason as SecurityAlertRuleConfig & string }),
  } as SecurityAlertRuleConfig;
}

const SERVICE_ID_PATTERN = /^[A-Za-z0-9_.@-]+$/;
const DASHBOARD_WIDGET_TYPES = new Set([
  'clock',
  'provider',
  'telephony-sync',
  'security-alerts',
  'live-state',
  'cpu',
  'memory',
  'endpoint-reachability',
  'uptime',
  'metrics-trend',
  'service-health',
  'queue-pressure',
  'storage',
  'calls',
  'channels',
  'endpoints',
  'trunks',
  'queues',
  'agents',
]);

function parseServiceIds(input: Record<string, unknown> | undefined): string[] | undefined {
  if (!input || Object.keys(input).length !== 1 || !Array.isArray(input.serviceIds))
    return undefined;
  if (input.serviceIds.length > 32) return undefined;
  const values: string[] = [];
  const seen = new Set<string>();
  for (const item of input.serviceIds) {
    if (typeof item !== 'string') return undefined;
    const value = item.trim();
    if (!value || value.length > 128 || !SERVICE_ID_PATTERN.test(value) || seen.has(value))
      return undefined;
    seen.add(value);
    values.push(value);
  }
  return values;
}

interface DashboardWidgetInput {
  id: string;
  type: string;
  width: number;
  height: number;
}

function parseDashboardWidgets(value: unknown): DashboardWidgetInput[] | undefined {
  if (!Array.isArray(value) || value.length > 64) return undefined;
  const ids = new Set<string>();
  const widgets: DashboardWidgetInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    const row = item as Record<string, unknown>;
    if (
      Object.keys(row).some((key) => !['id', 'type', 'width', 'height'].includes(key)) ||
      typeof row.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(row.id) ||
      ids.has(row.id) ||
      typeof row.type !== 'string' ||
      !DASHBOARD_WIDGET_TYPES.has(row.type) ||
      !Number.isSafeInteger(row.width) ||
      Number(row.width) < 1 ||
      Number(row.width) > 12 ||
      !Number.isSafeInteger(row.height) ||
      Number(row.height) < 1 ||
      Number(row.height) > 4
    )
      return undefined;
    ids.add(row.id);
    widgets.push({
      id: row.id,
      type: row.type,
      width: Number(row.width),
      height: Number(row.height),
    });
  }
  return widgets;
}

function parseDashboardMutation(
  input: Record<string, unknown> | undefined,
): { name: string; widgets: DashboardWidgetInput[] } | undefined {
  if (!input || Object.keys(input).some((key) => !['name', 'widgets'].includes(key)))
    return undefined;
  if (typeof input.name !== 'string') return undefined;
  const name = input.name.trim();
  if (!name || name.length > 80) return undefined;
  const widgets = parseDashboardWidgets(input.widgets);
  return widgets ? { name, widgets } : undefined;
}

function safeDashboard(record: {
  id: string;
  pbxInstanceId: string;
  name: string;
  widgetsJson: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.id,
    pbxInstanceId: record.pbxInstanceId,
    name: record.name,
    widgets: JSON.parse(record.widgetsJson) as DashboardWidgetInput[],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseDashboardStorageSelection(
  input: Record<string, unknown> | undefined,
): string[] | undefined {
  if (!input || Object.keys(input).length !== 1 || !Array.isArray(input.selectedFilesystemIds))
    return undefined;
  if (input.selectedFilesystemIds.length > 128) return undefined;
  const values: string[] = [];
  const seen = new Set<string>();
  for (const item of input.selectedFilesystemIds) {
    if (typeof item !== 'string') return undefined;
    const value = item.trim();
    if (!value || value.length > 512 || seen.has(value)) return undefined;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function parseDashboardRefreshRates(
  input: Record<string, unknown> | undefined,
): DashboardRefreshRates | undefined {
  if (!input) return undefined;
  const keys = [
    'activeCallsMs',
    'endpointsMs',
    'queuesMs',
    'problemsMs',
    'cpuMemoryMs',
    'storageMs',
    'servicesMs',
  ] as const;
  if (Object.keys(input).length !== keys.length || keys.some((key) => !(key in input)))
    return undefined;
  const allowed = new Set<number>(DASHBOARD_REFRESH_RATE_OPTIONS);
  const result = {} as DashboardRefreshRates;
  for (const key of keys) {
    const value = input[key];
    if (typeof value !== 'number' || !allowed.has(value)) return undefined;
    result[key] = value;
  }
  return result;
}

export function createApp(
  storage?: AppStorage,
  secrets?: SecretStore,
  auth?: AuthService,
  runtime?: ProviderRuntimeManager,
  systemMetrics?: SystemMetricsRuntime,
  telephonyState?: TelephonyStateEngine,
  sshConfiguration?: SshConfigurationService,
  databaseSourceConfiguration?: DatabaseSourceConfigurationService,
  historicalSource?: AsteriskConventionalSqlHistoryAdapter,
  sshVerifier?: SshConnectionVerifier,
  databaseSourceVerifier?: DatabaseSourceVerifier,
): Server {
  const limiter = new AttemptLimiter();
  const metricsStreams = new Set<ServerResponse>();
  const securityStreams = new Set<ServerResponse>();
  const securityAlertStreams = new Set<ServerResponse>();
  const telephonyStateStreams = new Set<ServerResponse>();
  const onboarding =
    storage && secrets
      ? new PbxOnboardingService(
          storage,
          secrets,
          (id) => runtime?.connectionState(id) ?? 'UNVERIFIED',
        )
      : undefined;
  const notificationConfiguration =
    storage && secrets ? new NotificationConfigurationService(storage, secrets) : undefined;
  return createServer((request, response) => {
    const handle = async (): Promise<void> => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health')
        return send(response, 200, { status: 'ok' });
      if (request.method === 'GET' && path === '/ready') {
        const ready =
          (storage?.healthCheck() ?? false) &&
          (secrets?.healthCheck() ?? false) &&
          auth !== undefined;
        return send(response, ready ? 200 : 503, { status: ready ? 'ready' : 'unavailable' });
      }
      if (request.method === 'GET' && path === '/setup/status' && auth) {
        return send(response, 200, { adminSetupRequired: auth.setupRequired() });
      }
      if (request.method === 'GET' && path === '/auth/me' && auth) {
        const principal = auth.principal(sessionToken(request));
        return principal
          ? send(response, 200, principal)
          : send(response, 401, { error: 'unauthorized' });
      }
      if (
        request.method === 'POST' &&
        ['/setup/admin', '/auth/login', '/auth/logout'].includes(path) &&
        auth
      ) {
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (path === '/auth/logout') {
          auth.logout(sessionToken(request));
          return send(response, 200, { status: 'logged_out' }, auth.clearCookie());
        }
        const address = request.socket.remoteAddress ?? 'unknown';
        const scope = path === '/setup/admin' ? 'setup' : 'login';
        if (
          !limiter.allow(`${scope}:${address}`, scope === 'setup' ? 5 : 10) ||
          !limiter.allow(`${scope}:global`, scope === 'setup' ? 30 : 100)
        ) {
          return send(response, 429, { error: 'too_many_requests' });
        }
        const input = await body(request);
        if (!input) return send(response, 400, { error: 'invalid_request' });
        if (path === '/setup/admin') {
          const created = await auth.createFirst(
            input.username,
            input.password,
            input.bootstrapToken,
          );
          return created
            ? send(response, 201, created)
            : send(response, 403, { error: 'setup_unavailable' });
        }
        const result = await auth.login(input.username, input.password);
        return result
          ? send(response, 200, result.principal, auth.cookie(result.token))
          : send(response, 401, { error: 'invalid_credentials' });
      }
      if (path === '/api/admin/accounts' && auth) {
        const principal = auth.principal(sessionToken(request));
        if (!principal) return send(response, 401, { error: 'unauthorized' });
        if (request.method === 'GET') return send(response, 200, { items: auth.listAccounts() });
        if (request.method !== 'POST') return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        const input = await body(request);
        if (!input || Object.keys(input).some((key) => !['username', 'password'].includes(key)))
          return send(response, 400, { error: 'invalid_request' });
        const created = await auth.createAccount(input.username, input.password);
        return created
          ? send(response, 201, created)
          : send(response, 400, { error: 'invalid_account' });
      }

      const adminPasswordAction = path.match(/^\/api\/admin\/accounts\/([^/]+)\/password$/);
      if (adminPasswordAction && auth) {
        const principal = auth.principal(sessionToken(request));
        if (!principal) return send(response, 401, { error: 'unauthorized' });
        if (request.method !== 'PUT') return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        const input = await body(request);
        if (!input || Object.keys(input).length !== 1 || !('password' in input))
          return send(response, 400, { error: 'invalid_request' });
        const updated = await auth.resetAccountPassword(adminPasswordAction[1]!, input.password);
        return updated
          ? send(response, 200, { status: 'password_updated' })
          : send(response, 400, { error: 'invalid_account_or_password' });
      }

      const adminAccountAction = path.match(/^\/api\/admin\/accounts\/([^/]+)$/);
      if (adminAccountAction && auth) {
        const principal = auth.principal(sessionToken(request));
        if (!principal) return send(response, 401, { error: 'unauthorized' });
        const accountId = adminAccountAction[1]!;
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          return auth.deleteAccount(principal.id, accountId)
            ? send(response, 200, { status: 'deleted' })
            : send(response, 409, { error: 'account_delete_rejected' });
        }
        const input = await body(request);
        if (
          !input ||
          Object.keys(input).some((key) => !['username', 'enabled'].includes(key)) ||
          !('username' in input) ||
          !('enabled' in input)
        )
          return send(response, 400, { error: 'invalid_request' });
        const updated = auth.updateAccount(principal.id, accountId, input.username, input.enabled);
        return updated
          ? send(response, 200, updated)
          : send(response, 409, { error: 'account_update_rejected' });
      }

      if (path === '/api/fleet-overview') {
        if (!auth || !storage || !onboarding || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        return send(
          response,
          200,
          buildFleetOverviewSnapshot({
            profiles: onboarding.list(),
            storage,
            ...(runtime ? { runtime } : {}),
            ...(telephonyState ? { telephonyState } : {}),
            ...(systemMetrics ? { systemMetrics } : {}),
          }),
        );
      }

      const operationalHealthAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/operational-health$/,
      );
      if (operationalHealthAction) {
        if (!auth || !storage || !onboarding || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        const id = operationalHealthAction[1]!;
        const profile = onboarding.get(id);
        if (!profile) return send(response, 404, { error: 'not_found' });
        return send(
          response,
          200,
          buildOperationalHealthSnapshot({
            instanceId: id,
            providerState: profile.connectionStatus,
            securityAlerts: storage.securityAlerts.listCurrent(id),
            ...(telephonyState?.current(id) ? { telephony: telephonyState.current(id)! } : {}),
            ...(systemMetrics ? { systemStatus: systemMetrics.status(id) } : {}),
            ...(storage.systemMetrics.getCurrent(id)
              ? { systemSample: storage.systemMetrics.getCurrent(id)! }
              : {}),
          }),
        );
      }

      const telephonyStateAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/telephony-state(\/stream)?$/,
      );
      if (telephonyStateAction) {
        if (!auth || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = telephonyStateAction[1]!;
        const action = telephonyStateAction[2] ?? '';
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (!telephonyState) return send(response, 409, { error: 'telephony_state_unavailable' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        if (action === '') {
          return send(response, 200, { current: telephonyState.current(id) ?? null });
        }
        if (telephonyStateStreams.size >= 64)
          return send(response, 429, { error: 'too_many_requests' });
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
        });
        writeSse(response, 'telephony-state', { current: telephonyState.current(id) ?? null });
        const onState = (state: TelephonyInstanceState) => {
          if (state.instanceId === id && !response.destroyed)
            writeSse(response, 'telephony-state', { current: state });
        };
        telephonyStateStreams.add(response);
        const unsubscribeState = telephonyState.subscribe(onState);
        const unsubscribeReset = runtime?.subscribeInstanceResets((instanceId) => {
          if (instanceId === id && !response.destroyed)
            writeSse(response, 'telephony-state', { current: null });
        });
        const heartbeat = setInterval(() => {
          if (!writeSseChunk(response, ': heartbeat\n\n')) clearInterval(heartbeat);
        }, 15_000);
        let closed = false;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          telephonyStateStreams.delete(response);
          unsubscribeState();
          unsubscribeReset?.();
        };
        request.once('close', cleanup);
        response.once('close', cleanup);
        return;
      }

      const serviceMonitoringAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/service-monitoring$/,
      );
      if (serviceMonitoringAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = serviceMonitoringAction[1]!;
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          return send(response, 200, {
            serviceIds: storage.serviceMonitoringConfig.get(id) ?? [],
          });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          storage.serviceMonitoringConfig.delete(id);
          systemMetrics?.syncProfile(id);
          return send(response, 200, { serviceIds: [] });
        }
        const serviceIds = parseServiceIds(await body(request));
        if (!serviceIds) return send(response, 400, { error: 'invalid_request' });
        storage.serviceMonitoringConfig.put(id, serviceIds);
        systemMetrics?.syncProfile(id);
        return send(response, 200, { serviceIds });
      }

      const dashboardCollectionAction = path.match(/^\/api\/pbx-instances\/([^/]+)\/dashboards$/);
      if (dashboardCollectionAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const instanceId = dashboardCollectionAction[1]!;
        if (!onboarding?.get(instanceId)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          return send(response, 200, {
            items: storage.operatorDashboards.list(instanceId).map(safeDashboard),
          });
        }
        if (request.method !== 'POST') return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        const input = parseDashboardMutation(await body(request));
        if (!input) return send(response, 400, { error: 'invalid_request' });
        const now = new Date().toISOString();
        const record = {
          id: randomUUID(),
          pbxInstanceId: instanceId,
          name: input.name,
          widgetsJson: JSON.stringify(input.widgets),
          createdAt: now,
          updatedAt: now,
        };
        storage.operatorDashboards.save(record);
        return send(response, 201, safeDashboard(record));
      }

      const dashboardItemAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/dashboards\/([^/]+)$/,
      );
      if (dashboardItemAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const instanceId = dashboardItemAction[1]!;
        const dashboardId = dashboardItemAction[2]!;
        if (!onboarding?.get(instanceId)) return send(response, 404, { error: 'not_found' });
        const current = storage.operatorDashboards.get(dashboardId);
        if (!current || current.pbxInstanceId !== instanceId)
          return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') return send(response, 200, safeDashboard(current));
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          storage.operatorDashboards.delete(dashboardId);
          return send(response, 200, { status: 'deleted' });
        }
        const input = parseDashboardMutation(await body(request));
        if (!input) return send(response, 400, { error: 'invalid_request' });
        const record = {
          ...current,
          name: input.name,
          widgetsJson: JSON.stringify(input.widgets),
          updatedAt: new Date().toISOString(),
        };
        storage.operatorDashboards.save(record);
        return send(response, 200, safeDashboard(record));
      }

      const dashboardStorageAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/dashboard-storage$/,
      );
      if (dashboardStorageAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = dashboardStorageAction[1]!;
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          return send(response, 200, {
            selectedFilesystemIds: storage.dashboardStorageConfig.get(id) ?? null,
          });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          storage.dashboardStorageConfig.delete(id);
          return send(response, 200, { selectedFilesystemIds: null });
        }
        const input = parseDashboardStorageSelection(await body(request));
        if (!input) return send(response, 400, { error: 'invalid_request' });
        storage.dashboardStorageConfig.put(id, input);
        return send(response, 200, { selectedFilesystemIds: input });
      }

      const dashboardRefreshAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/dashboard-refresh$/,
      );
      if (dashboardRefreshAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = dashboardRefreshAction[1]!;
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          return send(response, 200, {
            rates: storage.dashboardRefreshConfig.get(id) ?? DEFAULT_DASHBOARD_REFRESH_RATES,
          });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          storage.dashboardRefreshConfig.delete(id);
          return send(response, 200, { rates: DEFAULT_DASHBOARD_REFRESH_RATES });
        }
        const input = parseDashboardRefreshRates(await body(request));
        if (!input) return send(response, 400, { error: 'invalid_request' });
        storage.dashboardRefreshConfig.put(id, input);
        return send(response, 200, { rates: input });
      }

      const metricsAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/system-metrics(\/history|\/stream)?$/,
      );
      if (metricsAction) {
        if (!auth || !storage || !systemMetrics || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = metricsAction[1]!;
        const action = metricsAction[2] ?? '';
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (action === '') {
          return send(response, 200, {
            current: storage.systemMetrics.getCurrent(id) ?? null,
            source: systemMetrics.status(id),
          });
        }
        if (action === '/history') {
          const from = iso(url.searchParams.get('from'));
          const to = iso(url.searchParams.get('to'));
          if (!from || !to || from > to) return send(response, 400, { error: 'invalid_range' });
          const rawLimit = url.searchParams.get('limit') ?? '100';
          const limit = Number(rawLimit);
          if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
            return send(response, 400, { error: 'invalid_limit' });
          return send(response, 200, {
            items: storage.systemMetrics.listHistory(id, from, to, limit),
          });
        }
        if (metricsStreams.size >= 64) return send(response, 429, { error: 'too_many_requests' });
        if (response.headersSent) return;
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
        });
        writeSse(response, 'system-metrics', {
          current: storage.systemMetrics.getCurrent(id) ?? null,
          source: systemMetrics.status(id),
        });
        const onSample: SystemMetricsSampleListener = (sample) => {
          if (sample.instanceId === id && !response.destroyed)
            writeSse(response, 'system-metrics', { current: sample });
        };
        const onHealth: SystemMetricsHealthListener = (status) => {
          if (status.instanceId === id && !response.destroyed)
            writeSse(response, 'system-metrics-health', { source: status });
        };
        metricsStreams.add(response);
        const unsubscribeSample = systemMetrics.subscribeSamples(onSample);
        const unsubscribeHealth = systemMetrics.subscribeHealth(onHealth);
        const heartbeat = setInterval(() => {
          if (!writeSseChunk(response, ': heartbeat\n\n')) clearInterval(heartbeat);
        }, 15_000);
        let closed = false;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          metricsStreams.delete(response);
          unsubscribeSample();
          unsubscribeHealth();
        };
        request.once('close', cleanup);
        response.once('close', cleanup);
        return;
      }

      const sshConfigurationAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/ssh-configuration$/,
      );
      if (sshConfigurationAction) {
        if (!auth || !sshConfiguration || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = sshConfigurationAction[1]!;
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          const current = sshConfiguration.get(id);
          return current
            ? send(response, 200, current)
            : send(response, 404, { error: 'not_found' });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        try {
          if (request.method === 'DELETE') {
            const deleted = sshConfiguration.delete(id);
            systemMetrics?.syncProfile(id);
            return deleted
              ? send(response, 200, { status: 'deleted' })
              : send(response, 404, { error: 'not_found' });
          }
          const input = await body(request);
          if (!input) return send(response, 400, { error: 'invalid_request' });
          if (!sshVerifier) return send(response, 409, { error: 'ssh_verification_unavailable' });
          await sshVerifier.verify(input);
          const configured = sshConfiguration.configure(id, input, new Date().toISOString());
          systemMetrics?.syncProfile(id);
          return send(response, 200, configured);
        } catch (error) {
          if (error instanceof SshVerificationError) {
            if (error.code === 'INVALID_INPUT')
              return send(response, 400, { error: 'invalid_request' });
            const code = {
              HOST_KEY_MISMATCH: 'ssh_host_key_mismatch',
              AUTHENTICATION_FAILED: 'ssh_authentication_failed',
              CONNECTION_FAILED: 'ssh_connection_failed',
              TIMEOUT: 'ssh_timeout',
              TARGET_BLOCKED: 'ssh_target_blocked',
            }[error.code];
            return send(response, 502, { error: code });
          }
          if (!(error instanceof SshConfigurationError)) throw error;
          if (error.code === 'PBX_NOT_FOUND') return send(response, 404, { error: 'not_found' });
          return send(response, 400, { error: 'invalid_request' });
        }
      }

      const databaseSourceAction = path.match(/^\/api\/pbx-instances\/([^/]+)\/database-source$/);
      if (databaseSourceAction) {
        if (!auth || !databaseSourceConfiguration || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = databaseSourceAction[1]!;
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          const current = databaseSourceConfiguration.get(id);
          return current
            ? send(response, 200, current)
            : send(response, 404, { error: 'not_found' });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        try {
          if (request.method === 'DELETE') {
            const deleted = databaseSourceConfiguration.delete(id);
            return deleted
              ? send(response, 200, { status: 'deleted' })
              : send(response, 404, { error: 'not_found' });
          }
          const input = await body(request);
          if (!input) return send(response, 400, { error: 'invalid_request' });
          if (!databaseSourceVerifier)
            return send(response, 503, { error: 'database_verifier_unavailable' });
          await databaseSourceVerifier.verify(id, input);
          return send(response, 200, databaseSourceConfiguration.configure(id, input));
        } catch (error) {
          if (error instanceof DatabaseSourceConfigurationError) {
            if (error.code === 'PBX_NOT_FOUND') return send(response, 404, { error: 'not_found' });
            return send(response, 400, { error: 'invalid_request' });
          }
          if (error instanceof DatabaseQueryError) {
            if (error.code === 'BACKOFF')
              return send(response, 429, { error: 'database_backoff_active' });
            if (error.code === 'TIMEOUT')
              return send(response, 504, { error: 'database_verification_timeout' });
            if (error.code === 'PERMISSION_DENIED')
              return send(response, 502, { error: 'database_permission_denied' });
            if (error.code === 'AUTHENTICATION_FAILED')
              return send(response, 502, { error: 'database_authentication_failed' });
            if (error.code === 'DATABASE_NOT_FOUND')
              return send(response, 502, { error: 'database_not_found' });
            if (error.code === 'SCOPE_UNAVAILABLE')
              return send(response, 502, { error: 'database_scope_unavailable' });
            if (error.code === 'HOST_BLOCKED')
              return send(response, 502, { error: 'database_host_blocked' });
            if (error.code === 'TLS_FAILED')
              return send(response, 502, { error: 'database_tls_failed' });
            return send(response, 502, { error: 'database_verification_failed' });
          }
          throw error;
        }
      }

      const historyAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/history(?:\/(calls|call-events|queue-events|call-outcomes|queue-abandonment|queue-performance|queue-performance-details|queue-options))?$/,
      );
      if (historyAction) {
        if (!auth || !historicalSource || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = historyAction[1]!;
        const dataset = historyAction[2];
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        try {
          if (!dataset) return send(response, 200, await historicalSource.inspect(id));
          const url = new URL(request.url ?? '/', 'http://localhost');
          if (dataset === 'call-outcomes') {
            const from = url.searchParams.get('from') ?? '';
            const to = url.searchParams.get('to') ?? '';
            const sourceDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;
            if (!sourceDateTime.test(from) || !sourceDateTime.test(to))
              return send(response, 400, { error: 'invalid_request' });
            return send(response, 200, await historicalSource.callOutcomeAnalytics(id, from, to));
          }
          if (dataset === 'queue-options') {
            return send(response, 200, { items: await historicalSource.listQueueIds(id) });
          }
          if (dataset === 'queue-performance-details') {
            const queueIds = url.searchParams.getAll('queue');
            const from = url.searchParams.get('from') ?? '';
            const to = url.searchParams.get('to') ?? '';
            const reportTo = url.searchParams.get('reportTo') ?? '';
            const sourceDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;
            const invalidQueue = (queueId: string) =>
              !queueId ||
              queueId.length > 128 ||
              [...queueId].some((character) => {
                const code = character.charCodeAt(0);
                return code < 32 || code === 127;
              });
            if (
              queueIds.length === 0 ||
              queueIds.length > 16 ||
              new Set(queueIds).size !== queueIds.length ||
              queueIds.some(invalidQueue) ||
              !sourceDateTime.test(from) ||
              !sourceDateTime.test(to) ||
              !sourceDateTime.test(reportTo)
            ) {
              return send(response, 400, { error: 'invalid_request' });
            }
            return send(
              response,
              200,
              await historicalSource.queuePerformanceDetailChunk(id, queueIds, from, to, reportTo),
            );
          }
          if (dataset === 'queue-performance') {
            const queueIds = url.searchParams.getAll('queue');
            const from = url.searchParams.get('from') ?? '';
            const to = url.searchParams.get('to') ?? '';
            const sourceDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;
            const invalidQueue = (queueId: string) =>
              !queueId ||
              queueId.length > 128 ||
              [...queueId].some((character) => {
                const code = character.charCodeAt(0);
                return code < 32 || code === 127;
              });
            if (
              queueIds.length === 0 ||
              queueIds.length > 16 ||
              new Set(queueIds).size !== queueIds.length ||
              queueIds.some(invalidQueue) ||
              !sourceDateTime.test(from) ||
              !sourceDateTime.test(to)
            ) {
              return send(response, 400, { error: 'invalid_request' });
            }
            return send(
              response,
              200,
              await historicalSource.queuePerformanceReport(id, queueIds, from, to),
            );
          }
          if (dataset === 'queue-abandonment') {
            const queueId = url.searchParams.get('queue') ?? '';
            const from = url.searchParams.get('from') ?? '';
            const to = url.searchParams.get('to') ?? '';
            const rawThreshold = url.searchParams.get('longWaitMinutes') ?? '1';
            if (
              !queueId ||
              queueId.length > 128 ||
              [...queueId].some((character) => {
                const code = character.charCodeAt(0);
                return code < 32 || code === 127;
              }) ||
              !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u.test(from) ||
              !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u.test(to) ||
              !/^(?:[1-9]|[1-5]\d|60)$/u.test(rawThreshold)
            ) {
              return send(response, 400, { error: 'invalid_request' });
            }
            return send(
              response,
              200,
              await historicalSource.queueAbandonmentAnalytics(
                id,
                queueId,
                from,
                to,
                Number(rawThreshold),
              ),
            );
          }
          const rawLimit = url.searchParams.get('limit') ?? '100';
          if (!/^(?:[1-9]|[1-9]\d|1\d\d|200)$/u.test(rawLimit))
            return send(response, 400, { error: 'invalid_request' });
          const limit = Number(rawLimit);
          const items =
            dataset === 'calls'
              ? await historicalSource.listRecentCalls(id, limit)
              : dataset === 'call-events'
                ? await historicalSource.listRecentCallEvents(id, limit)
                : await historicalSource.listRecentQueueEvents(id, limit);
          return send(response, 200, { items });
        } catch (error) {
          if (error instanceof HistoricalSourceSchemaError) {
            if (
              error.code === 'INVALID_LIMIT' ||
              error.code === 'INVALID_RANGE' ||
              error.code === 'INVALID_QUEUE' ||
              error.code === 'INVALID_THRESHOLD'
            )
              return send(response, 400, { error: 'invalid_request' });
            if (error.code === 'NOT_CONFIGURED')
              return send(response, 409, { error: 'source_not_configured' });
            if (error.code === 'DATASET_UNAVAILABLE')
              return send(response, 409, { error: 'dataset_unavailable' });
            if (error.code === 'EXPORT_TOO_LARGE')
              return send(response, 413, { error: 'history_export_too_large' });
            return send(response, 502, { error: 'source_data_invalid' });
          }
          if (error instanceof DatabaseQueryError) {
            if (error.code === 'BACKOFF')
              return send(response, 429, { error: 'database_backoff_active' });
            if (error.code === 'TIMEOUT')
              return send(response, 504, { error: 'history_database_timeout' });
            if (error.code === 'ROW_LIMIT')
              return send(response, 502, { error: 'history_row_limit' });
            if (error.code === 'OUTPUT_LIMIT')
              return send(response, 502, { error: 'history_output_limit' });
            if (error.code === 'UNSUPPORTED_VALUE')
              return send(response, 502, { error: 'history_unsupported_value' });
            if (error.code === 'QUERY_FAILED')
              return send(response, 502, { error: 'history_query_failed' });
            if (error.code === 'AUTHENTICATION_FAILED')
              return send(response, 502, { error: 'database_authentication_failed' });
            if (error.code === 'DATABASE_NOT_FOUND')
              return send(response, 502, { error: 'database_not_found' });
            if (error.code === 'SCOPE_UNAVAILABLE')
              return send(response, 502, { error: 'database_scope_unavailable' });
            if (error.code === 'HOST_BLOCKED')
              return send(response, 502, { error: 'database_host_blocked' });
            if (error.code === 'TLS_FAILED')
              return send(response, 502, { error: 'database_tls_failed' });
            if (error.code === 'NOT_CONFIGURED' || error.code === 'PERMISSION_DENIED')
              return send(response, 409, { error: 'source_unavailable' });
            return send(response, 502, { error: 'source_unavailable' });
          }
          throw error;
        }
      }

      const notificationChannelAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/notification-channels(?:\/([^/]+))?$/,
      );
      if (notificationChannelAction) {
        if (!auth || !notificationConfiguration || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = notificationChannelAction[1]!;
        const channelId = notificationChannelAction[2];
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        try {
          if (request.method === 'GET') {
            if (channelId === undefined)
              return send(response, 200, { items: notificationConfiguration.list(id) });
            const channel = notificationConfiguration.get(id, channelId);
            return channel
              ? send(response, 200, channel)
              : send(response, 404, { error: 'not_found' });
          }
          if (!['PUT', 'DELETE'].includes(request.method ?? '') || channelId === undefined)
            return send(response, 404, { error: 'not_found' });
          if (!sameOrigin(request, auth.requiresSecureOrigin))
            return send(response, 403, { error: 'forbidden' });
          if (request.method === 'DELETE') {
            return notificationConfiguration.delete(id, channelId)
              ? send(response, 200, { status: 'deleted' })
              : send(response, 404, { error: 'not_found' });
          }
          const input = await body(request);
          if (!input) return send(response, 400, { error: 'invalid_request' });
          return send(response, 200, notificationConfiguration.configure(id, channelId, input));
        } catch (error) {
          if (!(error instanceof NotificationConfigurationError)) throw error;
          if (error.code === 'PBX_NOT_FOUND' || error.code === 'CHANNEL_NOT_FOUND')
            return send(response, 404, { error: 'not_found' });
          return send(response, 400, { error: 'invalid_request' });
        }
      }

      const securityAlertRuleAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/security-alert-rules(?:\/([^/]+))?$/,
      );
      if (securityAlertRuleAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = securityAlertRuleAction[1]!;
        const rawRuleId = securityAlertRuleAction[2];
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        const ruleId =
          rawRuleId === undefined
            ? undefined
            : rawRuleId === 'AUTHENTICATION_FAILURE_ANY' ||
                rawRuleId === 'AUTHENTICATION_FAILURE_THRESHOLD'
              ? (rawRuleId as SecurityAlertRuleId)
              : null;
        if (ruleId === null) return send(response, 404, { error: 'not_found' });
        if (request.method === 'GET') {
          if (ruleId === undefined)
            return send(response, 200, { items: storage.securityAlertRules.list(id) });
          const rule = storage.securityAlertRules.get(id, ruleId);
          return rule ? send(response, 200, rule) : send(response, 404, { error: 'not_found' });
        }
        if (!['PUT', 'DELETE'].includes(request.method ?? '') || ruleId === undefined)
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE') {
          return storage.securityAlertRules.delete(id, ruleId)
            ? send(response, 200, { status: 'deleted' })
            : send(response, 404, { error: 'not_found' });
        }
        const input = await body(request);
        const config = parseSecurityAlertRuleApiInput(id, ruleId, input);
        if (!config) return send(response, 400, { error: 'invalid_request' });
        storage.securityAlertRules.put(config);
        return send(response, 200, storage.securityAlertRules.get(id, ruleId) ?? config);
      }

      const securityAlertAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/security-alerts(\/history|\/stream)?$/,
      );
      if (securityAlertAction) {
        if (!auth || !storage || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = securityAlertAction[1]!;
        const action = securityAlertAction[2] ?? '';
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (action === '') {
          return send(response, 200, {
            current: storage.securityAlerts.listCurrent(id),
          });
        }
        if (action === '/history') {
          const from = iso(url.searchParams.get('from'));
          const to = iso(url.searchParams.get('to'));
          if (!from || !to || from > to) return send(response, 400, { error: 'invalid_range' });
          const rawLimit = url.searchParams.get('limit') ?? '100';
          const limit = Number(rawLimit);
          if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
            return send(response, 400, { error: 'invalid_limit' });
          return send(response, 200, {
            items: storage.securityAlerts.listHistory(id, from, to, limit),
          });
        }
        if (securityAlertStreams.size >= 64)
          return send(response, 429, { error: 'too_many_requests' });
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
        });
        writeSse(response, 'security-alert', {
          current: storage.securityAlerts.listCurrent(id),
        });
        const onAlert = (alert: SecurityAlertRecord) => {
          if (alert.instanceId === id && !response.destroyed)
            writeSse(response, 'security-alert', { alert });
        };
        securityAlertStreams.add(response);
        const unsubscribe = storage.securityAlerts.subscribe(onAlert);
        const heartbeat = setInterval(() => {
          if (!writeSseChunk(response, ': heartbeat\n\n')) clearInterval(heartbeat);
        }, 15_000);
        let closed = false;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          securityAlertStreams.delete(response);
          unsubscribe();
        };
        request.once('close', cleanup);
        response.once('close', cleanup);
        return;
      }

      const securityAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/security-events(\/history|\/stream)?$/,
      );
      if (securityAction) {
        if (!auth || !storage || !runtime || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = securityAction[1]!;
        const action = securityAction[2] ?? '';
        if (!onboarding?.get(id)) return send(response, 404, { error: 'not_found' });
        if (request.method !== 'GET') return send(response, 404, { error: 'not_found' });
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (action === '') {
          return send(response, 200, {
            current: storage.securityEvents.getCurrent(id) ?? null,
          });
        }
        if (action === '/history') {
          const from = iso(url.searchParams.get('from'));
          const to = iso(url.searchParams.get('to'));
          if (!from || !to || from > to) return send(response, 400, { error: 'invalid_range' });
          const rawLimit = url.searchParams.get('limit') ?? '100';
          const limit = Number(rawLimit);
          if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
            return send(response, 400, { error: 'invalid_limit' });
          return send(response, 200, {
            items: storage.securityEvents.listHistory(id, from, to, limit),
          });
        }
        if (securityStreams.size >= 64) return send(response, 429, { error: 'too_many_requests' });
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
        });
        writeSse(response, 'security-event', {
          current: storage.securityEvents.getCurrent(id) ?? null,
        });
        const onEvent: ProviderRuntimeSecurityEventListener = (event: SecurityEvent) => {
          if (event.instanceId === id && !response.destroyed)
            writeSse(response, 'security-event', { event });
        };
        securityStreams.add(response);
        const unsubscribe = runtime.subscribeSecurityEvents(onEvent);
        const heartbeat = setInterval(() => {
          if (!writeSseChunk(response, ': heartbeat\n\n')) clearInterval(heartbeat);
        }, 15_000);
        let closed = false;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          securityStreams.delete(response);
          unsubscribe();
        };
        request.once('close', cleanup);
        response.once('close', cleanup);
        return;
      }

      const providerAction = path.match(
        /^\/api\/pbx-instances\/([^/]+)\/(provider-status|test-connection)$/,
      );
      if (providerAction) {
        if (!auth || !onboarding || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = providerAction[1]!;
        const action = providerAction[2]!;
        if (!onboarding.get(id)) return send(response, 404, { error: 'not_found' });
        if (!runtime) return send(response, 409, { error: 'pbx_network_disabled' });
        if (request.method === 'GET' && action === 'provider-status') {
          return send(response, 200, {
            connectionStatus: runtime.connectionState(id),
            ...runtime.status(id),
          });
        }
        if (request.method !== 'POST' || action !== 'test-connection')
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (!limiter.allow(`pbx-test:${id}`, 5) || !limiter.allow('pbx-test:global', 30)) {
          return send(response, 429, { error: 'too_many_requests' });
        }
        try {
          const result = await runtime.verify(id);
          return send(response, 200, { status: 'verified', ...result });
        } catch (error) {
          if (!(error instanceof ProviderRuntimeError)) throw error;
          if (error.code === 'NOT_FOUND') return send(response, 404, { error: 'not_found' });
          if (error.code === 'NETWORK_DISABLED')
            return send(response, 409, { error: 'pbx_network_disabled' });
          if (error.code === 'CREDENTIAL_MISSING')
            return send(response, 409, { error: 'ami_credential_missing' });
          if (error.code === 'BUSY') return send(response, 409, { error: 'provider_busy' });
          return send(response, 502, { error: 'connection_failed' });
        }
      }
      if (path === '/api/pbx-instances' || path.startsWith('/api/pbx-instances/')) {
        if (!auth || !onboarding || !auth.principal(sessionToken(request)))
          return send(response, 401, { error: 'unauthorized' });
        const id = path.startsWith('/api/pbx-instances/')
          ? path.slice('/api/pbx-instances/'.length)
          : undefined;
        if (request.method === 'GET') {
          if (id === undefined) return send(response, 200, { items: onboarding.list() });
          const profile = onboarding.get(id);
          return profile
            ? send(response, 200, profile)
            : send(response, 404, { error: 'not_found' });
        }
        if (!['POST', 'PATCH', 'DELETE'].includes(request.method ?? ''))
          return send(response, 404, { error: 'not_found' });
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
        if (request.method === 'DELETE' && id !== undefined) {
          await runtime?.remove(id);
          return onboarding.delete(id)
            ? send(response, 200, { status: 'deleted' })
            : send(response, 404, { error: 'not_found' });
        }
        if (
          (request.method === 'POST' && id !== undefined) ||
          (request.method === 'PATCH' && id === undefined)
        )
          return send(response, 404, { error: 'not_found' });
        const input = await body(request);
        if (!input) return send(response, 400, { error: 'invalid_request' });
        try {
          if (request.method === 'POST') {
            const created = onboarding.create(input);
            await runtime?.syncProfile(created.id);
            return send(response, 201, onboarding.get(created.id) ?? created);
          }
          const updated = onboarding.update(id!, input);
          if (!updated) return send(response, 404, { error: 'not_found' });
          await runtime?.syncProfile(updated.id);
          return send(response, 200, onboarding.get(updated.id) ?? updated);
        } catch (error) {
          if (error instanceof OnboardingInputError)
            return send(response, 400, { error: 'invalid_request' });
          throw error;
        }
      }
      send(response, 404, { error: 'not_found' });
    };
    void handle()
      .catch(() => {
        log('error', 'request_failed');
        if (!response.headersSent) send(response, 500, { error: 'internal_error' });
        else response.destroy();
      })
      .finally(() => log('info', 'request_completed', { statusCode: response.statusCode }));
  });
}
