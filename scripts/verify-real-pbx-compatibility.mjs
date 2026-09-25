#!/usr/bin/env node

// ============================================================
// Name: verify-real-pbx-compatibility.mjs
// Description: Run a bounded, read-only AMI compatibility verification using local-only configuration.
// Version: 0.1.0
// Updated: 2026-09-25
// Requirements: Node.js 24, built backend workspace, ignored local config and credential files
// Usage: node scripts/verify-real-pbx-compatibility.mjs [--config <path>] [--observe-seconds <1-300>]
// License: Apache-2.0
// ============================================================

import { Buffer } from 'node:buffer';
import { constants as fsConstants, readFileSync } from 'node:fs';
import { access, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_VERIFICATION_DIR = join(ROOT, '.local', 'real-pbx-verification');
const DEFAULT_CONFIG = join(LOCAL_VERIFICATION_DIR, 'config.json');
const DEFAULT_RESULT = join(LOCAL_VERIFICATION_DIR, 'last-result.json');

function usage() {
  process.stdout.write(
    'Usage: node scripts/verify-real-pbx-compatibility.mjs [--config <path>] [--observe-seconds <1-300>]\n',
  );
}

function parseArgs(argv) {
  let configPath = DEFAULT_CONFIG;
  let observeSeconds = 30;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help') {
      usage();
      process.exit(0);
    }
    if (value === '--config') {
      const next = argv[index + 1];
      if (!next) throw new Error('CONFIG_PATH_REQUIRED');
      configPath = isAbsolute(next) ? next : resolve(process.cwd(), next);
      index += 1;
      continue;
    }
    if (value === '--observe-seconds') {
      const next = argv[index + 1];
      if (!next || !/^[0-9]+$/.test(next)) throw new Error('INVALID_OBSERVE_SECONDS');
      observeSeconds = Number(next);
      if (observeSeconds < 1 || observeSeconds > 300) throw new Error('INVALID_OBSERVE_SECONDS');
      index += 1;
      continue;
    }
    throw new Error('UNKNOWN_ARGUMENT');
  }
  return { configPath: resolve(configPath), observeSeconds };
}

function requireLocalVerificationPath(path, label) {
  const relativePath = relative(LOCAL_VERIFICATION_DIR, resolve(path));
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`${label}_OUTSIDE_LOCAL_VERIFICATION_DIR`);
  }
}

