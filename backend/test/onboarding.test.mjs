import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import dns from 'node:dns';
import net from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { AuthService } from '../dist/auth/index.js';
import { PbxOnboardingService, validHost } from '../dist/onboarding/index.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { createApp } from '../dist/server.js';
import { SqliteStorage } from '../dist/storage/index.js';
import { migrations } from '../dist/storage/migrations.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-onboarding-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  let storage;
  let secrets;
  try {
    storage = await SqliteStorage.open(config);
    secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    await run({ config, storage, secrets, auth });
  } finally {
    secrets?.close();
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
async function serve(storage, secrets, auth) {
  const server = createApp(storage, secrets, auth);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}
function send(base, method, path, data, cookie, origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
const profile = (amiHost = 'pbx.example.test') => ({
  displayName: 'Synthetic PBX',
  providerType: 'ASTERISK',
  enabled: true,
  amiHost,
  amiPort: 5038,
  amiUsername: 'synthetic-admin',
  amiPassword: 'synthetic-ami-secret',
});
async function login(base, config) {
  const token = (
    await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
  ).trim();
  assert.equal(
    (
      await send(base, 'POST', '/setup/admin', {
        username: 'admin',
        ['password']: 'synthetic admin passphrase',
        bootstrapToken: token,
      })
    ).status,
    201,
  );
  const response = await send(base, 'POST', '/auth/login', {
    username: 'admin',
    ['password']: 'synthetic admin passphrase',
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('PBX CRUD requires administrator and same-origin writes; secrets never leave API', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const app = await serve(storage, secrets, auth);
    try {
      assert.equal((await fetch(app.base + '/api/pbx-instances')).status, 401);
      assert.equal((await send(app.base, 'POST', '/api/pbx-instances', profile())).status, 401);
      assert.equal(
        (await send(app.base, 'PATCH', '/api/pbx-instances/x', { enabled: false })).status,
        401,
      );
      assert.equal((await send(app.base, 'DELETE', '/api/pbx-instances/x')).status, 401);
      const cookie = await login(app.base, config);
      assert.equal(storage.setup.get().state, 'SETUP_IN_PROGRESS');
      assert.equal(
        (
          await send(
            app.base,
            'POST',
            '/api/pbx-instances',
            profile(),
            cookie,
            'https://evil.example',
          )
        ).status,
        403,
      );
      const createdResponse = await send(app.base, 'POST', '/api/pbx-instances', profile(), cookie);
      assert.equal(createdResponse.status, 201);
      const createdText = await createdResponse.text();
      assert.ok(!createdText.includes('synthetic-ami-secret'));
      assert.ok(!createdText.includes('ciphertext'));
      const created = JSON.parse(createdText);
      assert.equal(created.hasAmiPassword, true);
      assert.equal(created.connectionStatus, 'UNVERIFIED');
      assert.equal(created.amiHost, 'pbx.example.test');
      assert.equal(storage.setup.get().state, 'PBX_CONFIGURED_UNVERIFIED');
      assert.equal((await fetch(app.base + '/ready')).status, 200);
      const path = `/api/pbx-instances/${created.id}`;
      assert.equal((await fetch(app.base + path)).status, 401);
      const list = await (
        await fetch(app.base + '/api/pbx-instances', { headers: { cookie } })
      ).json();
      assert.equal(list.items.length, 1);
      assert.ok(!JSON.stringify(list).includes('synthetic-ami-secret'));
      const detail = await (await fetch(app.base + path, { headers: { cookie } })).json();
      assert.deepEqual(detail, created);
      const db = new DatabaseSync(config.databasePath);
      try {
        const row = db.prepare('SELECT * FROM pbx_instance WHERE id = ?').get(created.id);
        assert.ok(!JSON.stringify(row).includes('synthetic-ami-secret'));
        assert.ok(
          !JSON.stringify(db.prepare('SELECT * FROM asterisk_config').get()).includes(
            'synthetic-ami-secret',
          ),
        );
        assert.ok(
          !JSON.stringify(db.prepare('SELECT * FROM pbx_secret').get()).includes(
            'synthetic-ami-secret',
          ),
        );
      } finally {
        db.close();
      }
      assert.equal(
        secrets.getSecret(created.id, 'ami-password').toString(),
        'synthetic-ami-secret',
      );
      const modified = await send(
        app.base,
        'PATCH',
        path,
        { displayName: 'Renamed', enabled: false },
        cookie,
      );
      assert.equal(modified.status, 200);
      assert.equal((await modified.json()).hasAmiPassword, true);
      assert.equal(
        secrets.getSecret(created.id, 'ami-password').toString(),
        'synthetic-ami-secret',
      );
      assert.equal((await send(app.base, 'PATCH', path, { amiPassword: '' }, cookie)).status, 400);
      assert.equal(
        secrets.getSecret(created.id, 'ami-password').toString(),
        'synthetic-ami-secret',
      );
      assert.equal(
        (
          await send(
            app.base,
            'PATCH',
            path,
            { amiPassword: 'synthetic-new', removeAmiPassword: true },
            cookie,
          )
        ).status,
        400,
      );
      const replaced = await send(
        app.base,
        'PATCH',
        path,
        { amiPassword: 'synthetic-replacement' },
        cookie,
      );
      assert.equal(replaced.status, 200);
      assert.ok(!JSON.stringify(await replaced.json()).includes('synthetic-replacement'));
      assert.equal(
        secrets.getSecret(created.id, 'ami-password').toString(),
        'synthetic-replacement',
      );
      const removed = await send(app.base, 'PATCH', path, { removeAmiPassword: true }, cookie);
      assert.equal((await removed.json()).hasAmiPassword, false);
      assert.equal(secrets.hasSecret(created.id, 'ami-password'), false);
      assert.equal(
        (await send(app.base, 'DELETE', path, undefined, cookie, 'https://evil.example')).status,
        403,
      );
      assert.equal((await send(app.base, 'DELETE', path, undefined, cookie)).status, 200);
      assert.equal(storage.setup.get().state, 'SETUP_IN_PROGRESS');
      assert.equal((await fetch(app.base + '/ready')).status, 200);
      assert.equal((await fetch(app.base + path, { headers: { cookie } })).status, 404);
      assert.equal(storage.pbxProfiles.count(), 0);
    } finally {
      await app.close();
    }
  }));

test('host and payload validation is syntax-only and rejects malformed input', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    assert.equal(validHost('pbx.example.test'), true);
    assert.equal(validHost('192.0.2.1'), true);
    assert.equal(validHost('2001:db8::1'), true);
    for (const value of [
      'http://pbx.example.test',
      'pbx.example.test/path',
      'user@pbx.example.test',
      '192.0.2.999',
      'pbx;id',
    ])
      assert.equal(validHost(value), false);
    const app = await serve(storage, secrets, auth);
    try {
      const cookie = await login(app.base, config);
      for (const bad of [
        { amiPort: 0 },
        { amiPort: 65536 },
        { providerType: 'FREEPBX' },
        { amiHost: 'http://pbx.example.test' },
        { extra: 'unsafe' },
      ]) {
        const response = await send(
          app.base,
          'POST',
          '/api/pbx-instances',
          { ...profile(), ...bad },
          cookie,
        );
        assert.equal(response.status, 400);
      }
      assert.equal(storage.pbxProfiles.count(), 0);
    } finally {
      await app.close();
    }
  }));

test('failed credential write rolls back metadata and setup; delete cascades secrets', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'synthetic admin passphrase', token);
    const failing = new PbxOnboardingService(storage, {
      putSecret() {
        throw new Error('synthetic failure');
      },
    });
    assert.throws(() => failing.create(profile()), /synthetic failure/);
    assert.equal(storage.pbxProfiles.count(), 0);
    assert.equal(storage.setup.get().state, 'SETUP_IN_PROGRESS');
    const service = new PbxOnboardingService(storage, secrets);
    const created = service.create(profile('2001:db8::2'));
    assert.equal(storage.pbxProfiles.count(), 1);
    const failingUpdate = new PbxOnboardingService(storage, {
      putSecret() {
        throw new Error('synthetic failure');
      },
    });
    assert.throws(
      () =>
        failingUpdate.update(created.id, {
          displayName: 'Should roll back',
          amiPassword: 'synthetic-new',
        }),
      /synthetic failure/,
    );
    assert.equal(storage.pbxProfiles.get(created.id).displayName, 'Synthetic PBX');
    assert.equal(secrets.getSecret(created.id, 'ami-password').toString(), 'synthetic-ami-secret');
    const second = service.create(profile('192.0.2.2'));
    service.delete(created.id);
    assert.equal(storage.setup.get().state, 'PBX_CONFIGURED_UNVERIFIED');
    service.delete(second.id);
    assert.equal(storage.setup.get().state, 'SETUP_IN_PROGRESS');
    assert.equal(storage.pbxProfiles.count(), 0);
    assert.equal(storage.secretRecords.has(created.id, 'ami-password'), false);
  }));

