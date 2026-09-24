import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { redactLogDetails } from '../dist/logger.js';
import { createApp } from '../dist/server.js';
import { SecretStore, SecretStorageError } from '../dist/security/secret-store.js';
import { AuthService } from '../dist/auth/index.js';
import { SqliteStorage } from '../dist/storage/index.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-secret-'));
  const config = loadAppConfig({ DATA_PATH: directory });
  try {
    await run(config);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function pbx(storage, id) {
  storage.pbxInstances.save({ id, providerType: 'ASTERISK', displayName: 'Synthetic' });
}
const keyPath = (config) => join(config.secretDirectory, 'master.key');

async function start(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

test('first key creation is restricted; reopening loads the same key', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    const first = await SecretStore.open(config, storage);
    const original = await readFile(keyPath(config));
    assert.equal(original.length, 32);
    if (process.platform !== 'win32') {
      assert.equal((await stat(config.secretDirectory)).mode & 0o777, 0o700);
      assert.equal((await stat(keyPath(config))).mode & 0o777, 0o600);
    }
    first.close();
    const second = await SecretStore.open(config, storage);
    assert.equal(second.healthCheck(), true);
    assert.deepEqual(await readFile(keyPath(config)), original);
    second.close();
    storage.close();
  }));

test('encrypted CRUD binds PBX and name, and metadata excludes plaintext', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    pbx(storage, 'pbx-a');
    pbx(storage, 'pbx-b');
    const secrets = await SecretStore.open(config, storage);
    const marker = 'synthetic-credential-marker-793';
    secrets.putSecret('pbx-a', 'api-token', Buffer.from(marker));
    assert.equal(secrets.hasSecret('pbx-a', 'api-token'), true);
    assert.equal(secrets.hasSecret('pbx-b', 'api-token'), false);
    assert.equal(secrets.getSecret('pbx-a', 'api-token')?.toString(), marker);
    assert.equal(secrets.getSecret('pbx-b', 'api-token'), undefined);
    const firstRecord = storage.secretRecords.get('pbx-a', 'api-token');
    assert.ok(firstRecord);
    assert.equal(firstRecord.envelopeVersion, 1);
    assert.equal(firstRecord.keyVersion, 1);
    assert.equal(firstRecord.nonce.length, 12);
    assert.equal(firstRecord.authTag.length, 16);
    assert.equal(firstRecord.ciphertext.includes(Buffer.from(marker)), false);
    assert.equal((await readFile(config.databasePath)).includes(Buffer.from(marker)), false);
    const metadata = secrets.listSecretMetadata('pbx-a');
    assert.equal(metadata.length, 1);
    assert.equal(JSON.stringify(metadata).includes(marker), false);
    assert.equal('ciphertext' in metadata[0], false);
    secrets.putSecret('pbx-a', 'api-token', Buffer.from(marker));
    const secondRecord = storage.secretRecords.get('pbx-a', 'api-token');
    assert.ok(secondRecord);
    assert.notDeepEqual(firstRecord.nonce, secondRecord.nonce);
    assert.notDeepEqual(firstRecord.ciphertext, secondRecord.ciphertext);
    assert.equal(secrets.listSecretMetadata('pbx-a').length, 1);
    assert.equal(secrets.deleteSecret('pbx-a', 'api-token'), true);
    assert.equal(secrets.deleteSecret('pbx-a', 'api-token'), false);
    assert.equal(secrets.hasSecret('pbx-a', 'api-token'), false);
    secrets.close();
    storage.close();
  }));

test('tampering ciphertext, tag, and record identity fails authentication', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    pbx(storage, 'pbx-a');
    pbx(storage, 'pbx-b');
    const secrets = await SecretStore.open(config, storage);
    secrets.putSecret('pbx-a', 'api-token', Buffer.from('synthetic-only'));
    const original = storage.secretRecords.get('pbx-a', 'api-token');
    assert.ok(original);
    const expectAuthFailure = () =>
      assert.throws(
        () => secrets.getSecret('pbx-a', 'api-token'),
        (error) => error instanceof SecretStorageError && error.code === 'AUTHENTICATION_FAILED',
      );
    const ciphertext = Buffer.from(original.ciphertext);
    ciphertext[0] ^= 1;
    storage.secretRecords.put({ ...original, ciphertext });
    expectAuthFailure();
    const authTag = Buffer.from(original.authTag);
    authTag[0] ^= 1;
    storage.secretRecords.put({ ...original, authTag });
    expectAuthFailure();
    storage.secretRecords.put({ ...original, secretName: 'other-name' });
    assert.throws(() => secrets.getSecret('pbx-a', 'other-name'), /authentication failed/);
    storage.secretRecords.put({ ...original, pbxInstanceId: 'pbx-b' });
    assert.throws(() => secrets.getSecret('pbx-b', 'api-token'), /authentication failed/);
    secrets.close();
    storage.close();
  }));

