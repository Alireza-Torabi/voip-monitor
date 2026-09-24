import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { ConfigError, loadAppConfig } from '../dist/config.js';
import { redactLogDetails } from '../dist/logger.js';

test('safe defaults are independent of ambient environment', () => {
  assert.deepEqual(loadAppConfig({}), {
    environment: 'production',
    http: { host: '127.0.0.1', port: 3000 },
    logLevel: 'info',
    dataDirectory: '/data',
    secretDirectory: '/data/secrets',
    databasePath: '/data/monitor.sqlite3',
  });
});

test('valid explicit application settings produce typed configuration', () => {
  assert.deepEqual(
    loadAppConfig({
      APP_ENV: 'test',
      APP_HOST: 'localhost',
      APP_PORT: '4321',
      APP_LOG_LEVEL: 'warn',
      DATA_PATH: '/tmp/example-data',
      APP_SECRET_DIR: '/tmp/example-secrets',
      APP_DATABASE_PATH: '/tmp/example.sqlite3',
    }),
    {
      environment: 'test',
      http: { host: 'localhost', port: 4321 },
      logLevel: 'warn',
      dataDirectory: '/tmp/example-data',
      secretDirectory: '/tmp/example-secrets',
      databasePath: '/tmp/example.sqlite3',
    },
  );
});

test('invalid explicit settings fail without echoing values', () => {
  for (const [field, value] of [
    ['APP_PORT', '0'],
    ['APP_PORT', '65536'],
    ['APP_PORT', '3.5'],
    ['APP_PORT', 'password=hidden'],
    ['APP_LOG_LEVEL', 'token=hidden'],
    ['APP_ENV', ''],
    ['APP_HOST', ''],
    ['DATA_PATH', 'relative'],
    ['APP_SECRET_DIR', 'relative'],
  ]) {
    assert.throws(
      () => loadAppConfig({ [field]: value }),
      (error) =>
        error instanceof ConfigError &&
        error.fields.includes(field) &&
        (value === '' || !error.message.includes(value)),
    );
  }
});

test('invalid configuration prevents server startup and keeps values out of logs', () => {
  const result = spawnSync(process.execPath, ['dist/index.js'], {
    env: { ...process.env, APP_PORT: 'password=hidden', APP_HOST: '127.0.0.1' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /invalid_configuration/);
  assert.doesNotMatch(result.stdout + result.stderr, /password=hidden|server_started/);
});

test('log details redact sensitive field names', () => {
  assert.deepEqual(
    redactLogDetails({
      ['password']: 'one',
      apiToken: 'two',
      masterKey: 'three',
      authorization: 'four',
      secretPath: 'five',
      port: 3000,
    }),
    {
      ['password']: '[REDACTED]',
      apiToken: '[REDACTED]',
      masterKey: '[REDACTED]',
      authorization: '[REDACTED]',
      secretPath: '[REDACTED]',
      port: 3000,
    },
  );
});
