import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { once } from 'node:events';
import dns from 'node:dns';
import net from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { AuthService } from '../dist/auth/index.js';
import { loadAppConfig } from '../dist/config.js';
import {
  DATABASE_SOURCE_SECRET_NAMES,
  DatabaseSourceConfigurationError,
  DatabaseSourceConfigurationService,
} from '../dist/database/configuration.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { createApp } from '../dist/server.js';
import { SqliteStorage } from '../dist/storage/index.js';

const PBX_ID = '77777777-7777-4777-8777-777777777777';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-db-source-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  let storage;
  let secrets;
  try {
    storage = await SqliteStorage.open(config);
    storage.pbxProfiles.create({
      id: PBX_ID,
      displayName: 'Synthetic PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-admin',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    });
    secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    await run({ config, storage, secrets, auth });
  } finally {
    secrets?.close();
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function databaseConfiguration(overrides = {}) {
  return {
    dialect: 'MYSQL_MARIADB',
    host: 'db.example.test',
    port: 3306,
    databaseName: 'pbx_reporting',
    databaseScopes: ['pbx_reporting', 'pbx_config'],
    username: 'readonly_monitor',
    credential: 'synthetic-database-password',
    accessMode: 'READ_ONLY',
    tlsMode: 'REQUIRED',
    ...overrides,
  };
}

test('database source stores metadata separately and encrypts the write-only credential', async () =>
  fixture(async ({ config, storage, secrets }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    const safe = service.configure(PBX_ID, databaseConfiguration());

    assert.equal(safe.pbxInstanceId, PBX_ID);
    assert.equal(safe.dialect, 'MYSQL_MARIADB');
    assert.equal(safe.host, 'db.example.test');
    assert.equal(safe.port, 3306);
    assert.equal(safe.databaseName, 'pbx_reporting');
    assert.deepEqual(safe.databaseScopes, ['pbx_reporting', 'pbx_config']);
    assert.equal(safe.username, 'readonly_monitor');
    assert.equal(safe.accessMode, 'READ_ONLY');
    assert.equal(safe.tlsMode, 'REQUIRED');
    assert.equal(safe.hasCredential, true);
    assert.ok(!JSON.stringify(safe).includes('synthetic-database-password'));
    assert.equal(
      secrets.getSecret(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential).toString(),
      'synthetic-database-password',
    );

    const db = new DatabaseSync(config.databasePath);
    try {
      const metadata = db
        .prepare('SELECT * FROM database_source_config WHERE pbx_instance_id = ?')
        .get(PBX_ID);
      const encrypted = db
        .prepare('SELECT * FROM pbx_secret WHERE pbx_instance_id = ? AND secret_name = ?')
        .get(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential);
      assert.ok(metadata);
      assert.equal(metadata.access_mode, 'READ_ONLY');
      assert.equal(metadata.tls_mode, 'REQUIRED');
      assert.deepEqual(JSON.parse(metadata.database_scopes_json), ['pbx_reporting', 'pbx_config']);
      assert.ok(!JSON.stringify(metadata).includes('synthetic-database-password'));
      assert.ok(!JSON.stringify(encrypted).includes('synthetic-database-password'));
    } finally {
      db.close();
    }
  }));

test('database source configuration is syntax-only and never resolves or opens a socket', async () =>
  fixture(async ({ storage, secrets }) => {
    const originalLookup = dns.lookup;
    const originalConnect = net.connect;
    dns.lookup = () => {
      throw new Error('DNS access forbidden');
    };
    net.connect = () => {
      throw new Error('socket access forbidden');
    };
    try {
      const service = new DatabaseSourceConfigurationService(storage, secrets);
      const safe = service.configure(PBX_ID, databaseConfiguration());
      assert.equal(safe.hasCredential, true);
      assert.equal(service.get(PBX_ID)?.accessMode, 'READ_ONLY');
      assert.equal(
        service.configure(
          PBX_ID,
          databaseConfiguration({ dialect: 'POSTGRESQL', port: 5432, databaseName: 'reporting' }),
        ).dialect,
        'POSTGRESQL',
      );
    } finally {
      dns.lookup = originalLookup;
      net.connect = originalConnect;
    }
  }));

test('database source rejects invalid or non-read-only configuration', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    assert.throws(
      () => service.configure('88888888-8888-4888-8888-888888888888', databaseConfiguration()),
      (error) =>
        error instanceof DatabaseSourceConfigurationError && error.code === 'PBX_NOT_FOUND',
    );
    for (const invalid of [
      { dialect: 'SQLITE' },
      { host: 'http://db.example.test' },
      { port: 0 },
      { databaseName: '' },
      { databaseScopes: Array.from({ length: 17 }, (_, index) => `scope_${index}`) },
      { username: 'bad\u0000user' },
      { credential: '' },
      { accessMode: 'READ_WRITE' },
      { tlsMode: 'OPPORTUNISTIC' },
    ]) {
      assert.throws(
        () => service.configure(PBX_ID, databaseConfiguration(invalid)),
        (error) =>
          error instanceof DatabaseSourceConfigurationError && error.code === 'INVALID_INPUT',
      );
    }
    assert.equal(storage.databaseSourceConfigs.get(PBX_ID), undefined);
  }));