async function requireRestrictedRegularFile(path, label) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label}_UNSAFE_FILE`);
  if ((stat.mode & 0o077) !== 0) throw new Error(`${label}_UNSAFE_PERMISSIONS`);
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error(`${label}_UNSAFE_OWNER`);
  }
  await access(path, fsConstants.R_OK);
}

function validateConfig(input, baseDirectory) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('INVALID_CONFIG');
  const host = typeof input.host === 'string' ? input.host.trim() : '';
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const port = Number(input.port ?? 5038);
  const passwordFile =
    typeof input.passwordFile === 'string' && input.passwordFile.trim()
      ? input.passwordFile.trim()
      : '';
  if (!host || host.length > 253) throw new Error('INVALID_HOST');
  if (!username || username.length > 128) throw new Error('INVALID_USERNAME');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  if (!passwordFile) throw new Error('PASSWORD_FILE_REQUIRED');
  const resultFile =
    typeof input.resultFile === 'string' && input.resultFile.trim()
      ? input.resultFile.trim()
      : undefined;
  return {
    host,
    port,
    username,
    passwordFile: isAbsolute(passwordFile)
      ? resolve(passwordFile)
      : resolve(baseDirectory, passwordFile),
    ...(resultFile ? { resultFile } : {}),
  };
}

function stripSingleLineEnding(buffer) {
  let end = buffer.length;
  if (end > 0 && buffer[end - 1] === 0x0a) end -= 1;
  if (end > 0 && buffer[end - 1] === 0x0d) end -= 1;
  return Buffer.from(buffer.subarray(0, end));
}

function safeErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') return error.code;
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) return error.message;
  return 'UNKNOWN';
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function main() {
  const { configPath, observeSeconds } = parseArgs(process.argv.slice(2));
  requireLocalVerificationPath(configPath, 'CONFIG');
  await requireRestrictedRegularFile(configPath, 'CONFIG');
  const config = validateConfig(
    JSON.parse(await readFile(configPath, 'utf8')),
    dirname(configPath),
  );
  requireLocalVerificationPath(config.passwordFile, 'PASSWORD');
  await requireRestrictedRegularFile(config.passwordFile, 'PASSWORD');

  const [{ AsteriskProvider, NodeAddressResolver, TcpAmiTransport }] = await Promise.all([
    import('../backend/dist/providers/asterisk/index.js'),
  ]);

  const eventCounts = new Map();
  const transport = new TcpAmiTransport(5000);
  const provider = new AsteriskProvider({
    instanceId: 'compatibility-verification',
    displayName: 'Compatibility Verification',
    host: config.host,
    port: config.port,
    amiUsername: config.username,
    readAmiPassword: () => {
      const raw = readFileSync(config.passwordFile);
      try {
        const password = stripSingleLineEnding(raw);
        if (password.length === 0) throw new Error('EMPTY_PASSWORD');
        return password;
      } finally {
        raw.fill(0);
      }
    },
    resolver: new NodeAddressResolver(),
    transport,
  });

  const unsubscribe = provider.subscribeEvents((event) => increment(eventCounts, event.type));
  let connected = false;
  const result = {
    status: 'FAIL',
    checks: {
      login: false,
      discovery: false,
      initialSnapshot: false,
      liveEventObservation: false,
      reconciliation: false,
      disconnect: false,
    },
    product: undefined,
    version: undefined,
    initialChannelCount: undefined,
    finalChannelCount: undefined,
    eventCounts: {},
    finalConnectionState: undefined,
    errorCode: undefined,
  };

  try {
    await provider.connect();
    connected = true;
    result.checks.login = true;

    const discovery = await provider.discover();
    result.checks.discovery = true;
    result.product = discovery.metadata.product;
    result.version = discovery.metadata.version;

    const initial = await provider.getCurrentState();
    result.checks.initialSnapshot = true;
    result.initialChannelCount = initial.channels.length;

    process.stdout.write(
      `AMI compatibility observation active for ${observeSeconds} seconds. A normal test call may be placed now; the verifier will not originate or modify calls.\n`,
    );
    await new Promise((resolveWait) => setTimeout(resolveWait, observeSeconds * 1000));
    result.checks.liveEventObservation = true;

    const finalSnapshot = await provider.reconcile();
    result.checks.reconciliation = true;
    result.finalChannelCount = finalSnapshot.channels.length;
    result.eventCounts = Object.fromEntries(
      [...eventCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
    );

    const health = await provider.getHealth();
    result.finalConnectionState = health.connection.state;
    result.status = 'PASS';
  } catch (error) {
    result.errorCode = safeErrorCode(error);
  } finally {
    unsubscribe();
    if (connected) {
      try {
        await provider.disconnect();
        result.checks.disconnect = true;
      } catch {
        if (!result.errorCode) result.errorCode = 'DISCONNECT_FAILED';
        result.status = 'FAIL';
      }
    }
  }

  const outputPath = config.resultFile
    ? isAbsolute(config.resultFile)
      ? resolve(config.resultFile)
      : resolve(dirname(configPath), config.resultFile)
    : configPath === DEFAULT_CONFIG
      ? DEFAULT_RESULT
      : resolve(dirname(configPath), 'last-result.json');
  requireLocalVerificationPath(outputPath, 'RESULT');
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  if (result.status === 'PASS') {
    process.stdout.write(
      'Compatibility verification PASS. Detailed result stored in ignored local storage.\n',
    );
  } else {
    process.stderr.write(`Compatibility verification FAIL: ${result.errorCode ?? 'UNKNOWN'}\n`);
  }
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`Compatibility verification failed safely: ${safeErrorCode(error)}\n`);
  process.exitCode = 1;
});
