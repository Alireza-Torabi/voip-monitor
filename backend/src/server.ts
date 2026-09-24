import { createServer, type Server } from 'node:http';
import { log } from './logger.js';
import type { AppStorage } from './storage/index.js';
import type { SecretStore } from './security/secret-store.js';

export function createApp(
  storage?: AppStorage,
  secrets?: Pick<SecretStore, 'healthCheck'>,
): Server {
  return createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method === 'GET' && path === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok' }));
    } else if (request.method === 'GET' && path === '/ready') {
      const ready = (storage?.healthCheck() ?? false) && (secrets?.healthCheck() ?? false);
      response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: ready ? 'ready' : 'unavailable' }));
    } else {
      response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'not_found' }));
    }
    log('info', 'request_completed', { statusCode: response.statusCode });
  });
}
