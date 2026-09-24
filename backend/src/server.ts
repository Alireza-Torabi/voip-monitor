import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AuthService } from './auth/index.js';
import { log } from './logger.js';
import type { AppStorage } from './storage/index.js';
import type { SecretStore } from './security/secret-store.js';

function send(response: ServerResponse, status: number, data: object, cookie?: string): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(cookie ? { 'set-cookie': cookie } : {}),
  });
  response.end(JSON.stringify(data));
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

export function createApp(
  storage?: AppStorage,
  secrets?: Pick<SecretStore, 'healthCheck'>,
  auth?: AuthService,
): Server {
  const limiter = new AttemptLimiter();
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