test('notification channel API encrypts webhook targets and never exposes them', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const app = await serve(storage, secrets, auth);
    try {
      const cookie = await login(app.base, config);
      const createdResponse = await send(app.base, 'POST', '/api/pbx-instances', profile(), cookie);
      assert.equal(createdResponse.status, 201);
      const created = await createdResponse.json();
      const base = `/api/pbx-instances/${created.id}/notification-channels`;
      const channel = `${base}/ops-webhook`;

      assert.equal((await fetch(app.base + base)).status, 401);
      assert.equal(
        (
          await send(
            app.base,
            'PUT',
            channel,
            { displayName: 'Ops', enabled: true, targetUrl: 'https://hooks.example.test/voip' },
            cookie,
            'https://evil.example',
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await send(
            app.base,
            'PUT',
            channel,
            { displayName: 'Ops', enabled: true, targetUrl: 'http://hooks.example.test/voip' },
            cookie,
          )
        ).status,
        400,
      );

      const savedResponse = await send(
        app.base,
        'PUT',
        channel,
        { displayName: 'Ops', enabled: true, targetUrl: 'https://hooks.example.test/voip' },
        cookie,
      );
      assert.equal(savedResponse.status, 200);
      const savedText = await savedResponse.text();
      assert.ok(!savedText.includes('hooks.example.test'));
      assert.ok(!savedText.includes('secretName'));
      const saved = JSON.parse(savedText);
      assert.equal(saved.hasTarget, true);
      assert.equal(saved.transport, 'WEBHOOK');

      const internal = storage.notificationChannels.get('ops-webhook');
      assert.ok(internal);
      assert.equal(
        secrets.getSecret(created.id, internal.secretName).toString(),
        'https://hooks.example.test/voip',
      );

      const listText = await (await fetch(app.base + base, { headers: { cookie } })).text();
      assert.ok(!listText.includes('hooks.example.test'));
      assert.ok(!listText.includes('secretName'));
      assert.equal(JSON.parse(listText).items.length, 1);

      const updated = await send(
        app.base,
        'PUT',
        channel,
        { displayName: 'Ops renamed', enabled: false },
        cookie,
      );
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).hasTarget, true);

      assert.equal((await send(app.base, 'DELETE', channel, undefined, cookie)).status, 200);
      assert.equal(secrets.hasSecret(created.id, internal.secretName), false);
      assert.equal((await fetch(app.base + channel, { headers: { cookie } })).status, 404);
    } finally {
      await app.close();
    }
  }));

