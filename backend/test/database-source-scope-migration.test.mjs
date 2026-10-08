import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { migrations } from '../dist/storage/migrations.js';
import { SqliteStorage } from '../dist/storage/index.js';

const PBX_ID = 'abababab-abab-4bab-8bab-abababababab';

test('migration 19 preserves a legacy database source and seeds a compatible scope', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-db-scope-migration-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  const db = new DatabaseSync(config.databasePath);
  try {
    db.exec(`CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`);
    for (const migration of migrations.filter((entry) => entry.version < 19)) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?, ?)').run(
          migration.version,
          migration.name,
          createHash('sha256').update(migration.sql).digest('hex'),
          '2026-10-08T00:00:00.000Z',
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    db.prepare(
      `INSERT INTO pbx_instance
       (id, provider_type, display_name, enabled, created_at, updated_at)
       VALUES (?, 'ASTERISK', 'Synthetic PBX', 1, ?, ?)`,
    ).run(PBX_ID, '2026-10-08T00:00:00.000Z', '2026-10-08T00:00:00.000Z');
    db.prepare(
      `INSERT INTO database_source_config
       (pbx_instance_id, dialect, db_host, db_port, database_name, db_username,
        access_mode, tls_mode, created_at, updated_at)
       VALUES (?, 'MYSQL_MARIADB', 'db.example.test', 3306, 'pbx_reporting',
               'readonly_monitor', 'READ_ONLY', 'REQUIRED', ?, ?)`,
    ).run(PBX_ID, '2026-10-08T00:00:00.000Z', '2026-10-08T00:00:00.000Z');
  } finally {
    db.close();
  }

  let storage;
  try {
    storage = await SqliteStorage.open(config);
    const source = storage.databaseSourceConfigs.get(PBX_ID);
    assert.ok(source);
    assert.equal(source.databaseName, 'pbx_reporting');
    assert.deepEqual(source.databaseScopes, ['pbx_reporting']);
    assert.equal(source.username, 'readonly_monitor');
    assert.equal(storage.migrationHistory().at(-1)?.version, 19);
  } finally {
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
