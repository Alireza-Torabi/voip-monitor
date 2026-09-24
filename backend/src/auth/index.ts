import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, lstat, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../config.js';
import { log } from '../logger.js';
import type { AppStorage } from '../storage/index.js';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_BYTES, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
const TOKEN_FILE = 'bootstrap-admin.token';
const N = 32768;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
export const SESSION_SECONDS = 12 * 60 * 60;

const usernamePattern = /^[a-z][a-z0-9._-]{2,63}$/;

export function normalizeUsername(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC').toLowerCase();
  return usernamePattern.test(normalized) ? normalized : undefined;
}
export function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Buffer.from(value, 'utf8').toString('utf8') === value &&
    [...value].length >= 12 &&
    [...value].length <= 256 &&
    !value.includes('\0') &&
    Buffer.byteLength(value, 'utf8') <= 1024
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$v1$${N}$${R}$${P}$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (
    parts.length !== 7 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== 'v1' ||
    parts[2] !== String(N) ||
    parts[3] !== String(R) ||
    parts[4] !== String(P) ||
    !/^[0-9a-f]{32}$/.test(parts[5] ?? '') ||
    !/^[0-9a-f]{64}$/.test(parts[6] ?? '')
  )
    return false;
  const expected = Buffer.from(parts[6]!, 'hex');
  const actual = await derive(password, Buffer.from(parts[5]!, 'hex'));
  return timingSafeEqual(expected, actual);
}
const DUMMY_HASH =
  'scrypt$v1$32768$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class AuthService {
  private readonly tokenPath: string;
  private constructor(
    private readonly storage: AppStorage,
    private readonly secureCookie: boolean,
    directory: string,
  ) {
    this.tokenPath = join(directory, TOKEN_FILE);
  }
  static async open(config: AppConfig, storage: AppStorage): Promise<AuthService> {
    const service = new AuthService(
      storage,
      config.environment === 'production',
      config.secretDirectory,
    );
    if (!storage.auth.hasAdministrator()) {
      await mkdir(config.secretDirectory, { recursive: true, mode: 0o700 });
      const dir = await lstat(config.secretDirectory);
      if (
        !dir.isDirectory() ||
        (dir.mode & 0o777) !== 0o700 ||
        (process.getuid && dir.uid !== process.getuid())
      )
        throw new Error('auth_storage_unavailable');
      let handle;
      try {
        handle = await open(service.tokenPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw new Error('auth_storage_unavailable', { cause: error });
        const token = randomBytes(32).toString('hex');
        try {
          const created = await open(
            service.tokenPath,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          try {
            await created.writeFile(token + '\n');
            await created.sync();
          } finally {
            await created.close();
          }
        } catch (createError) {
          if ((createError as NodeJS.ErrnoException).code !== 'EEXIST')
            throw new Error('auth_storage_unavailable', { cause: createError });
        }
        handle = await open(service.tokenPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      }
      try {
        const stat = await handle.stat();
        if (
          !stat.isFile() ||
          (stat.mode & 0o777) !== 0o600 ||
          (process.getuid && stat.uid !== process.getuid()) ||
          stat.size !== 65
        )
          throw new Error('auth_storage_unavailable');
        const contents = await handle.readFile({ encoding: 'utf8' });
        if (!/^[0-9a-f]{64}\n$/.test(contents)) throw new Error('auth_storage_unavailable');
      } finally {
        await handle.close();
      }
    } else {
      try {
        await unlink(service.tokenPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          log('warn', 'bootstrap_token_removal_failed');
      }
    }
    return service;
  }
  get requiresSecureOrigin(): boolean {
    return this.secureCookie;
  }
  setupRequired(): boolean {
    return !this.storage.auth.hasAdministrator();
  }
  private async readToken(): Promise<string | undefined> {
    try {
      const handle = await open(this.tokenPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (
          !stat.isFile() ||
          (stat.mode & 0o777) !== 0o600 ||
          (process.getuid && stat.uid !== process.getuid()) ||
          stat.size !== 65
        )
          return undefined;
        const token = await handle.readFile({ encoding: 'utf8' });
        return /^[0-9a-f]{64}\n$/.test(token) ? token.trimEnd() : undefined;
      } finally {
        await handle.close();
      }
    } catch {
      return undefined;
    }
  }
  async createFirst(
    username: unknown,
    passphrase: unknown,
    bootstrapToken: unknown,
  ): Promise<{ id: string; username: string } | undefined> {
    if (this.storage.auth.hasAdministrator()) return undefined;
    const expected = await this.readToken();
    if (typeof bootstrapToken !== 'string' || !expected || !safeEqual(bootstrapToken, expected))
      return undefined;
    const normalized = normalizeUsername(username);
    if (!normalized || !validPassword(passphrase)) return undefined;
    const passwordHash = await hashPassword(passphrase);
    const created = this.storage.auth.createFirst(normalized, passwordHash);
    if (!created) return undefined;
    try {
      await unlink(this.tokenPath);
    } catch {
      log('warn', 'bootstrap_token_removal_failed');
    }
    return { id: created.id, username: created.username };
  }
  async login(
    username: unknown,
    passphrase: unknown,
  ): Promise<{ principal: { id: string; username: string }; token: string } | undefined> {
    const normalized = normalizeUsername(username);
    const record = normalized ? this.storage.auth.findAdministrator(normalized) : undefined;
    if (typeof passphrase !== 'string' || Buffer.byteLength(passphrase, 'utf8') > 1024)
      return undefined;
    const valid = await verifyPassword(passphrase, record?.passwordHash ?? DUMMY_HASH);
    if (!valid || !record?.enabled) return undefined;
    const token = randomBytes(32).toString('hex');
    this.storage.auth.createSession(
      record.id,
      digest(token),
      new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
    );
    this.storage.auth.markLogin(record.id);
    return { principal: { id: record.id, username: record.username }, token };
  }
  principal(token: string | undefined): { id: string; username: string } | undefined {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return undefined;
    return this.storage.auth.sessionPrincipal(digest(token), new Date().toISOString());
  }
  logout(token: string | undefined): void {
    if (token && /^[0-9a-f]{64}$/.test(token)) this.storage.auth.revokeSession(digest(token));
  }
  cookie(token: string): string {
    return `vm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${this.secureCookie ? '; Secure' : ''}`;
  }
  clearCookie(): string {
    return `vm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${this.secureCookie ? '; Secure' : ''}`;
  }
}
