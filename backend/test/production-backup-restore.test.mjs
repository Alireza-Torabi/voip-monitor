import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const root = new URL('../..', import.meta.url).pathname;
const backupScript = join(root, 'scripts', 'backup-production.sh');
const restoreScript = join(root, 'scripts', 'restore-production.sh');

function run(script, args) {
  return execFileSync(script, args, { encoding: 'utf8' });
}

test('production backup and restore round-trip validates checksums and overwrite protection', async () => {
  const base = await mkdtemp(join(tmpdir(), 'voip-monitor-backup-'));
  const source = join(base, 'source');
  const restored = join(base, 'restored');
  const backup = join(base, 'backup');
  await mkdir(source, { recursive: true });
  await mkdir(restored, { recursive: true });

  const database = join(source, 'monitor.sqlite3');
  const masterKey = join(source, 'master.key');
  const envFile = join(source, 'voip-monitor.env');
  const tlsCert = join(source, 'server.crt');
  const tlsKey = join(source, 'server.key');

  const sqlite = new DatabaseSync(database);
  sqlite.exec('CREATE TABLE recovery_probe (value TEXT NOT NULL)');
  sqlite.prepare('INSERT INTO recovery_probe (value) VALUES (?)').run('synthetic-recovery-ok');
  sqlite.close();
  await writeFile(masterKey, Buffer.alloc(32, 7));
  await writeFile(envFile, 'APP_ENV=production\n');
  await writeFile(tlsCert, 'synthetic-cert\n');
  await writeFile(tlsKey, 'synthetic-key\n');

  assert.match(
    run(backupScript, [
      '--database',
      database,
      '--master-key',
      masterKey,
      '--env-file',
      envFile,
      '--tls-cert',
      tlsCert,
      '--tls-key',
      tlsKey,
      '--destination',
      backup,
      '--application-ref',
      'synthetic-test-ref',
      '--confirm-stopped',
    ]),
    /Backup recovery set created/u,
  );

  const restoreDatabase = join(restored, 'data', 'monitor.sqlite3');
  const restoreKey = join(restored, 'data', 'secrets', 'master.key');
  const restoreEnv = join(restored, 'etc', 'voip-monitor.env');
  const restoreCert = join(restored, 'etc', 'tls', 'server.crt');
  const restoreTlsKey = join(restored, 'etc', 'tls', 'server.key');

  assert.match(
    run(restoreScript, [
      '--backup-dir',
      backup,
      '--database',
      restoreDatabase,
      '--master-key',
      restoreKey,
      '--env-file',
      restoreEnv,
      '--tls-cert',
      restoreCert,
      '--tls-key',
      restoreTlsKey,
      '--confirm-stopped',
    ]),
    /Restore completed/u,
  );

  const restoredSqlite = new DatabaseSync(restoreDatabase);
  try {
    assert.equal(
      restoredSqlite.prepare('SELECT value FROM recovery_probe').get().value,
      'synthetic-recovery-ok',
    );
  } finally {
    restoredSqlite.close();
  }
  assert.equal(await readFile(restoreKey, 'utf8'), await readFile(masterKey, 'utf8'));
  assert.equal(await readFile(restoreEnv, 'utf8'), await readFile(envFile, 'utf8'));
  assert.equal(await readFile(restoreCert, 'utf8'), await readFile(tlsCert, 'utf8'));
  assert.equal(await readFile(restoreTlsKey, 'utf8'), await readFile(tlsKey, 'utf8'));

  assert.throws(
    () =>
      run(restoreScript, [
        '--backup-dir',
        backup,
        '--database',
        restoreDatabase,
        '--master-key',
        restoreKey,
        '--env-file',
        restoreEnv,
        '--tls-cert',
        restoreCert,
        '--tls-key',
        restoreTlsKey,
        '--confirm-stopped',
      ]),
    /Restore destination already exists/u,
  );

  await writeFile(join(backup, 'monitor.sqlite3'), 'tampered\n');
  assert.throws(
    () =>
      run(restoreScript, [
        '--backup-dir',
        backup,
        '--database',
        join(restored, 'tampered', 'monitor.sqlite3'),
        '--master-key',
        join(restored, 'tampered', 'master.key'),
        '--env-file',
        join(restored, 'tampered', 'voip-monitor.env'),
        '--tls-cert',
        join(restored, 'tampered', 'server.crt'),
        '--tls-key',
        join(restored, 'tampered', 'server.key'),
        '--confirm-stopped',
      ]),
    /checksum|FAILED|did NOT match|WARNING/iu,
  );
});
