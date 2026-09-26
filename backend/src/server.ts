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
import { ProviderRuntimeError, type ProviderRuntimeManager } from './providers/runtime/index.js';
import type {
  SystemMetricsHealthListener,
  SystemMetricsRuntime,
  SystemMetricsSampleListener,
} from './collectors/system/runtime.js';
import type { SecurityEvent } from '@voip-monitor/shared';
import type { ProviderRuntimeSecurityEventListener } from './providers/runtime/index.js';

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

function writeSse(response: ServerResponse, event: string, data: object): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

export function createApp(
  storage?: AppStorage,
  secrets?: SecretStore,
  auth?: AuthService,
  runtime?: ProviderRuntimeManager,
  systemMetrics?: SystemMetricsRuntime,
): Server {
  const limiter = new AttemptLimiter();
  const metricsStreams = new Set<ServerResponse>();
  const securityStreams = new Set<ServerResponse>();
  const securityAlertStreams = new Set<ServerResponse>();
  const onboarding =
    storage && secrets
      ? new PbxOnboardingService(
          storage,
          secrets,
          (id) => runtime?.connectionState(id) ?? 'UNVERIFIED',
        )
      : undefined;
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
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
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
          if (response.destroyed) clearInterval(heartbeat);
          else response.write(': heartbeat\n\n');
        }, 15_000);
        request.on('close', () => {
          clearInterval(heartbeat);
          metricsStreams.delete(response);
          unsubscribeSample();
          unsubscribeHealth();
        });
        return;
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
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
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
          if (response.destroyed) clearInterval(heartbeat);
          else response.write(': heartbeat\n\n');
        }, 15_000);
        request.on('close', () => {
          clearInterval(heartbeat);
          securityAlertStreams.delete(response);
          unsubscribe();
        });
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
        if (!sameOrigin(request, auth.requiresSecureOrigin))
          return send(response, 403, { error: 'forbidden' });
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
          if (response.destroyed) clearInterval(heartbeat);
          else response.write(': heartbeat\\n\\n');
        }, 15_000);
        request.on('close', () => {
          clearInterval(heartbeat);
          securityStreams.delete(response);
          unsubscribe();
        });
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