test('database source normalizes empty scopes to a safe dialect-specific default', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    const mysql = service.configure(PBX_ID, databaseConfiguration({ databaseScopes: [] }));
    assert.deepEqual(mysql.databaseScopes, ['pbx_reporting']);
    const postgres = service.configure(
      PBX_ID,
      databaseConfiguration({
        dialect: 'POSTGRESQL',
        port: 5432,
        databaseName: 'reporting_db',
        databaseScopes: [],
      }),
    );
    assert.deepEqual(postgres.databaseScopes, ['public']);
  }));

test('database source removal deletes only its credential and PBX deletion cascades metadata', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    service.configure(PBX_ID, databaseConfiguration());
    secrets.putSecret(PBX_ID, 'ami-password', Buffer.from('synthetic-ami-secret'));

    assert.equal(service.delete(PBX_ID), true);
    assert.equal(storage.databaseSourceConfigs.get(PBX_ID), undefined);
    assert.equal(secrets.hasSecret(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential), false);
    assert.equal(secrets.hasSecret(PBX_ID, 'ami-password'), true);
    assert.equal(service.delete(PBX_ID), false);

    service.configure(PBX_ID, databaseConfiguration());
    assert.equal(storage.pbxProfiles.delete(PBX_ID), true);
    assert.equal(storage.databaseSourceConfigs.get(PBX_ID), undefined);
    assert.equal(
      storage.secretRecords.has(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential),
      false,
    );
  }));

async function serveApi(
  storage,
  secrets,
  auth,
  databaseSourceConfiguration,
  historicalSource,
  databaseSourceVerifier = { verify: async () => undefined },
) {
  const server = createApp(
    storage,
    secrets,
    auth,
    undefined,
    undefined,
    undefined,
    undefined,
    databaseSourceConfiguration,
    historicalSource,
    undefined,
    databaseSourceVerifier,
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function login(base, config) {
  const token = (
    await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
  ).trim();
  let response = await fetch(base + '/setup/admin', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      ['password']: 'synthetic admin passphrase',
      bootstrapToken: token,
    }),
  });
  assert.equal(response.status, 201);
  response = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', ['password']: 'synthetic admin passphrase' }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('database source API is authenticated, same-origin protected and credential-safe', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    const app = await serveApi(storage, secrets, auth, service);
    try {
      const path = '/api/pbx-instances/' + PBX_ID + '/database-source';
      assert.equal((await fetch(app.base + path)).status, 401);
      const cookie = await login(app.base, config);

      assert.equal(
        (
          await fetch(app.base + path, {
            method: 'PUT',
            headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' },
            body: JSON.stringify(databaseConfiguration()),
          })
        ).status,
        403,
      );

      const savedResponse = await fetch(app.base + path, {
        method: 'PUT',
        headers: { cookie, origin: app.base, 'content-type': 'application/json' },
        body: JSON.stringify(databaseConfiguration()),
      });
      assert.equal(savedResponse.status, 200);
      const savedText = await savedResponse.text();
      assert.ok(!savedText.includes('synthetic-database-password'));
      assert.ok(!savedText.includes('ciphertext'));
      const saved = JSON.parse(savedText);
      assert.equal(saved.accessMode, 'READ_ONLY');
      assert.equal(saved.tlsMode, 'REQUIRED');
      assert.equal(saved.hasCredential, true);

      const readText = await (await fetch(app.base + path, { headers: { cookie } })).text();
      assert.ok(!readText.includes('synthetic-database-password'));
      assert.equal(JSON.parse(readText).databaseName, 'pbx_reporting');
      assert.deepEqual(JSON.parse(readText).databaseScopes, ['pbx_reporting', 'pbx_config']);

      const deleted = await fetch(app.base + path, {
        method: 'DELETE',
        headers: { cookie, origin: app.base },
      });
      assert.equal(deleted.status, 200);
      assert.equal((await fetch(app.base + path, { headers: { cookie } })).status, 404);
    } finally {
      await app.close();
    }
  }));

