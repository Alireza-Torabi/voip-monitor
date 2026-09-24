import { createHash } from 'node:crypto';
import { mkdir, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { PbxInstanceMetadata } from '@voip-monitor/shared';
import type { AppConfig } from '../config.js';
import { migrations } from './migrations.js';

export type SetupState = 'SETUP_REQUIRED' | 'SETUP_IN_PROGRESS' | 'COMPLETE';
export interface SetupSnapshot {
  state: SetupState;
  updatedAt: string;
}
export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
  checksum: string;
}

export interface AppStorage {
  readonly setup: SetupRepository;
  readonly pbxInstances: PbxInstanceRepository;
  readonly secretRecords: EncryptedSecretRepository;
  hasEncryptedSecrets(): boolean;
  migrationHistory(): MigrationRecord[];
  healthCheck(): boolean;
  close(): void;
}
export interface SetupRepository {
  get(): SetupSnapshot;
  set(state: SetupState): SetupSnapshot;
}
export interface PbxInstanceRepository {
  save(metadata: PbxInstanceMetadata): void;
  get(id: string): PbxInstanceMetadata | undefined;
  list(): PbxInstanceMetadata[];
}

export interface EncryptedSecretRecord {
  pbxInstanceId: string;
  secretName: string;
  envelopeVersion: number;
  keyVersion: number;
  nonce: Uint8Array;
  authTag: Uint8Array;
  ciphertext: Uint8Array;
  createdAt: string;
  updatedAt: string;
}
export interface SecretMetadata {
  pbxInstanceId: string;
  secretName: string;
  envelopeVersion: number;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface EncryptedSecretRepository {
  firstIdentity(): { pbxInstanceId: string; secretName: string } | undefined;
  put(record: EncryptedSecretRecord): void;
  get(pbxInstanceId: string, secretName: string): EncryptedSecretRecord | undefined;
  has(pbxInstanceId: string, secretName: string): boolean;
  delete(pbxInstanceId: string, secretName: string): boolean;
  listMetadata(pbxInstanceId: string): SecretMetadata[];
}

export class StorageError extends Error {
  constructor() {
    super('Application storage is unavailable');
    this.name = 'StorageError';
  }
}

function inTransaction(db: DatabaseSync, action: () => void): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    action();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrate(db: DatabaseSync): void {
  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index]!.version <= migrations[index - 1]!.version) throw new StorageError();
  }
  inTransaction(db, () => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`);
  });
  const applied = db
    .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
    .all() as {
    version: number;
    checksum: string;
  }[];
  const known = new Map<number, (typeof migrations)[number]>(
    migrations.map((migration) => [migration.version, migration]),
  );
  for (const row of applied) {
    const migration = known.get(row.version);
    if (!migration || createHash('sha256').update(migration.sql).digest('hex') !== row.checksum) {
      throw new StorageError();
    }
  }
  for (const migration of migrations) {
    if (applied.some((row) => row.version === migration.version)) continue;
    inTransaction(db, () => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?, ?)').run(
        migration.version,
        migration.name,
        createHash('sha256').update(migration.sql).digest('hex'),
        new Date().toISOString(),
      );
    });
  }
}

export class SqliteStorage implements AppStorage {
  readonly setup: SetupRepository;
  readonly pbxInstances: PbxInstanceRepository;
  readonly secretRecords: EncryptedSecretRepository;
  private closed = false;

  private constructor(private readonly db: DatabaseSync) {
    this.setup = {
      get: () => {
        const row = this.db
          .prepare('SELECT setup_state, updated_at FROM application_state WHERE id = 1')
          .get() as {
          setup_state: SetupState;
          updated_at: string;
        };
        return { state: row.setup_state, updatedAt: row.updated_at };
      },
      set: (state) => {
        this.db
          .prepare('UPDATE application_state SET setup_state = ?, updated_at = ? WHERE id = 1')
          .run(state, new Date().toISOString());
        return this.setup.get();
      },
    };
    this.pbxInstances = {
      save: (metadata) => {
        const now = new Date().toISOString();
        this.db
          .prepare(
            `INSERT INTO pbx_instance
          (id, provider_type, display_name, product, version, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET provider_type=excluded.provider_type,
          display_name=excluded.display_name, product=excluded.product,
          version=excluded.version, timezone=excluded.timezone, updated_at=excluded.updated_at`,
          )
          .run(
            metadata.id,
            metadata.providerType,
            metadata.displayName,
            metadata.product ?? null,
            metadata.version ?? null,
            metadata.timezone ?? null,
            now,
            now,
          );
      },
      get: (id) => {
        const row = this.db.prepare('SELECT * FROM pbx_instance WHERE id = ?').get(id);
        return row ? mapPbx(row) : undefined;
      },
      list: () => this.db.prepare('SELECT * FROM pbx_instance ORDER BY id').all().map(mapPbx),
    };
    this.secretRecords = {
      firstIdentity: () => {
        const row = this.db
          .prepare('SELECT pbx_instance_id, secret_name FROM pbx_secret LIMIT 1')
          .get();
        return row
          ? { pbxInstanceId: row.pbx_instance_id as string, secretName: row.secret_name as string }
          : undefined;
      },
      put: (record) => {
        this.db
          .prepare(
            `INSERT INTO pbx_secret
          (pbx_instance_id, secret_name, envelope_version, key_version, nonce, auth_tag, ciphertext, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(pbx_instance_id, secret_name) DO UPDATE SET
          envelope_version=excluded.envelope_version, key_version=excluded.key_version,
          nonce=excluded.nonce, auth_tag=excluded.auth_tag, ciphertext=excluded.ciphertext,
          updated_at=excluded.updated_at`,
          )
          .run(
            record.pbxInstanceId,
            record.secretName,
            record.envelopeVersion,
            record.keyVersion,
            record.nonce,
            record.authTag,
            record.ciphertext,
            record.createdAt,
            record.updatedAt,
          );
      },
      get: (pbxInstanceId, secretName) => {
        const row = this.db
          .prepare('SELECT * FROM pbx_secret WHERE pbx_instance_id = ? AND secret_name = ?')
          .get(pbxInstanceId, secretName);
        return row ? mapSecret(row) : undefined;
      },
      has: (pbxInstanceId, secretName) =>
        this.db
          .prepare(
            'SELECT 1 AS present FROM pbx_secret WHERE pbx_instance_id = ? AND secret_name = ?',
          )
          .get(pbxInstanceId, secretName) !== undefined,
      delete: (pbxInstanceId, secretName) =>
        this.db
          .prepare('DELETE FROM pbx_secret WHERE pbx_instance_id = ? AND secret_name = ?')
          .run(pbxInstanceId, secretName).changes > 0,
      listMetadata: (pbxInstanceId) =>
        this.db
          .prepare(
            `SELECT pbx_instance_id, secret_name,
        envelope_version, key_version, created_at, updated_at FROM pbx_secret
        WHERE pbx_instance_id = ? ORDER BY secret_name`,
          )
          .all(pbxInstanceId)
          .map(mapSecretMetadata),
    };
  }

  static async open(config: AppConfig): Promise<SqliteStorage> {
    let db: DatabaseSync | undefined;
    try {
      await mkdir(dirname(config.databasePath), { recursive: true, mode: 0o700 });
      const previousUmask = process.umask(0o077);
      try {
        db = new DatabaseSync(config.databasePath, { timeout: 5000, allowExtension: false });
      } finally {
        process.umask(previousUmask);
      }
      await chmod(config.databasePath, 0o600);
      db.exec('PRAGMA foreign_keys = ON');
      db.exec('PRAGMA busy_timeout = 5000');
      migrate(db);
      return new SqliteStorage(db);
    } catch {
      db?.close();
      throw new StorageError();
    }
  }

  hasEncryptedSecrets(): boolean {
    return this.db.prepare('SELECT 1 FROM pbx_secret LIMIT 1').get() !== undefined;
  }

  migrationHistory(): MigrationRecord[] {
    return (
      this.db
        .prepare(
          'SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version',
        )
        .all() as {
        version: number;
        name: string;
        applied_at: string;
        checksum: string;
      }[]
    ).map((row) => ({
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at,
      checksum: row.checksum,
    }));
  }

  healthCheck(): boolean {
    if (this.closed) return false;
    try {
      return (
        this.db.prepare('SELECT setup_state FROM application_state WHERE id = 1').get() !==
        undefined
      );
    } catch {
      return false;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

function mapPbx(row: Record<string, unknown>): PbxInstanceMetadata {
  return {
    id: row.id as string,
    providerType: row.provider_type as 'ASTERISK',
    displayName: row.display_name as string,
    ...(row.product === null ? {} : { product: row.product as string }),
    ...(row.version === null ? {} : { version: row.version as string }),
    ...(row.timezone === null ? {} : { timezone: row.timezone as string }),
  };
}

function mapSecretMetadata(row: Record<string, unknown>): SecretMetadata {
  return {
    pbxInstanceId: row.pbx_instance_id as string,
    secretName: row.secret_name as string,
    envelopeVersion: row.envelope_version as number,
    keyVersion: row.key_version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSecret(row: Record<string, unknown>): EncryptedSecretRecord {
  return {
    ...mapSecretMetadata(row),
    nonce: row.nonce as Uint8Array,
    authTag: row.auth_tag as Uint8Array,
    ciphertext: row.ciphertext as Uint8Array,
  };
}
