import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { NetworkBoundaryError } from '../dist/network/policy.js';
import { SecretStore } from '../dist/security/secret-store.js';
import {
  isValidSha256HostKeyFingerprint,
  SSH_SECRET_NAMES,
  SshConfigurationError,
  SshConfigurationService,
  SshTrustError,
  validateSshResolvedTarget,
  verifyPinnedSshHostKey,
} from '../dist/ssh/index.js';
import { SqliteStorage } from '../dist/storage/index.js';

const PBX_ID = '11111111-1111-4111-8111-111111111111';

function fingerprintFor(value) {
  return 'SHA256:' + createHash('sha256').update(value).digest('base64').replace(/=+$/u, '');
}

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-ssh-config-'));
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
      createdAt: '2026-09-25T16:00:00.000Z',
      updatedAt: '2026-09-25T16:00:00.000Z',
    });
    secrets = await SecretStore.open(config, storage);
    await run({ config, storage, secrets });
  } finally {
    secrets?.close();
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function passwordConfiguration(overrides = {}) {
  return {
    host: 'pbx.example.test',
    port: 22,
    username: 'synthetic-monitor',
    authMethod: 'PASSWORD',
    credential: 'synthetic-ssh-password',
    hostKeyPolicy: 'PINNED_SHA256',
    hostKeyFingerprint: fingerprintFor('synthetic-host-key'),
    ...overrides,
  };
}

test('SSH configuration stores only metadata in ssh_config and encrypts password credentials', async () =>
  fixture(async ({ config, storage, secrets }) => {
    const service = new SshConfigurationService(storage, secrets);
    const safe = service.configure(PBX_ID, passwordConfiguration());

    assert.equal(safe.pbxInstanceId, PBX_ID);
    assert.equal(safe.host, 'pbx.example.test');
    assert.equal(safe.port, 22);
    assert.equal(safe.username, 'synthetic-monitor');
    assert.equal(safe.authMethod, 'PASSWORD');
    assert.equal(safe.hostKeyPolicy, 'PINNED_SHA256');
    assert.equal(safe.hasCredential, true);
    assert.equal(safe.hasPrivateKeyPassphrase, false);
    assert.ok(!JSON.stringify(safe).includes('synthetic-ssh-password'));

    assert.equal(
      secrets.getSecret(PBX_ID, SSH_SECRET_NAMES.passwordCredential).toString(),
      'synthetic-ssh-password',
    );
    assert.equal(secrets.hasSecret(PBX_ID, SSH_SECRET_NAMES.privateKeyCredential), false);

    const db = new DatabaseSync(config.databasePath);
    try {
      const metadata = db.prepare('SELECT * FROM ssh_config WHERE pbx_instance_id = ?').get(PBX_ID);
      const encrypted = db
        .prepare('SELECT * FROM pbx_secret WHERE pbx_instance_id = ? AND secret_name = ?')
        .get(PBX_ID, SSH_SECRET_NAMES.passwordCredential);
      assert.ok(metadata);
      assert.equal(metadata.auth_method, 'PASSWORD');
      assert.ok(!JSON.stringify(metadata).includes('synthetic-ssh-password'));
      assert.ok(!JSON.stringify(encrypted).includes('synthetic-ssh-password'));
    } finally {
      db.close();
    }
  }));

test('SSH configuration switches authentication methods atomically and removes obsolete secrets', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new SshConfigurationService(storage, secrets);
    service.configure(PBX_ID, passwordConfiguration());

    const privateKey = service.configure(PBX_ID, {
      host: '192.0.2.44',
      port: 2222,
      username: 'synthetic-monitor',
      authMethod: 'PRIVATE_KEY',
      credential: 'synthetic-private-key-material',
      keyPassphrase: 'synthetic-key-passphrase',
      hostKeyPolicy: 'PINNED_SHA256',
      hostKeyFingerprint: fingerprintFor('synthetic-host-key-2'),
    });

    assert.equal(privateKey.authMethod, 'PRIVATE_KEY');
    assert.equal(privateKey.hasCredential, true);
    assert.equal(privateKey.hasPrivateKeyPassphrase, true);
    assert.equal(secrets.hasSecret(PBX_ID, SSH_SECRET_NAMES.passwordCredential), false);
    assert.equal(
      secrets.getSecret(PBX_ID, SSH_SECRET_NAMES.privateKeyCredential).toString(),
      'synthetic-private-key-material',
    );
    assert.equal(
      secrets.getSecret(PBX_ID, SSH_SECRET_NAMES.privateKeyPassphrase).toString(),
      'synthetic-key-passphrase',
    );

    const passwordAgain = service.configure(
      PBX_ID,
      passwordConfiguration({
        credential: 'synthetic-replacement-password',
        hostKeyFingerprint: fingerprintFor('synthetic-host-key-3'),
      }),
    );
    assert.equal(passwordAgain.authMethod, 'PASSWORD');
    assert.equal(passwordAgain.hasPrivateKeyPassphrase, false);
    assert.equal(secrets.hasSecret(PBX_ID, SSH_SECRET_NAMES.privateKeyCredential), false);
    assert.equal(secrets.hasSecret(PBX_ID, SSH_SECRET_NAMES.privateKeyPassphrase), false);
  }));