test('migration chain upgrades schema 3 without modifying published migrations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-upgrade-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  try {
    const db = new DatabaseSync(config.databasePath);
    try {
      db.exec(
        `CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT`,
      );
      for (const migration of migrations.slice(0, 3)) {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?, ?)').run(
          migration.version,
          migration.name,
          createHash('sha256').update(migration.sql).digest('hex'),
          new Date().toISOString(),
        );
      }
    } finally {
      db.close();
    }
    const upgraded = await SqliteStorage.open(config);
    try {
      assert.deepEqual(
        upgraded.migrationHistory().map((row) => row.version),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      );
      assert.equal(upgraded.setup.get().state, 'SETUP_REQUIRED');
    } finally {
      upgraded.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('onboarding stores addresses without DNS lookup or PBX socket access', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'synthetic admin passphrase', token);
    const originalLookup = dns.lookup;
    const originalConnect = net.connect;
    dns.lookup = () => {
      throw new Error('DNS access forbidden');
    };
    net.connect = () => {
      throw new Error('socket access forbidden');
    };
    try {
      const service = new PbxOnboardingService(storage, secrets);
      const created = service.create(profile('pbx.example.test'));
      assert.equal(created.connectionStatus, 'UNVERIFIED');
      service.update(created.id, { amiHost: '192.0.2.7' });
      service.delete(created.id);
    } finally {
      dns.lookup = originalLookup;
      net.connect = originalConnect;
    }
  }));