test('reopen decrypts with matching key; changed or missing key fails safely', () =>
  fixture(async (config) => {
    let storage = await SqliteStorage.open(config);
    pbx(storage, 'pbx-a');
    let secrets = await SecretStore.open(config, storage);
    secrets.putSecret('pbx-a', 'ssh-password', Buffer.from('synthetic-only'));
    secrets.close();
    storage.close();
    storage = await SqliteStorage.open(config);
    secrets = await SecretStore.open(config, storage);
    assert.equal(secrets.getSecret('pbx-a', 'ssh-password')?.toString(), 'synthetic-only');
    secrets.close();
    const original = await readFile(keyPath(config));
    await writeFile(keyPath(config), randomBytes(32), { mode: 0o600 });
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    await unlink(keyPath(config));
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    await assert.rejects(stat(keyPath(config)), { code: 'ENOENT' });
    await writeFile(keyPath(config), original, { mode: 0o600 });
    secrets = await SecretStore.open(config, storage);
    assert.equal(secrets.getSecret('pbx-a', 'ssh-password')?.toString(), 'synthetic-only');
    secrets.close();
    storage.close();
  }));

test('malformed, unreadable, and unavailable key paths fail without replacement', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    let secrets = await SecretStore.open(config, storage);
    secrets.close();
    const path = keyPath(config);
    await writeFile(path, Buffer.from('too-short'));
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    assert.equal((await readFile(path)).toString(), 'too-short');
    await writeFile(path, randomBytes(32));
    await chmod(path, 0o000);
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    await chmod(path, 0o600);
    await chmod(config.secretDirectory, 0o755);
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    await chmod(config.secretDirectory, 0o700);
    await rm(config.secretDirectory, { recursive: true });
    await writeFile(config.secretDirectory, Buffer.from('occupied'));
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    storage.close();
  }));

test('initial key creation rejects nonwritable directory and symlink key', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    await mkdir(config.secretDirectory, { mode: 0o500 });
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    await assert.rejects(stat(keyPath(config)), { code: 'ENOENT' });
    await chmod(config.secretDirectory, 0o700);
    const target = join(config.dataDirectory, 'other-file');
    await writeFile(target, randomBytes(32), { mode: 0o600 });
    await symlink(target, keyPath(config));
    await assert.rejects(SecretStore.open(config, storage), SecretStorageError);
    storage.close();
  }));

test('foreign key prevents secrets without a PBX and deletion cascades', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    const secrets = await SecretStore.open(config, storage);
    assert.throws(
      () => secrets.putSecret('missing-pbx', 'api-token', Buffer.from('synthetic')),
      (error) => error instanceof SecretStorageError && error.code === 'UNAVAILABLE',
    );
    pbx(storage, 'pbx-a');
    secrets.putSecret('pbx-a', 'api-token', Buffer.from('synthetic'));
    const db = new DatabaseSync(config.databasePath);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('DELETE FROM pbx_instance WHERE id = ?').run('pbx-a');
    db.close();
    assert.equal(secrets.hasSecret('pbx-a', 'api-token'), false);
    secrets.close();
    storage.close();
  }));

test('readiness requires key foundation but never exposes key or secret', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    const secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    const server = createApp(storage, secrets, auth);
    const base = await start(server);
    try {
      const ready = await fetch(`${base}/ready`);
      assert.equal(ready.status, 200);
      assert.deepEqual(await ready.json(), { status: 'ready' });
      assert.deepEqual(storage.pbxInstances.list(), []);
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 200);
      const response =
        JSON.stringify(await health.json()) +
        JSON.stringify(await (await fetch(`${base}/ready`)).json());
      assert.equal(response.includes((await readFile(keyPath(config))).toString('hex')), false);
      await unlink(keyPath(config));
      assert.equal((await fetch(`${base}/ready`)).status, 503);
      assert.equal((await fetch(`${base}/health`)).status, 200);
    } finally {
      server.close();
      secrets.close();
      storage.close();
    }
  }));

test('broken key blocks process startup and logs no plaintext', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    pbx(storage, 'pbx-a');
    const secrets = await SecretStore.open(config, storage);
    const marker = 'synthetic-do-not-log-419';
    secrets.putSecret('pbx-a', 'api-token', Buffer.from(marker));
    secrets.close();
    storage.close();
    await writeFile(keyPath(config), Buffer.from('invalid'));
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATA_PATH: config.dataDirectory, APP_PORT: '1' },
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
    assert.match(output, /secret_storage_initialization_failed/);
    assert.doesNotMatch(output, /server_started/);
    assert.equal(output.includes(marker), false);
    assert.equal(output.includes(config.dataDirectory), false);
    assert.deepEqual(redactLogDetails({ secretValue: marker }), { secretValue: '[REDACTED]' });
  }));

test('invalid identifiers cannot be used as paths, SQL structure, or log labels', () =>
  fixture(async (config) => {
    const storage = await SqliteStorage.open(config);
    const secrets = await SecretStore.open(config, storage);
    assert.throws(
      () => secrets.putSecret('pbx-a', '../escape', Buffer.from('synthetic')),
      /invalid identifier/,
    );
    assert.throws(() => secrets.getSecret('../escape', 'api-token'), /invalid identifier/);
    secrets.close();
    storage.close();
  }));
