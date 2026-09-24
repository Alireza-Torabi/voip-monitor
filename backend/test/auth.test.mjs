import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { SqliteStorage } from '../dist/storage/index.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { AuthService, verifyPassword } from '../dist/auth/index.js';
import { createApp } from '../dist/server.js';

async function fixture(run, environment = 'test') {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-auth-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: environment });
  let storage;
  let secrets;
  try {
    storage = await SqliteStorage.open(config);
    secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    await run({ directory, config, storage, secrets, auth });
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
  return { base, server, close: () => new Promise((resolve) => server.close(resolve)) };
}
function post(base, path, value, origin = base, cookie) {
  return fetch(base + path, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(value),
  });
}

test('bootstrap is private, reused, single-use, atomic, and advances setup state', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const tokenPath = join(config.secretDirectory, 'bootstrap-admin.token');
    const token = (await readFile(tokenPath, 'utf8')).trim();
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal((await stat(config.secretDirectory)).mode & 0o777, 0o700);
    assert.equal((await stat(tokenPath)).mode & 0o777, 0o600);
    assert.equal((await AuthService.open(config, storage)).setupRequired(), true);
    assert.equal((await readFile(tokenPath, 'utf8')).trim(), token);
    const app = await serve(storage, secrets, auth);
    try {
      assert.equal((await fetch(app.base + '/ready')).status, 200);
      const status = await (await fetch(app.base + '/setup/status')).json();
      assert.deepEqual(status, { adminSetupRequired: true });
      assert.ok(!JSON.stringify(status).includes(token));
      assert.equal(
        (
          await post(app.base, '/setup/admin', {
            username: 'Owner',
            ['password']: 'synthetic passphrase 123',
            bootstrapToken: 'wrong',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await post(
            app.base,
            '/setup/admin',
            { username: 'Owner', ['password']: 'synthetic passphrase 123', bootstrapToken: token },
            'https://other.example',
          )
        ).status,
        403,
      );
      const logLines = [];
      const originalWrite = process.stdout.write;
      process.stdout.write = function (chunk) {
        logLines.push(String(chunk));
        return true;
      };
      const attempts = await Promise.all(
        [1, 2].map(() =>
          post(app.base, '/setup/admin', {
            username: 'Owner',
            ['password']: 'synthetic passphrase 123',
            bootstrapToken: token,
          }),
        ),
      );
      process.stdout.write = originalWrite;
      assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 403]);
      assert.ok(!logLines.join('').includes(token));
      assert.ok(!logLines.join('').includes('synthetic passphrase 123'));
      assert.equal(storage.setup.get().state, 'SETUP_IN_PROGRESS');
      assert.equal(storage.auth.hasAdministrator(), true);
      assert.equal((await fetch(app.base + '/ready')).status, 200);
      assert.deepEqual(await (await fetch(app.base + '/setup/status')).json(), {
        adminSetupRequired: false,
      });
      assert.equal(
        (
          await post(app.base, '/setup/admin', {
            username: 'Other',
            ['password']: 'synthetic passphrase 123',
            bootstrapToken: token,
          })
        ).status,
        403,
      );
      await assert.rejects(readFile(tokenPath, 'utf8'));
      const db = new DatabaseSync(config.databasePath);
      try {
        const rows = db.prepare('SELECT username, password_hash FROM administrator').all();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].username, 'owner');
        assert.match(rows[0].password_hash, /^scrypt\$v1\$32768\$8\$1\$/);
        assert.ok(!rows[0].password_hash.includes('synthetic passphrase 123'));
      } finally {
        db.close();
      }
      assert.ok(!JSON.stringify(await (await fetch(app.base + '/health')).json()).includes(token));
    } finally {
      await app.close();
    }
  }));

