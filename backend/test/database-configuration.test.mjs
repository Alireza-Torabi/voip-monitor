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
    username: 'readonly_monitor',
    credential: 'synthetic-database-password',
    accessMode: 'READ_ONLY',
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
    assert.equal(safe.username, 'readonly_monitor');
    assert.equal(safe.accessMode, 'READ_ONLY');
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
      { username: 'bad\u0000user' },
      { credential: '' },
      { accessMode: 'READ_WRITE' },
    ]) {
      assert.throws(
        () => service.configure(PBX_ID, databaseConfiguration(invalid)),
        (error) =>
          error instanceof DatabaseSourceConfigurationError && error.code === 'INVALID_INPUT',
      );
    }
    assert.equal(storage.databaseSourceConfigs.get(PBX_ID), undefined);
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

async function serveApi(storage, secrets, auth, databaseSourceConfiguration) {
  const server = createApp(
    storage,
    secrets,
    auth,
    undefined,
    undefined,
    undefined,
    undefined,
    databaseSourceConfiguration,
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
      assert.equal(saved.hasCredential, true);

      const readText = await (await fetch(app.base + path, { headers: { cookie } })).text();
      assert.ok(!readText.includes('synthetic-database-password'));
      assert.equal(JSON.parse(readText).databaseName, 'pbx_reporting');

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