test('source-backed history API is authenticated and bounded without raw SQL exposure', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    const calls = [];
    const historicalSource = {
      inspect: async (id) => ({
        instanceId: id,
        source: 'DATABASE',
        adapter: 'ASTERISK_CONVENTIONAL_SQL_V1',
        calls: { availability: 'SUPPORTED' },
        callEvents: { availability: 'NOT_FOUND' },
        queueEvents: { availability: 'SCHEMA_MISMATCH' },
        queueAbandonment: { availability: 'SUPPORTED' },
        queuePerformance: { availability: 'SUPPORTED' },
      }),
      callOutcomeAnalytics: async (id, from, to) => {
        calls.push({ id, from, to });
        return {
          instanceId: id,
          source: 'DATABASE',
          from,
          to,
          totalCalls: 10,
          answeredCalls: 6,
          noAnswerCalls: 2,
          busyCalls: 1,
          failedCalls: 0,
          unknownCalls: 1,
          answerRatioPercent: 60,
          averageDurationSeconds: 31.5,
        };
      },
      queueAbandonmentAnalytics: async (id, queueId, from, to, longWaitThresholdMinutes) => {
        calls.push({ id, queueId, from, to, longWaitThresholdMinutes });
        return {
          instanceId: id,
          source: 'DATABASE',
          from,
          to,
          queueId,
          longWaitThresholdMinutes,
          enteredCalls: 20,
          connectedCalls: 14,
          abandonedCalls: 4,
          timedOutCalls: 2,
          longWaitAbandonedCalls: 2,
          abandonmentRatePercent: 20,
          averageWaitBeforeAbandonSeconds: 37.5,
          p50WaitBeforeAbandonSeconds: 25,
          p90WaitBeforeAbandonSeconds: 70,
        };
      },
      listQueueIds: async (id) => {
        calls.push({ id, queueOptions: true });
        return ['sales', 'support'];
      },
      queuePerformanceReport: async (id, queueIds, from, to) => {
        calls.push({ id, queueIds, from, to });
        return {
          instanceId: id,
          source: 'DATABASE',
          from,
          to,
          queueIds: [...queueIds],
          aggregationMode: 'SOURCE_AGGREGATE_CHUNKED',
          chunkCount: 1,
          queues: queueIds.map((queueId, index) => ({
            queueId,
            enteredCalls: index === 0 ? 20 : 10,
            answeredCalls: index === 0 ? 14 : 8,
            unansweredCalls: index === 0 ? 6 : 2,
            confirmedLostCalls: index === 0 ? 6 : 2,
            callerAbandonedCalls: index === 0 ? 4 : 1,
            timedOutCalls: index === 0 ? 1 : 0,
            exitWithKeyCalls: index === 0 ? 1 : 0,
            forcedExitCalls: index === 0 ? 0 : 1,
            systemFailureCalls: 0,
            unresolvedUnansweredCalls: 0,
            outcomeExcessCalls: 0,
            ringNoAnswerAttempts: index === 0 ? 3 : 2,
            ringCanceledAttempts: index === 0 ? 1 : 0,
            incomingSharePercent: index === 0 ? 66.6666666667 : 33.3333333333,
            answerRatePercent: index === 0 ? 70 : 80,
            unansweredRatePercent: index === 0 ? 30 : 20,
            confirmedLostRatePercent: index === 0 ? 30 : 20,
            callerAbandonRatePercent: index === 0 ? 20 : 10,
            timedOutRatePercent: index === 0 ? 5 : 0,
            exitWithKeyRatePercent: index === 0 ? 5 : 0,
            forcedExitRatePercent: index === 0 ? 0 : 10,
            systemFailureRatePercent: 0,
            unresolvedUnansweredRatePercent: 0,
            ringNoAnswerAttemptsPer100Entered: index === 0 ? 15 : 20,
            averageAnswerSeconds: 10,
            averageWaitSeconds: index === 0 ? 30 : 20,
          })),
          total: {
            enteredCalls: 30,
            answeredCalls: 22,
            unansweredCalls: 8,
            confirmedLostCalls: 8,
            callerAbandonedCalls: 5,
            timedOutCalls: 1,
            exitWithKeyCalls: 1,
            forcedExitCalls: 1,
            systemFailureCalls: 0,
            unresolvedUnansweredCalls: 0,
            outcomeExcessCalls: 0,
            ringNoAnswerAttempts: 5,
            ringCanceledAttempts: 1,
            incomingSharePercent: 100,
            answerRatePercent: 73.3333333333,
            unansweredRatePercent: 26.6666666667,
            confirmedLostRatePercent: 26.6666666667,
            callerAbandonRatePercent: 16.6666666667,
            timedOutRatePercent: 3.3333333333,
            exitWithKeyRatePercent: 3.3333333333,
            forcedExitRatePercent: 3.3333333333,
            systemFailureRatePercent: 0,
            unresolvedUnansweredRatePercent: 0,
            ringNoAnswerAttemptsPer100Entered: 16.6666666667,
            averageAnswerSeconds: 10,
            averageWaitSeconds: 26.6666666667,
          },
        };
      },
      listRecentCalls: async (id, limit) => {
        calls.push({ id, limit });
        return [
          {
            instanceId: id,
            source: 'DATABASE',
            recordId: 'synthetic-call-1',
            sourceStartedAt: '2026-10-06 10:00:00',
            sourceNumber: '100',
            destinationNumber: '200',
            durationSeconds: 12,
            billableSeconds: 10,
            disposition: 'ANSWERED',
          },
        ];
      },
      listRecentCallEvents: async () => [],
      listRecentQueueEvents: async () => [],
    };
    const app = await serveApi(storage, secrets, auth, service, historicalSource);
    try {
      const basePath = '/api/pbx-instances/' + PBX_ID + '/history';
      assert.equal((await fetch(app.base + basePath)).status, 401);
      const cookie = await login(app.base, config);

      const capabilities = await fetch(app.base + basePath, { headers: { cookie } });
      assert.equal(capabilities.status, 200);
      assert.equal((await capabilities.json()).calls.availability, 'SUPPORTED');

      const rows = await fetch(app.base + basePath + '/calls?limit=3', { headers: { cookie } });
      assert.equal(rows.status, 200);
      const body = await rows.json();
      assert.equal(body.items.length, 1);
      assert.equal(body.items[0].recordId, 'synthetic-call-1');
      assert.deepEqual(calls, [{ id: PBX_ID, limit: 3 }]);

      const outcomes = await fetch(
        app.base + basePath + '/call-outcomes?from=2026-10-07T10%3A00&to=2026-10-08T10%3A00',
        {
          headers: { cookie },
        },
      );
      assert.equal(outcomes.status, 200);
      assert.equal((await outcomes.json()).answerRatioPercent, 60);
      assert.deepEqual(calls.at(-1), {
        id: PBX_ID,
        from: '2026-10-07T10:00',
        to: '2026-10-08T10:00',
      });
      assert.equal(
        (
          await fetch(app.base + basePath + '/call-outcomes?from=bad&to=2026-10-08T10%3A00', {
            headers: { cookie },
          })
        ).status,
        400,
      );

      const queueOptions = await fetch(app.base + basePath + '/queue-options', {
        headers: { cookie },
      });
      assert.equal(queueOptions.status, 200);
      assert.deepEqual((await queueOptions.json()).items, ['sales', 'support']);
      assert.deepEqual(calls.at(-1), { id: PBX_ID, queueOptions: true });

      const queuePerformance = await fetch(
        app.base +
          basePath +
          '/queue-performance?queue=support&queue=sales&from=2026-10-07T10%3A00&to=2026-10-08T10%3A00',
        { headers: { cookie } },
      );
      assert.equal(queuePerformance.status, 200);
      const queuePerformanceBody = await queuePerformance.json();
      assert.equal(queuePerformanceBody.total.enteredCalls, 30);
      assert.equal(queuePerformanceBody.queues.length, 2);
      assert.deepEqual(calls.at(-1), {
        id: PBX_ID,
        queueIds: ['support', 'sales'],
        from: '2026-10-07T10:00',
        to: '2026-10-08T10:00',
      });
      assert.equal(
        (
          await fetch(
            app.base +
              basePath +
              '/queue-performance?from=2026-10-07T10%3A00&to=2026-10-08T10%3A00',
            { headers: { cookie } },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(
            app.base +
              basePath +
              '/queue-performance?queue=support&queue=support&from=2026-10-07T10%3A00&to=2026-10-08T10%3A00',
            { headers: { cookie } },
          )
        ).status,
        400,
      );

      const queueAnalytics = await fetch(
        app.base +
          basePath +
          '/queue-abandonment?queue=support&from=2026-10-07T10%3A00&to=2026-10-08T10%3A00&longWaitMinutes=2',
        { headers: { cookie } },
      );
      assert.equal(queueAnalytics.status, 200);
      assert.equal((await queueAnalytics.json()).abandonedCalls, 4);
      assert.deepEqual(calls.at(-1), {
        id: PBX_ID,
        queueId: 'support',
        from: '2026-10-07T10:00',
        to: '2026-10-08T10:00',
        longWaitThresholdMinutes: 2,
      });
      assert.equal(
        (
          await fetch(
            app.base +
              basePath +
              '/queue-abandonment?queue=&from=2026-10-07T10%3A00&to=2026-10-08T10%3A00&longWaitMinutes=2',
            { headers: { cookie } },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(
            app.base +
              basePath +
              '/queue-abandonment?queue=support&from=2026-10-07T10%3A00&to=2026-10-08T10%3A00&longWaitMinutes=61',
            { headers: { cookie } },
          )
        ).status,
        400,
      );

      assert.equal(
        (await fetch(app.base + basePath + '/calls?limit=201', { headers: { cookie } })).status,
        400,
      );
      assert.equal(
        (
          await fetch(app.base + basePath + '/calls', {
            method: 'POST',
            headers: { cookie, origin: app.base },
          })
        ).status,
        404,
      );
    } finally {
      await app.close();
    }
  }));

