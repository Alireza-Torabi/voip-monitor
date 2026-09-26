import { createHash, randomUUID } from 'node:crypto';
import { mkdir, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { PbxInstanceMetadata, SecurityEvent, SystemMetricsSample } from '@voip-monitor/shared';
import type { AppConfig } from '../config.js';
import { migrations } from './migrations.js';

export type SetupState =
  'SETUP_REQUIRED' | 'SETUP_IN_PROGRESS' | 'PBX_CONFIGURED_UNVERIFIED' | 'COMPLETE';
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

export interface AdministratorRecord {
  id: string;
  username: string;
  passwordHash: string;
  enabled: boolean;
}
export interface AuthRepository {
  hasAdministrator(): boolean;
  createFirst(username: string, passwordHash: string): AdministratorRecord | undefined;
  findAdministrator(username: string): AdministratorRecord | undefined;
  createSession(administratorId: string, tokenDigest: string, expiresAt: string): void;
  sessionPrincipal(tokenDigest: string, now: string): { id: string; username: string } | undefined;
  revokeSession(tokenDigest: string): void;
  markLogin(id: string): void;
}

export interface PbxProfileRecord {
  id: string;
  displayName: string;
  providerType: 'ASTERISK';
  enabled: boolean;
  amiHost: string;
  amiPort: number;
  amiUsername: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface PbxProfileRepository {
  create(profile: PbxProfileRecord): void;
  update(profile: PbxProfileRecord): void;
  get(id: string): PbxProfileRecord | undefined;
  list(): PbxProfileRecord[];
  delete(id: string): boolean;
  count(): number;
  markVerified(id: string, verifiedAt: string): void;
  clearVerification(id: string): void;
  verifiedCount(): number;
}

export type SshAuthMethod = 'PASSWORD' | 'PRIVATE_KEY';
export type SshHostKeyPolicy = 'PINNED_SHA256';
export interface SshConfigRecord {
  pbxInstanceId: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  hostKeyPolicy: SshHostKeyPolicy;
  hostKeyFingerprint: string;
  createdAt: string;
  updatedAt: string;
}
export interface SshConfigRepository {
  put(config: SshConfigRecord): void;
  get(pbxInstanceId: string): SshConfigRecord | undefined;
  delete(pbxInstanceId: string): boolean;
  list(): SshConfigRecord[];
}

export interface SystemMetricsRepository {
  save(sample: SystemMetricsSample, retentionCutoff: string): void;
  getCurrent(instanceId: string): SystemMetricsSample | undefined;
  listHistory(instanceId: string, from: string, to: string, limit: number): SystemMetricsSample[];
  pruneBefore(cutoff: string): number;
}

export interface SecurityEventRepository {
  save(event: SecurityEvent, retentionCutoff: string): void;
  getCurrent(instanceId: string): SecurityEvent | undefined;
  listHistory(instanceId: string, from: string, to: string, limit: number): SecurityEvent[];
  pruneBefore(cutoff: string): number;
}

export interface AppStorage {
  transaction<T>(action: () => T): T;
  readonly setup: SetupRepository;
  readonly auth: AuthRepository;
  readonly pbxInstances: PbxInstanceRepository;
  readonly pbxProfiles: PbxProfileRepository;
  readonly sshConfigs: SshConfigRepository;
  readonly systemMetrics: SystemMetricsRepository;
  readonly securityEvents: SecurityEventRepository;
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
  clearDiscovery(id: string): void;
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
  readonly auth: AuthRepository;
  readonly pbxInstances: PbxInstanceRepository;
  readonly pbxProfiles: PbxProfileRepository;
  readonly sshConfigs: SshConfigRepository;
  readonly systemMetrics: SystemMetricsRepository;
  readonly securityEvents: SecurityEventRepository;
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
    this.auth = {
      hasAdministrator: () =>
        this.db.prepare('SELECT 1 FROM administrator LIMIT 1').get() !== undefined,
      createFirst: (username, passwordHash) => {
        let created: AdministratorRecord | undefined;
        inTransaction(this.db, () => {
          if (this.auth.hasAdministrator()) return;
          const id = randomUUID();
          const now = new Date().toISOString();
          this.db
            .prepare(
              `INSERT INTO administrator
            (id, username, password_hash, enabled, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)`,
            )
            .run(id, username, passwordHash, now, now);
          this.db
            .prepare(
              `UPDATE application_state SET setup_state = 'SETUP_IN_PROGRESS', updated_at = ? WHERE id = 1`,
            )
            .run(now);
          created = { id, username, passwordHash, enabled: true };
        });
        return created;
      },
      findAdministrator: (username) => {
        const row = this.db
          .prepare(
            'SELECT id, username, password_hash, enabled FROM administrator WHERE username = ?',
          )
          .get(username);
        return row ? mapAdministrator(row) : undefined;
      },
      createSession: (administratorId, tokenDigest, expiresAt) => {
        this.db
          .prepare('INSERT INTO auth_session VALUES (?, ?, ?, ?)')
          .run(tokenDigest, administratorId, expiresAt, new Date().toISOString());
      },
      sessionPrincipal: (tokenDigest, now) => {
        const row = this.db
          .prepare(
            `SELECT a.id, a.username FROM auth_session s
          JOIN administrator a ON a.id = s.administrator_id
          WHERE s.token_digest = ? AND s.expires_at > ? AND a.enabled = 1`,
          )
          .get(tokenDigest, now);
        return row ? { id: row.id as string, username: row.username as string } : undefined;
      },
      revokeSession: (tokenDigest) => {
        this.db.prepare('DELETE FROM auth_session WHERE token_digest = ?').run(tokenDigest);
      },
      markLogin: (id) => {
        this.db
          .prepare('UPDATE administrator SET last_login_at = ? WHERE id = ?')
          .run(new Date().toISOString(), id);
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
      clearDiscovery: (id) => {
        this.db
          .prepare(
            'UPDATE pbx_instance SET product = NULL, version = NULL, timezone = NULL, updated_at = ? WHERE id = ?',
          )
          .run(new Date().toISOString(), id);
      },
      get: (id) => {
        const row = this.db.prepare('SELECT * FROM pbx_instance WHERE id = ?').get(id);
        return row ? mapPbx(row) : undefined;
      },
      list: () => this.db.prepare('SELECT * FROM pbx_instance ORDER BY id').all().map(mapPbx),
    };
    this.pbxProfiles = {
      create: (profile) => {
        this.db
          .prepare(
            `INSERT INTO pbx_instance
          (id, provider_type, display_name, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            profile.id,
            profile.providerType,
            profile.displayName,
            Number(profile.enabled),
            profile.createdAt,
            profile.updatedAt,
          );
        this.db
          .prepare(
            `INSERT INTO asterisk_config
          (pbx_instance_id, ami_host, ami_port, ami_username) VALUES (?, ?, ?, ?)`,
          )
          .run(profile.id, profile.amiHost, profile.amiPort, profile.amiUsername);
      },
      update: (profile) => {
        this.db
          .prepare(
            `UPDATE pbx_instance SET display_name = ?, enabled = ?, updated_at = ?
          WHERE id = ?`,
          )
          .run(profile.displayName, Number(profile.enabled), profile.updatedAt, profile.id);
        this.db
          .prepare(
            `UPDATE asterisk_config SET ami_host = ?, ami_port = ?, ami_username = ?
          WHERE pbx_instance_id = ?`,
          )
          .run(profile.amiHost, profile.amiPort, profile.amiUsername, profile.id);
      },
      get: (id) => {
        const row = this.db
          .prepare(
            `SELECT p.id, p.display_name, p.provider_type, p.enabled,
          p.created_at, p.updated_at, a.ami_host, a.ami_port, a.ami_username, a.last_verified_at
          FROM pbx_instance p JOIN asterisk_config a ON a.pbx_instance_id = p.id
          WHERE p.id = ?`,
          )
          .get(id);
        return row ? mapPbxProfile(row) : undefined;
      },
      list: () =>
        this.db
          .prepare(
            `SELECT p.id, p.display_name, p.provider_type, p.enabled,
          p.created_at, p.updated_at, a.ami_host, a.ami_port, a.ami_username, a.last_verified_at
          FROM pbx_instance p JOIN asterisk_config a ON a.pbx_instance_id = p.id
          ORDER BY p.created_at, p.id`,
          )
          .all()
          .map(mapPbxProfile),
      delete: (id) => this.db.prepare('DELETE FROM pbx_instance WHERE id = ?').run(id).changes > 0,
      count: () =>
        this.db.prepare('SELECT COUNT(*) AS total FROM asterisk_config').get()!.total as number,
      markVerified: (id, verifiedAt) => {
        this.db
          .prepare('UPDATE asterisk_config SET last_verified_at = ? WHERE pbx_instance_id = ?')
          .run(verifiedAt, id);
      },
      clearVerification: (id) => {
        this.db
          .prepare('UPDATE asterisk_config SET last_verified_at = NULL WHERE pbx_instance_id = ?')
          .run(id);
      },
      verifiedCount: () =>
        this.db
          .prepare(
            'SELECT COUNT(*) AS total FROM asterisk_config WHERE last_verified_at IS NOT NULL',
          )
          .get()!.total as number,
    };
    this.sshConfigs = {
      put: (config) => {
        this.db
          .prepare(
            `INSERT INTO ssh_config
          (pbx_instance_id, ssh_host, ssh_port, ssh_username, auth_method,
           host_key_policy, host_key_fingerprint, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(pbx_instance_id) DO UPDATE SET
          ssh_host=excluded.ssh_host, ssh_port=excluded.ssh_port,
          ssh_username=excluded.ssh_username, auth_method=excluded.auth_method,
          host_key_policy=excluded.host_key_policy,
          host_key_fingerprint=excluded.host_key_fingerprint,
          updated_at=excluded.updated_at`,
          )
          .run(
            config.pbxInstanceId,
            config.host,
            config.port,
            config.username,
            config.authMethod,
            config.hostKeyPolicy,
            config.hostKeyFingerprint,
            config.createdAt,
            config.updatedAt,
          );
      },
      get: (pbxInstanceId) => {
        const row = this.db
          .prepare('SELECT * FROM ssh_config WHERE pbx_instance_id = ?')
          .get(pbxInstanceId);
        return row ? mapSshConfig(row) : undefined;
      },
      delete: (pbxInstanceId) =>
        this.db.prepare('DELETE FROM ssh_config WHERE pbx_instance_id = ?').run(pbxInstanceId)
          .changes > 0,
      list: () =>
        this.db
          .prepare('SELECT * FROM ssh_config ORDER BY created_at, pbx_instance_id')
          .all()
          .map(mapSshConfig),
    };
    this.systemMetrics = {
      save: (sample, retentionCutoff) => {
        const sampleJson = JSON.stringify(sample);
        const now = new Date().toISOString();
        inTransaction(this.db, () => {
          this.db
            .prepare(
              `INSERT INTO system_metric_history
              (pbx_instance_id, source, observed_at, sample_json)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(pbx_instance_id, source, observed_at) DO NOTHING`,
            )
            .run(sample.instanceId, sample.source, sample.observedAt, sampleJson);
          this.db
            .prepare(
              `INSERT INTO system_metric_current
              (pbx_instance_id, source, observed_at, sample_json, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(pbx_instance_id) DO UPDATE SET
                source=excluded.source,
                observed_at=excluded.observed_at,
                sample_json=excluded.sample_json,
                updated_at=excluded.updated_at
              WHERE excluded.observed_at > system_metric_current.observed_at`,
            )
            .run(sample.instanceId, sample.source, sample.observedAt, sampleJson, now);
          this.db
            .prepare('DELETE FROM system_metric_history WHERE observed_at < ?')
            .run(retentionCutoff);
        });
      },
      getCurrent: (instanceId) => {
        const row = this.db
          .prepare('SELECT sample_json FROM system_metric_current WHERE pbx_instance_id = ?')
          .get(instanceId) as { sample_json: string } | undefined;
        return row ? parseSystemMetricsSample(row.sample_json) : undefined;
      },
      listHistory: (instanceId, from, to, limit) => {
        if (!Number.isSafeInteger(limit) || limit <= 0) throw new StorageError();
        const rows = this.db
          .prepare(
            `SELECT sample_json FROM system_metric_history
             WHERE pbx_instance_id = ? AND observed_at >= ? AND observed_at <= ?
             ORDER BY observed_at DESC LIMIT ?`,
          )
          .all(instanceId, from, to, limit) as { sample_json: string }[];
        return rows.map((row) => parseSystemMetricsSample(row.sample_json));
      },
      pruneBefore: (cutoff) =>
        Number(
          this.db.prepare('DELETE FROM system_metric_history WHERE observed_at < ?').run(cutoff)
            .changes,
        ),
    };
    this.securityEvents = {
      save: (event, retentionCutoff) => {
        const eventJson = JSON.stringify(event);
        const eventKey = securityEventKey(event);
        const now = new Date().toISOString();
        inTransaction(this.db, () => {
          this.db
            .prepare(
              `INSERT INTO security_event_history
              (event_key, pbx_instance_id, source, observed_at, stream_generation, stream_sequence, event_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(event_key) DO NOTHING`,
            )
            .run(
              eventKey,
              event.instanceId,
              event.source,
              event.observedAt,
              event.streamGeneration ?? null,
              event.streamSequence ?? null,
              eventJson,
            );
          const current = this.db
            .prepare(
              `SELECT observed_at, stream_generation, stream_sequence
               FROM security_event_current WHERE pbx_instance_id = ?`,
            )
            .get(event.instanceId) as
            | {
                observed_at: string;
                stream_generation: number | null;
                stream_sequence: number | null;
              }
            | undefined;
          if (!current || isSecurityEventNewer(event, current)) {
            this.db
              .prepare(
                `INSERT INTO security_event_current
                (pbx_instance_id, source, observed_at, stream_generation, stream_sequence, event_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pbx_instance_id) DO UPDATE SET
                  source=excluded.source,
                  observed_at=excluded.observed_at,
                  stream_generation=excluded.stream_generation,
                  stream_sequence=excluded.stream_sequence,
                  event_json=excluded.event_json,
                  updated_at=excluded.updated_at`,
              )
              .run(
                event.instanceId,
                event.source,
                event.observedAt,
                event.streamGeneration ?? null,
                event.streamSequence ?? null,
                eventJson,
                now,
              );
          }
          this.db
            .prepare('DELETE FROM security_event_history WHERE observed_at < ?')
            .run(retentionCutoff);
        });
      },
      getCurrent: (instanceId) => {
        const row = this.db
          .prepare('SELECT event_json FROM security_event_current WHERE pbx_instance_id = ?')
          .get(instanceId) as { event_json: string } | undefined;
        return row ? parseSecurityEvent(row.event_json) : undefined;
      },
      listHistory: (instanceId, from, to, limit) => {
        if (!Number.isSafeInteger(limit) || limit <= 0) throw new StorageError();
        const rows = this.db
          .prepare(
            `SELECT event_json FROM security_event_history
             WHERE pbx_instance_id = ? AND observed_at >= ? AND observed_at <= ?
             ORDER BY observed_at DESC, id DESC LIMIT ?`,
          )
          .all(instanceId, from, to, limit) as { event_json: string }[];
        return rows.map((row) => parseSecurityEvent(row.event_json));
      },
      pruneBefore: (cutoff) =>
        Number(
          this.db.prepare('DELETE FROM security_event_history WHERE observed_at < ?').run(cutoff)
            .changes,
        ),
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

  transaction<T>(action: () => T): T {
    let result!: T;
    inTransaction(this.db, () => {
      result = action();
    });
    return result;
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

function securityEventKey(event: SecurityEvent): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        instanceId: event.instanceId,
        source: event.source,
        observedAt: event.observedAt,
        streamGeneration: event.streamGeneration ?? null,
        streamSequence: event.streamSequence ?? null,
        type: event.type,
        ...(event.type === 'AUTHENTICATION_FAILURE' ? { reason: event.reason } : {}),
      }),
    )
    .digest('hex');
}

function isSecurityEventNewer(
  event: SecurityEvent,
  current: {
    observed_at: string;
    stream_generation: number | null;
    stream_sequence: number | null;
  },
): boolean {
  if (event.streamGeneration !== undefined && current.stream_generation !== null) {
    if (event.streamGeneration !== current.stream_generation) {
      return event.streamGeneration > current.stream_generation;
    }
    if (event.streamSequence !== undefined && current.stream_sequence !== null) {
      if (event.streamSequence !== current.stream_sequence) {
        return event.streamSequence > current.stream_sequence;
      }
    }
  }
  return event.observedAt > current.observed_at;
}

function parseSecurityEvent(value: string): SecurityEvent {
  try {
    const event = JSON.parse(value) as Partial<SecurityEvent>;
    if (
      typeof event.instanceId !== 'string' ||
      event.source !== 'AMI' ||
      typeof event.observedAt !== 'string' ||
      (event.type !== 'AUTHENTICATION_SUCCESS' && event.type !== 'AUTHENTICATION_FAILURE')
    ) {
      throw new Error();
    }
    if (
      event.type === 'AUTHENTICATION_FAILURE' &&
      ![
        'INVALID_ACCOUNT',
        'INVALID_PASSWORD',
        'CHALLENGE_RESPONSE_FAILED',
        'ACL_FAILURE',
        'UNEXPECTED_ADDRESS',
        'UNKNOWN',
      ].includes(event.reason as string)
    ) {
      throw new Error();
    }
    return event as SecurityEvent;
  } catch {
    throw new StorageError();
  }
}

function parseSystemMetricsSample(value: string): SystemMetricsSample {
  try {
    const sample = JSON.parse(value) as Partial<SystemMetricsSample>;
    if (
      typeof sample.instanceId !== 'string' ||
      sample.source !== 'SSH' ||
      typeof sample.observedAt !== 'string' ||
      !sample.capabilities ||
      typeof sample.capabilities !== 'object'
    ) {
      throw new Error();
    }
    return sample as SystemMetricsSample;
  } catch {
    throw new StorageError();
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

function mapSshConfig(row: Record<string, unknown>): SshConfigRecord {
  return {
    pbxInstanceId: row.pbx_instance_id as string,
    host: row.ssh_host as string,
    port: row.ssh_port as number,
    username: row.ssh_username as string,
    authMethod: row.auth_method as SshAuthMethod,
    hostKeyPolicy: row.host_key_policy as SshHostKeyPolicy,
    hostKeyFingerprint: row.host_key_fingerprint as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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

function mapAdministrator(row: Record<string, unknown>): AdministratorRecord {
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    enabled: row.enabled === 1,
  };
}

function mapPbxProfile(row: Record<string, unknown>): PbxProfileRecord {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    providerType: row.provider_type as 'ASTERISK',
    enabled: row.enabled === 1,
    amiHost: row.ami_host as string,
    amiPort: row.ami_port as number,
    amiUsername: row.ami_username as string,
    ...(row.last_verified_at === null || row.last_verified_at === undefined
      ? {}
      : { lastVerifiedAt: row.last_verified_at as string }),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
