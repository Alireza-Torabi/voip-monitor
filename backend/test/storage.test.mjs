import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { createApp } from '../dist/server.js';
import { SqliteStorage, StorageError } from '../dist/storage/index.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { AuthService } from '../dist/auth/index.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-storage-'));
  try {
    const config = loadAppConfig({ DATA_PATH: directory });
    await run(config, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function request(server, path) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

test('fresh database migrates once and persists setup and PBX metadata across reopen', () =>
  fixture(async (config) => {
    const first = await SqliteStorage.open(config);
    assert.equal(first.healthCheck(), true);
    assert.equal(first.setup.get().state, 'SETUP_REQUIRED');
    assert.deepEqual(first.pbxInstances.list(), []);
    const history = first.migrationHistory();
    assert.equal(history.length, 10);
    assert.deepEqual(
      history.map((row) => row.version),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.match(history[0].checksum, /^[a-f0-9]{64}$/);
    first.setup.set('SETUP_IN_PROGRESS');
    const metadata = {
      id: 'synthetic-1',
      providerType: 'ASTERISK',
      displayName: 'Example',
      product: 'Synthetic',
    };
    first.pbxInstances.save(metadata);
    assert.deepEqual(first.pbxInstances.get(metadata.id), metadata);
    first.close();
    assert.equal(first.healthCheck(), false);
    first.close();

    const second = await SqliteStorage.open(config);
    try {
      assert.equal(second.setup.get().state, 'SETUP_IN_PROGRESS');
      assert.deepEqual(second.pbxInstances.list(), [metadata]);
      assert.deepEqual(second.migrationHistory(), history);
    } finally {
      second.close();
    }
  }));

test('system metrics persistence keeps current state monotonic and history retention bounded', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    try {
      storage.pbxInstances.save({
        id: 'metrics-pbx',
        providerType: 'ASTERISK',
        displayName: 'Metrics',
      });
      const sample = (observedAt) => ({
        instanceId: 'metrics-pbx',
        source: 'SSH',
        observedAt,
        capabilities: {
          cpu: 'SUPPORTED',
          memory: 'NOT_CONFIGURED',
          filesystems: 'NOT_CONFIGURED',
          uptime: 'NOT_CONFIGURED',
          services: 'NOT_CONFIGURED',
        },
        cpu: { utilizationPercent: 25 },
      });
      storage.systemMetrics.save(sample('2026-09-26T10:00:00.000Z'), '2026-09-26T09:00:00.000Z');
      storage.systemMetrics.save(sample('2026-09-26T09:30:00.000Z'), '2026-09-26T09:00:00.000Z');
      assert.equal(
        storage.systemMetrics.getCurrent('metrics-pbx').observedAt,
        '2026-09-26T10:00:00.000Z',
      );
      assert.equal(
        storage.systemMetrics.listHistory(
          'metrics-pbx',
          '2026-09-26T09:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        2,
      );
      storage.systemMetrics.save(sample('2026-09-26T09:15:00.000Z'), '2026-09-26T09:20:00.000Z');
      assert.equal(
        storage.systemMetrics.getCurrent('metrics-pbx').observedAt,
        '2026-09-26T10:00:00.000Z',
      );
      assert.equal(
        storage.systemMetrics.listHistory(
          'metrics-pbx',
          '2026-09-26T09:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        2,
      );
      assert.equal(storage.systemMetrics.pruneBefore('2026-09-26T09:31:00.000Z'), 1);
      assert.equal(
        storage.systemMetrics.getCurrent('metrics-pbx').observedAt,
        '2026-09-26T10:00:00.000Z',
      );
    } finally {
      storage.close();
    }
  }));

test('security event persistence is duplicate-safe, monotonic, and retention-safe', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    try {
      storage.pbxInstances.save({
        id: 'security-pbx',
        providerType: 'ASTERISK',
        displayName: 'Security',
      });
      const success = (observedAt, streamGeneration, streamSequence) => ({
        instanceId: 'security-pbx',
        source: 'AMI',
        observedAt,
        ...(streamGeneration === undefined ? {} : { streamGeneration }),
        ...(streamSequence === undefined ? {} : { streamSequence }),
        type: 'AUTHENTICATION_SUCCESS',
      });
      const failure = (observedAt, streamGeneration, streamSequence) => ({
        instanceId: 'security-pbx',
        source: 'AMI',
        observedAt,
        ...(streamGeneration === undefined ? {} : { streamGeneration }),
        ...(streamSequence === undefined ? {} : { streamSequence }),
        type: 'AUTHENTICATION_FAILURE',
        reason: 'INVALID_PASSWORD',
      });

      storage.securityEvents.save(
        success('2026-09-26T10:00:00.000Z', 4, 10),
        '2026-09-26T09:00:00.000Z',
      );
      storage.securityEvents.save(
        success('2026-09-26T10:00:00.000Z', 4, 10),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(
        storage.securityEvents.listHistory(
          'security-pbx',
          '2026-09-26T09:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        1,
      );

      storage.securityEvents.save(
        failure('2026-09-26T10:01:00.000Z', 4, 9),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(storage.securityEvents.getCurrent('security-pbx').streamSequence, 10);

      storage.securityEvents.save(
        failure('2026-09-26T10:02:00.000Z', 5, 1),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(storage.securityEvents.getCurrent('security-pbx').streamGeneration, 5);

      storage.securityEvents.save(
        success('2026-09-26T09:30:00.000Z', 3, 99),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(storage.securityEvents.getCurrent('security-pbx').streamGeneration, 5);
      assert.equal(
        storage.securityEvents.listHistory(
          'security-pbx',
          '2026-09-26T08:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        4,
      );

      assert.equal(storage.securityEvents.pruneBefore('2026-09-26T10:00:30.000Z'), 2);
      assert.equal(
        storage.securityEvents.getCurrent('security-pbx').observedAt,
        '2026-09-26T10:02:00.000Z',
      );
    } finally {
      storage.close();
    }
  }));

test('security alert rule configuration is bounded, persistent, replaceable, and cascades', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    try {
      storage.pbxInstances.save({
        id: 'rule-pbx',
        providerType: 'ASTERISK',
        displayName: 'Rules',
      });
      storage.securityAlertRules.put({
        instanceId: 'rule-pbx',
        id: 'AUTHENTICATION_FAILURE_ANY',
        enabled: true,
      });
      storage.securityAlertRules.put({
        instanceId: 'rule-pbx',
        id: 'AUTHENTICATION_FAILURE_THRESHOLD',
        enabled: true,
        threshold: 3,
        windowSeconds: 60,
        reason: 'INVALID_PASSWORD',
      });
      assert.equal(storage.securityAlertRules.list('rule-pbx').length, 2);
      assert.equal(
        storage.securityAlertRules.get('rule-pbx', 'AUTHENTICATION_FAILURE_THRESHOLD').threshold,
        3,
      );
      storage.securityAlertRules.put({
        instanceId: 'rule-pbx',
        id: 'AUTHENTICATION_FAILURE_THRESHOLD',
        enabled: false,
        threshold: 5,
        windowSeconds: 120,
      });
      assert.equal(
        storage.securityAlertRules.get('rule-pbx', 'AUTHENTICATION_FAILURE_THRESHOLD').threshold,
        5,
      );
      assert.throws(
        () =>
          storage.securityAlertRules.put({
            instanceId: 'rule-pbx',
            id: 'AUTHENTICATION_FAILURE_THRESHOLD',
            enabled: true,
            threshold: 0,
            windowSeconds: 60,
          }),
        StorageError,
      );
      assert.equal(
        storage.securityAlertRules.delete('rule-pbx', 'AUTHENTICATION_FAILURE_ANY'),
        true,
      );
      storage.pbxProfiles.delete('rule-pbx');
      assert.deepEqual(storage.securityAlertRules.list('rule-pbx'), []);
    } finally {
      storage.close();
    }
  }));

test('security alert persistence is duplicate-safe, per-rule monotonic, retention-safe, and cascades', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    try {
      storage.pbxInstances.save({
        id: 'alert-pbx',
        providerType: 'ASTERISK',
        displayName: 'Alerts',
      });
      const alert = (ruleId, observedAt, streamGeneration, streamSequence, matchedEventCount) => ({
        instanceId: 'alert-pbx',
        ruleId,
        observedAt,
        matchedEventCount,
        ...(streamGeneration === undefined ? {} : { streamGeneration }),
        ...(streamSequence === undefined ? {} : { streamSequence }),
      });

      const any = alert('AUTHENTICATION_FAILURE_ANY', '2026-09-26T10:00:00.000Z', 2, 10, 1);
      let publications = 0;
      const unsubscribe = storage.securityAlerts.subscribe(() => {
        publications += 1;
        throw new Error('synthetic listener failure');
      });
      storage.securityAlerts.save(any, '2026-09-26T09:00:00.000Z');
      storage.securityAlerts.save(any, '2026-09-26T09:00:00.000Z');
      unsubscribe();
      assert.equal(publications, 1);
      assert.equal(
        storage.securityAlerts.listHistory(
          'alert-pbx',
          '2026-09-26T09:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        1,
      );

      storage.securityAlerts.save(
        alert('AUTHENTICATION_FAILURE_ANY', '2026-09-26T10:01:00.000Z', 2, 9, 1),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(
        storage.securityAlerts.getCurrent('alert-pbx', 'AUTHENTICATION_FAILURE_ANY').streamSequence,
        10,
      );

      storage.securityAlerts.save(
        alert('AUTHENTICATION_FAILURE_THRESHOLD', '2026-09-26T10:02:00.000Z', 2, 11, 4),
        '2026-09-26T09:00:00.000Z',
      );
      assert.equal(storage.securityAlerts.listCurrent('alert-pbx').length, 2);

      storage.securityAlerts.save(
        alert('AUTHENTICATION_FAILURE_ANY', '2026-09-26T10:03:00.000Z', 3, 1, 1),
        '2026-09-26T10:01:30.000Z',
      );
      assert.equal(
        storage.securityAlerts.getCurrent('alert-pbx', 'AUTHENTICATION_FAILURE_ANY')
          .streamGeneration,
        3,
      );
      assert.equal(
        storage.securityAlerts.listHistory(
          'alert-pbx',
          '2026-09-26T09:00:00.000Z',
          '2026-09-26T11:00:00.000Z',
          10,
        ).length,
        2,
      );
      assert.equal(storage.securityAlerts.pruneBefore('2026-09-26T10:02:30.000Z'), 1);
      assert.equal(storage.securityAlerts.listCurrent('alert-pbx').length, 2);

      assert.throws(
        () =>
          storage.securityAlerts.save(
            {
              instanceId: 'alert-pbx',
              ruleId: 'AUTHENTICATION_FAILURE_THRESHOLD',
              observedAt: 'invalid',
              matchedEventCount: 1,
            },
            '2026-09-26T09:00:00.000Z',
          ),
        StorageError,
      );

      storage.pbxProfiles.delete('alert-pbx');
      assert.deepEqual(storage.securityAlerts.listCurrent('alert-pbx'), []);
    } finally {
      storage.close();
    }
  }));

test('changed migration history fails closed', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    storage.close();
    const db = new DatabaseSync(config.databasePath);
    db.prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 1').run('tampered');
    db.close();
    await assert.rejects(SqliteStorage.open(config), StorageError);
  }));

test('failed initial migration rolls back its schema and stops startup', () =>
  fixture(async (config) => {
    const db = new DatabaseSync(config.databasePath);
    db.exec('CREATE TABLE application_state (conflict TEXT)');
    db.close();
    await assert.rejects(SqliteStorage.open(config), StorageError);
    const inspect = new DatabaseSync(config.databasePath);
    try {
      const rows = inspect.prepare('SELECT version FROM schema_migrations').all();
      assert.deepEqual(rows, []);
      assert.equal(
        inspect.prepare("SELECT name FROM sqlite_master WHERE name = 'pbx_instance'").get(),
        undefined,
      );
    } finally {
      inspect.close();
    }
  }));

test('health remains live while readiness reflects storage, including no PBX', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    const secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    const server = createApp(storage, secrets, auth);
    try {
      const ready = await request(server, '/ready');
      assert.equal(ready.status, 200);
      assert.deepEqual(await ready.json(), { status: 'ready' });
      assert.deepEqual(storage.pbxInstances.list(), []);
      const health = await fetch(ready.url.replace('/ready', '/health'));
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok' });
      storage.close();
      const unavailable = await fetch(ready.url);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
      const live = await fetch(health.url);
      assert.equal(live.status, 200);
    } finally {
      server.close();
      secrets.close();
      storage.close();
    }
  }));

test('database initialization failure exits without listening or leaking path', () =>
  fixture(async (config) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        DATA_PATH: config.dataDirectory,
        APP_DATABASE_PATH: config.dataDirectory,
        APP_PORT: '1',
      },
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      output += chunk;
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(output, /storage_initialization_failed/);
    assert.doesNotMatch(output, /server_started/);
    assert.doesNotMatch(output, new RegExp(config.dataDirectory));
  }));
