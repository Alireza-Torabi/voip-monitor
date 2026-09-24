import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import { mkdir, lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../config.js';
import type { AppStorage, EncryptedSecretRecord, SecretMetadata } from '../storage/index.js';

const KEY_FILE = 'master.key';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE_VERSION = 1;
const KEY_VERSION = 1;
const SECRET_NAME = /^[a-z][a-z0-9._-]{0,63}$/;
const INSTANCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class SecretStorageError extends Error {
  constructor(
    readonly code: 'UNAVAILABLE' | 'INVALID_IDENTIFIER' | 'INVALID_INPUT' | 'AUTHENTICATION_FAILED',
  ) {
    super(`Secret storage ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SecretStorageError';
  }
}

function validateIdentity(pbxInstanceId: string, secretName: string): void {
  if (!INSTANCE_ID.test(pbxInstanceId) || !SECRET_NAME.test(secretName)) {
    throw new SecretStorageError('INVALID_IDENTIFIER');
  }
}

function aad(
  pbxInstanceId: string,
  secretName: string,
  envelopeVersion: number,
  keyVersion: number,
): Buffer {
  return Buffer.from(JSON.stringify([pbxInstanceId, secretName, envelopeVersion, keyVersion]));
}

function protectedMode(mode: number): boolean {
  return (mode & 0o077) === 0;
}

function ownedByProcess(uid: number): boolean {
  return process.getuid === undefined || uid === process.getuid();
}

interface KeyIdentity {
  dev: number;
  ino: number;
}

async function loadOrCreateKey(
  directory: string,
  hasEncryptedSecrets: boolean,
): Promise<{ key: Buffer; identity: KeyIdentity }> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const dir = await lstat(directory);
  if (
    !dir.isDirectory() ||
    !protectedMode(dir.mode) ||
    !ownedByProcess(dir.uid) ||
    (dir.mode & 0o700) !== 0o700
  ) {
    throw new SecretStorageError('UNAVAILABLE');
  }
  const path = join(directory, KEY_FILE);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new SecretStorageError('UNAVAILABLE');
    if (hasEncryptedSecrets) throw new SecretStorageError('UNAVAILABLE');
    const key = randomBytes(KEY_BYTES);
    try {
      try {
        handle = await open(
          path,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        try {
          await handle.writeFile(key);
          await handle.sync();
        } finally {
          await handle.close();
        }
      } catch (createError) {
        if ((createError as NodeJS.ErrnoException).code !== 'EEXIST')
          throw new SecretStorageError('UNAVAILABLE');
      }
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } finally {
      key.fill(0);
    }
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      !protectedMode(info.mode) ||
      !ownedByProcess(info.uid) ||
      info.size !== KEY_BYTES ||
      (info.mode & 0o400) === 0
    ) {
      throw new SecretStorageError('UNAVAILABLE');
    }
    const key = await handle.readFile();
    if (key.length !== KEY_BYTES) throw new SecretStorageError('UNAVAILABLE');
    return { key, identity: { dev: info.dev, ino: info.ino } };
  } finally {
    await handle.close();
  }
}

/** Internal service only. Decrypted bytes are returned solely to trusted backend callers. */
export class SecretStore {
  private closed = false;

  private constructor(
    private readonly storage: AppStorage,
    private readonly key: Buffer,
    private readonly keyPath: string,
    private readonly keyIdentity: KeyIdentity,
  ) {}

  static async open(config: AppConfig, storage: AppStorage): Promise<SecretStore> {
    let loadedKey: Buffer | undefined;
    try {
      const { key, identity } = await loadOrCreateKey(
        config.secretDirectory,
        storage.hasEncryptedSecrets(),
      );
      loadedKey = key;
      const service = new SecretStore(
        storage,
        key,
        join(config.secretDirectory, KEY_FILE),
        identity,
      );
      const first = storage.secretRecords.firstIdentity();
      if (first) {
        const check = service.getSecret(first.pbxInstanceId, first.secretName);
        if (!check) throw new SecretStorageError('UNAVAILABLE');
        check.fill(0);
      }
      return service;
    } catch {
      loadedKey?.fill(0);
      throw new SecretStorageError('UNAVAILABLE');
    }
  }

  healthCheck(): boolean {
    if (this.closed || !this.storage.healthCheck()) return false;
    let fd: number | undefined;
    try {
      fd = openSync(this.keyPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = fstatSync(fd);
      if (
        !info.isFile() ||
        !protectedMode(info.mode) ||
        !ownedByProcess(info.uid) ||
        info.size !== KEY_BYTES ||
        info.dev !== this.keyIdentity.dev ||
        info.ino !== this.keyIdentity.ino
      ) {
        return false;
      }
      const onDisk = readFileSync(fd);
      const matches = onDisk.length === KEY_BYTES && timingSafeEqual(onDisk, this.key);
      onDisk.fill(0);
      return matches;
    } catch {
      return false;
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }

  putSecret(pbxInstanceId: string, secretName: string, plaintext: Uint8Array): void {
    validateIdentity(pbxInstanceId, secretName);
    if (!this.healthCheck()) throw new SecretStorageError('UNAVAILABLE');
    if (plaintext.length === 0 || plaintext.length > 65536)
      throw new SecretStorageError('INVALID_INPUT');
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad(pbxInstanceId, secretName, ENVELOPE_VERSION, KEY_VERSION));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const now = new Date().toISOString();
    const record: EncryptedSecretRecord = {
      pbxInstanceId,
      secretName,
      envelopeVersion: ENVELOPE_VERSION,
      keyVersion: KEY_VERSION,
      nonce,
      authTag: cipher.getAuthTag(),
      ciphertext,
      createdAt: now,
      updatedAt: now,
    };
    try {
      this.storage.secretRecords.put(record);
    } catch {
      throw new SecretStorageError('UNAVAILABLE');
    }
  }

  getSecret(pbxInstanceId: string, secretName: string): Buffer | undefined {
    validateIdentity(pbxInstanceId, secretName);
    if (!this.healthCheck()) throw new SecretStorageError('UNAVAILABLE');
    let record;
    try {
      record = this.storage.secretRecords.get(pbxInstanceId, secretName);
    } catch {
      throw new SecretStorageError('UNAVAILABLE');
    }
    if (!record) return undefined;
    if (
      record.envelopeVersion !== ENVELOPE_VERSION ||
      record.keyVersion !== KEY_VERSION ||
      record.nonce.length !== NONCE_BYTES ||
      record.authTag.length !== TAG_BYTES
    ) {
      throw new SecretStorageError('AUTHENTICATION_FAILED');
    }
    let candidate: Buffer | undefined;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, record.nonce, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(aad(pbxInstanceId, secretName, record.envelopeVersion, record.keyVersion));
      decipher.setAuthTag(record.authTag);
      candidate = decipher.update(record.ciphertext);
      const tail = decipher.final();
      const plaintext = Buffer.concat([candidate, tail]);
      candidate.fill(0);
      tail.fill(0);
      return plaintext;
    } catch {
      candidate?.fill(0);
      throw new SecretStorageError('AUTHENTICATION_FAILED');
    }
  }

  hasSecret(pbxInstanceId: string, secretName: string): boolean {
    validateIdentity(pbxInstanceId, secretName);
    if (!this.healthCheck()) throw new SecretStorageError('UNAVAILABLE');
    try {
      return this.storage.secretRecords.has(pbxInstanceId, secretName);
    } catch {
      throw new SecretStorageError('UNAVAILABLE');
    }
  }

  deleteSecret(pbxInstanceId: string, secretName: string): boolean {
    validateIdentity(pbxInstanceId, secretName);
    if (!this.healthCheck()) throw new SecretStorageError('UNAVAILABLE');
    try {
      return this.storage.secretRecords.delete(pbxInstanceId, secretName);
    } catch {
      throw new SecretStorageError('UNAVAILABLE');
    }
  }

  listSecretMetadata(pbxInstanceId: string): SecretMetadata[] {
    validateIdentity(pbxInstanceId, 'x');
    if (!this.healthCheck()) throw new SecretStorageError('UNAVAILABLE');
    try {
      return this.storage.secretRecords.listMetadata(pbxInstanceId);
    } catch {
      throw new SecretStorageError('UNAVAILABLE');
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.key.fill(0);
  }
}