test('SSH configuration requires an existing PBX, pinned SHA256 trust, and syntax-safe metadata', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new SshConfigurationService(storage, secrets);

    assert.throws(
      () => service.configure('22222222-2222-4222-8222-222222222222', passwordConfiguration()),
      (error) => error instanceof SshConfigurationError && error.code === 'PBX_NOT_FOUND',
    );

    for (const invalid of [
      { host: 'http://pbx.example.test' },
      { port: 0 },
      { username: 'bad\u0000user' },
      { username: 'bad user' },
      { username: 'bad@user' },
      { hostKeyPolicy: 'ACCEPT_NEW' },
      { hostKeyFingerprint: 'SHA256:not-valid' },
      { authMethod: 'PASSWORD', credential: '' },
    ]) {
      assert.throws(
        () => service.configure(PBX_ID, passwordConfiguration(invalid)),
        (error) => error instanceof SshConfigurationError && error.code === 'INVALID_INPUT',
      );
    }

    assert.equal(storage.sshConfigs.get(PBX_ID), undefined);
  }));

test('SSH configuration rolls back metadata when encrypted credential storage fails', async () =>
  fixture(async ({ storage }) => {
    const failingSecrets = {
      putSecret() {
        throw new Error('synthetic secret write failure');
      },
    };
    const service = new SshConfigurationService(storage, failingSecrets);

    assert.throws(
      () => service.configure(PBX_ID, passwordConfiguration()),
      /synthetic secret write failure/,
    );
    assert.equal(storage.sshConfigs.get(PBX_ID), undefined);
    assert.equal(storage.secretRecords.has(PBX_ID, SSH_SECRET_NAMES.passwordCredential), false);
  }));

test('SSH host trust accepts only the exact pinned key and never learns a new key', () => {
  const key = Buffer.from('synthetic-host-public-key-blob');
  const fingerprint = fingerprintFor(key);

  assert.equal(isValidSha256HostKeyFingerprint(fingerprint), true);
  verifyPinnedSshHostKey(fingerprint, key);

  assert.throws(
    () => verifyPinnedSshHostKey(fingerprint, Buffer.from('different-host-key')),
    (error) => error instanceof SshTrustError && error.code === 'HOST_KEY_MISMATCH',
  );
  assert.throws(
    () => verifyPinnedSshHostKey('SHA256:invalid', key),
    (error) => error instanceof SshTrustError && error.code === 'INVALID_FINGERPRINT',
  );
});

test('SSH target validation reuses the generic SSRF boundary without resolving or opening sockets', async () =>
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
      const service = new SshConfigurationService(storage, secrets);
      const safe = service.configure(PBX_ID, passwordConfiguration());

      assert.deepEqual(validateSshResolvedTarget(safe, ['192.0.2.45']), ['192.0.2.45']);
      assert.throws(
        () => validateSshResolvedTarget(safe, ['127.0.0.1']),
        (error) => error instanceof NetworkBoundaryError && error.reason === 'LOOPBACK',
      );
      assert.throws(
        () => validateSshResolvedTarget(safe, []),
        (error) => error instanceof NetworkBoundaryError && error.reason === 'RESOLUTION_REQUIRED',
      );
    } finally {
      dns.lookup = originalLookup;
      net.connect = originalConnect;
    }
  }));

test('deleting SSH configuration removes only SSH secrets and PBX deletion cascades metadata', async () =>
  fixture(async ({ storage, secrets }) => {
    const service = new SshConfigurationService(storage, secrets);
    service.configure(PBX_ID, passwordConfiguration());
    secrets.putSecret(PBX_ID, 'ami-password', Buffer.from('synthetic-ami-secret'));

    assert.equal(service.delete(PBX_ID), true);
    assert.equal(storage.sshConfigs.get(PBX_ID), undefined);
    assert.equal(secrets.hasSecret(PBX_ID, SSH_SECRET_NAMES.passwordCredential), false);
    assert.equal(secrets.hasSecret(PBX_ID, 'ami-password'), true);
    assert.equal(service.delete(PBX_ID), false);

    service.configure(PBX_ID, passwordConfiguration());
    assert.equal(storage.pbxProfiles.delete(PBX_ID), true);
    assert.equal(storage.sshConfigs.get(PBX_ID), undefined);
    assert.equal(storage.secretRecords.has(PBX_ID, SSH_SECRET_NAMES.passwordCredential), false);
  }));