test('database source API verifies before persistence and preserves prior config on failure', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const service = new DatabaseSourceConfigurationService(storage, secrets);
    service.configure(PBX_ID, databaseConfiguration());
    const before = service.get(PBX_ID);
    const beforeCredential = secrets
      .getSecret(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential)
      .toString();
    const verifier = {
      verify: async () => {
        const { DatabaseQueryError } = await import('../dist/database/query.js');
        throw new DatabaseQueryError('CONNECTION_FAILED');
      },
    };
    const app = await serveApi(storage, secrets, auth, service, undefined, verifier);
    try {
      const cookie = await login(app.base, config);
      const response = await fetch(app.base + '/api/pbx-instances/' + PBX_ID + '/database-source', {
        method: 'PUT',
        headers: { cookie, origin: app.base, 'content-type': 'application/json' },
        body: JSON.stringify(
          databaseConfiguration({
            host: 'new-db.example.test',
            credential: 'synthetic-invalid-value',
          }),
        ),
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, 'database_verification_failed');
      assert.deepEqual(service.get(PBX_ID), before);
      assert.equal(
        secrets.getSecret(PBX_ID, DATABASE_SOURCE_SECRET_NAMES.passwordCredential).toString(),
        beforeCredential,
      );
    } finally {
      await app.close();
    }
  }));
