#!/usr/bin/env node

/**
 * Name: production-gateway.mjs
 * Description: Serve the built frontend over HTTPS and proxy same-origin APIs to the local backend.
 * Version: 1.0.0
 * Updated: 2026-09-26
 * Requirements: Node.js 24, built frontend, TLS certificate/key
 * License: Apache-2.0
 */

import console from 'node:console';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { createServer as createHttpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const frontendRoot = resolve(process.env.VOIP_MONITOR_FRONTEND_DIR ?? 'frontend/dist');
const certPath = process.env.VOIP_MONITOR_TLS_CERT;
const keyPath = process.env.VOIP_MONITOR_TLS_KEY;
const listenHost = process.env.VOIP_MONITOR_HTTPS_HOST ?? '0.0.0.0';
const listenPort = Number(process.env.VOIP_MONITOR_HTTPS_PORT ?? '8443');
const backendHost = process.env.VOIP_MONITOR_BACKEND_HOST ?? '127.0.0.1';
const backendPort = Number(process.env.VOIP_MONITOR_BACKEND_PORT ?? '3000');

if (!certPath || !keyPath || !Number.isInteger(listenPort) || !Number.isInteger(backendPort)) {
  console.error('Missing or invalid production gateway configuration.');
  process.exit(1);
}

const apiPrefixes = ['/api/', '/auth/', '/setup/'];
const apiExact = new Set(['/api', '/auth', '/setup', '/health', '/ready']);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
]);

function securityHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader(
    'content-security-policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'",
  );
}

function isApiPath(pathname) {
  return apiExact.has(pathname) || apiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function proxy(request, response) {
  const upstream = httpRequest(
    {
      host: backendHost,
      port: backendPort,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        host: request.headers.host,
        'x-forwarded-proto': 'https',
      },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) {
      securityHeaders(response);
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    }
    response.end(JSON.stringify({ error: 'backend_unavailable' }));
  });
  request.pipe(upstream);
}

async function staticFile(pathname, response, headOnly) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = resolve(frontendRoot, normalize(relative));
  if (candidate !== frontendRoot && !candidate.startsWith(frontendRoot + '/')) {
    response.writeHead(404).end();
    return;
  }

  let filePath = candidate;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not_file');
  } catch {
    filePath = join(frontendRoot, 'index.html');
  }

  try {
    const body = await readFile(filePath);
    securityHeaders(response);
    const extension = extname(filePath).toLowerCase();
    response.setHeader('content-type', contentTypes.get(extension) ?? 'application/octet-stream');
    response.setHeader(
      'cache-control',
      filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    );
    response.writeHead(200);
    response.end(headOnly ? undefined : body);
  } catch {
    securityHeaders(response);
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(headOnly ? undefined : 'Not found');
  }
}

const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
const server = createHttpsServer({ cert, key }, (request, response) => {
  const pathname = new URL(request.url ?? '/', 'https://localhost').pathname;
  if (isApiPath(pathname)) {
    proxy(request, response);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    securityHeaders(response);
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }
  void staticFile(pathname, response, request.method === 'HEAD');
});

server.listen(listenPort, listenHost, () => {
  console.log(`HTTPS gateway listening on ${listenHost}:${listenPort}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