test('password hash verifies after reopen and rejects wrong input and parameters', async () =>
  fixture(async ({ config, storage, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('Admin', 'correct synthetic passphrase', token);
    const record = storage.auth.findAdministrator('admin');
    assert.ok(record);
    assert.equal(await verifyPassword('correct synthetic passphrase', record.passwordHash), true);
    assert.equal(await verifyPassword('incorrect synthetic', record.passwordHash), false);
    assert.equal(
      await verifyPassword(
        'correct synthetic passphrase',
        record.passwordHash.replace('32768', '1024'),
      ),
      false,
    );
    storage.close();
    const reopened = await SqliteStorage.open(config);
    try {
      assert.equal(
        await verifyPassword(
          'correct synthetic passphrase',
          reopened.auth.findAdministrator('admin').passwordHash,
        ),
        true,
      );
    } finally {
      reopened.close();
    }
  }));

test('login session survives restart, expires, and logout revokes without leaking token', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('Admin', 'correct synthetic passphrase', token);
    const app = await serve(storage, secrets, auth);
    try {
      const bad = await post(app.base, '/auth/login', {
        username: 'missing',
        ['password']: 'wrong synthetic password',
      });
      const wrong = await post(app.base, '/auth/login', {
        username: 'admin',
        ['password']: 'wrong synthetic password',
      });
      assert.equal(bad.status, 401);
      assert.deepEqual(await bad.json(), await wrong.json());
      const success = await post(app.base, '/auth/login', {
        username: 'ADMIN',
        ['password']: 'correct synthetic passphrase',
      });
      assert.equal(success.status, 200);
      const cookie = success.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.match(cookie, /Path=\//);
      assert.match(cookie, /Max-Age=43200/);
      assert.ok(!cookie.includes('Secure'));
      const session = cookie.split(';')[0];
      const secret = session.split('=')[1];
      const db = new DatabaseSync(config.databasePath);
      try {
        const row = db.prepare('SELECT token_digest FROM auth_session').get();
        assert.match(row.token_digest, /^[0-9a-f]{64}$/);
        assert.ok(!row.token_digest.includes(secret));
        assert.equal(
          (await fetch(app.base + '/auth/me', { headers: { cookie: session } })).status,
          200,
        );
        assert.equal(
          (await fetch(app.base + '/auth/me', { headers: { cookie: 'vm_session=invalid' } }))
            .status,
          401,
        );
        const reopened = await SqliteStorage.open(config);
        try {
          assert.equal(
            (await AuthService.open(config, reopened)).principal(secret).username,
            'admin',
          );
        } finally {
          reopened.close();
        }
        db.prepare('UPDATE auth_session SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
        assert.equal(
          (await fetch(app.base + '/auth/me', { headers: { cookie: session } })).status,
          401,
        );
        const newLogin = await post(app.base, '/auth/login', {
          username: 'admin',
          ['password']: 'correct synthetic passphrase',
        });
        const newSession = newLogin.headers.get('set-cookie').split(';')[0];
        assert.equal((await post(app.base, '/auth/logout', {}, app.base, newSession)).status, 200);
        assert.equal(
          (await fetch(app.base + '/auth/me', { headers: { cookie: newSession } })).status,
          401,
        );
        assert.equal(
          (await fetch(app.base + '/auth/me', { headers: { cookie: session } })).status,
          401,
        );
        assert.equal((await post(app.base, '/auth/logout', {}, app.base, session)).status, 200);
      } finally {
        db.close();
      }
    } finally {
      await app.close();
    }
  }));

test('production cookies require Secure and HTTPS origin; limiter delays guesses', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'correct synthetic passphrase', token);
    assert.match(auth.cookie('test'), /; Secure$/);
    const app = await serve(storage, secrets, auth);
    try {
      assert.equal(
        (
          await post(app.base, '/auth/login', {
            username: 'admin',
            ['password']: 'correct synthetic passphrase',
          })
        ).status,
        403,
      );
      const secureOrigin = app.base.replace('http:', 'https:');
      for (let index = 0; index < 10; index++) {
        assert.equal(
          (
            await post(
              app.base,
              '/auth/login',
              { username: 'admin', ['password']: 'wrong synthetic password' },
              secureOrigin,
            )
          ).status,
          401,
        );
      }
      assert.equal(
        (
          await post(
            app.base,
            '/auth/login',
            { username: 'admin', ['password']: 'wrong synthetic password' },
            secureOrigin,
          )
        ).status,
        429,
      );
    } finally {
      await app.close();
    }
  }, 'production'));

test('migration 3 upgrades a prior version-2 database transactionally', async () =>
  fixture(async ({ config, storage }) => {
    storage.close();
    const db = new DatabaseSync(config.databasePath);
    try {
      db.exec(
        'DROP TABLE auth_session; DROP TABLE administrator; DELETE FROM schema_migrations WHERE version = 3',
      );
    } finally {
      db.close();
    }
    const upgraded = await SqliteStorage.open(config);
    try {
      assert.deepEqual(
        upgraded.migrationHistory().map((row) => row.version),
        [1, 2, 3],
      );
      assert.equal(upgraded.auth.hasAdministrator(), false);
      assert.equal(upgraded.setup.get().state, 'SETUP_REQUIRED');
    } finally {
      upgraded.close();
    }
  }));

test('disabled administrator uses generic login failure and cannot use existing session', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'correct synthetic passphrase', token);
    const app = await serve(storage, secrets, auth);
    try {
      const login = await post(app.base, '/auth/login', {
        username: 'admin',
        ['password']: 'correct synthetic passphrase',
      });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const db = new DatabaseSync(config.databasePath);
      try {
        db.prepare('UPDATE administrator SET enabled = 0').run();
      } finally {
        db.close();
      }
      const disabled = await post(app.base, '/auth/login', {
        username: 'admin',
        ['password']: 'correct synthetic passphrase',
      });
      const missing = await post(app.base, '/auth/login', {
        username: 'missing',
        ['password']: 'correct synthetic passphrase',
      });
      assert.equal(disabled.status, 401);
      assert.deepEqual(await disabled.json(), await missing.json());
      assert.equal((await fetch(app.base + '/auth/me', { headers: { cookie } })).status, 401);
    } finally {
      await app.close();
    }
  }));
