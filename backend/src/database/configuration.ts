import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { validHostSyntax } from '../network/policy.js';
import type { SecretStore } from '../security/secret-store.js';
import type {
  AppStorage,
  DatabaseAccessMode,
  DatabaseSourceConfigRecord,
  DatabaseTlsMode,
} from '../storage/index.js';

const DATABASE_PASSWORD_SECRET = 'database-password';
const ACCESS_MODE: DatabaseAccessMode = 'READ_ONLY';
const DEFAULT_TLS_MODE: DatabaseTlsMode = 'REQUIRED';

function boundedText(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) =>
      [...value].every((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      }),
    );
}

export const configurationSchema = z.strictObject({
  dialect: z.enum(['MYSQL_MARIADB', 'POSTGRESQL']),
  host: z.string().refine(validHostSyntax),
  port: z.number().int().min(1).max(65535),
  databaseName: boundedText(128),
  username: boundedText(128),
  credential: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 4096),
  accessMode: z.literal(ACCESS_MODE),
  tlsMode: z.enum(['REQUIRED', 'DISABLED']).default(DEFAULT_TLS_MODE),
});

export type SafeDatabaseSourceConfiguration = DatabaseSourceConfigRecord & {
  hasCredential: boolean;
};

export type DatabaseSourceConfigurationInput = z.infer<typeof configurationSchema>;

export function parseDatabaseSourceConfigurationInput(
  input: unknown,
): DatabaseSourceConfigurationInput {
  const parsed = configurationSchema.safeParse(input);
  if (!parsed.success) throw new DatabaseSourceConfigurationError('INVALID_INPUT');
  return parsed.data;
}

export class DatabaseSourceConfigurationError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'PBX_NOT_FOUND') {
    super(`Database source configuration ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'DatabaseSourceConfigurationError';
  }
}

export class DatabaseSourceConfigurationService {
  constructor(
    private readonly storage: AppStorage,
    private readonly secrets: SecretStore,
  ) {}

  get(pbxInstanceId: string): SafeDatabaseSourceConfiguration | undefined {
    const record = this.storage.databaseSourceConfigs.get(pbxInstanceId);
    return record ? this.safe(record) : undefined;
  }

  list(): SafeDatabaseSourceConfiguration[] {
    return this.storage.databaseSourceConfigs.list().map((record) => this.safe(record));
  }

  configure(pbxInstanceId: string, input: unknown): SafeDatabaseSourceConfiguration {
    if (!this.storage.pbxProfiles.get(pbxInstanceId)) {
      throw new DatabaseSourceConfigurationError('PBX_NOT_FOUND');
    }

    const parsed = parseDatabaseSourceConfigurationInput(input);

    const previous = this.storage.databaseSourceConfigs.get(pbxInstanceId);
    const now = new Date().toISOString();
    const record: DatabaseSourceConfigRecord = {
      pbxInstanceId,
      dialect: parsed.dialect,
      host: parsed.host,
      port: parsed.port,
      databaseName: parsed.databaseName,
      username: parsed.username,
      accessMode: ACCESS_MODE,
      tlsMode: parsed.tlsMode,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    return this.storage.transaction(() => {
      this.storage.databaseSourceConfigs.put(record);
      const plaintext = Buffer.from(parsed.credential, 'utf8');
      try {
        this.secrets.putSecret(pbxInstanceId, DATABASE_PASSWORD_SECRET, plaintext);
      } finally {
        plaintext.fill(0);
      }
      return this.safe(record);
    });
  }

  delete(pbxInstanceId: string): boolean {
    return this.storage.transaction(() => {
      const deleted = this.storage.databaseSourceConfigs.delete(pbxInstanceId);
      if (!deleted) return false;
      this.secrets.deleteSecret(pbxInstanceId, DATABASE_PASSWORD_SECRET);
      return true;
    });
  }

  private safe(record: DatabaseSourceConfigRecord): SafeDatabaseSourceConfiguration {
    return {
      ...record,
      hasCredential: this.secrets.hasSecret(record.pbxInstanceId, DATABASE_PASSWORD_SECRET),
    };
  }
}

export const DATABASE_SOURCE_SECRET_NAMES = Object.freeze({
  passwordCredential: DATABASE_PASSWORD_SECRET,
});
