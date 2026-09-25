import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { validHostSyntax } from '../network/policy.js';
import type { SecretStore } from '../security/secret-store.js';
import type {
  AppStorage,
  SshAuthMethod,
  SshConfigRecord,
  SshHostKeyPolicy,
} from '../storage/index.js';
import { isValidSha256HostKeyFingerprint } from './trust.js';

const SSH_PASSWORD_SECRET = 'ssh-password';
const SSH_PRIVATE_KEY_SECRET = 'ssh-private-key';
const SSH_PRIVATE_KEY_PASSPHRASE_SECRET = 'ssh-private-key-passphrase';
const HOST_KEY_POLICY: SshHostKeyPolicy = 'PINNED_SHA256';

const sshUsername = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/u);

function boundedSecret(maxBytes: number) {
  return z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= maxBytes);
}

const commonFields = {
  host: z.string().refine(validHostSyntax),
  port: z.number().int().min(1).max(65535),
  username: sshUsername,
  hostKeyPolicy: z.literal(HOST_KEY_POLICY),
  hostKeyFingerprint: z.string().refine(isValidSha256HostKeyFingerprint),
};

const passwordSchema = z.strictObject({
  ...commonFields,
  authMethod: z.literal('PASSWORD'),
  credential: boundedSecret(4096),
});

const privateKeySchema = z.strictObject({
  ...commonFields,
  authMethod: z.literal('PRIVATE_KEY'),
  credential: boundedSecret(65536),
  keyPassphrase: boundedSecret(4096).optional(),
});

const configurationSchema = z.discriminatedUnion('authMethod', [passwordSchema, privateKeySchema]);

export type SafeSshConfiguration = SshConfigRecord & {
  hasCredential: boolean;
  hasPrivateKeyPassphrase: boolean;
};

export class SshConfigurationError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'PBX_NOT_FOUND') {
    super(`SSH configuration ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SshConfigurationError';
  }
}

function toSecretBuffer(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

export class SshConfigurationService {
  constructor(
    private readonly storage: AppStorage,
    private readonly secrets: SecretStore,
  ) {}

  get(pbxInstanceId: string): SafeSshConfiguration | undefined {
    const record = this.storage.sshConfigs.get(pbxInstanceId);
    return record ? this.safe(record) : undefined;
  }

  list(): SafeSshConfiguration[] {
    return this.storage.sshConfigs.list().map((record) => this.safe(record));
  }

  configure(pbxInstanceId: string, input: unknown): SafeSshConfiguration {
    if (!this.storage.pbxProfiles.get(pbxInstanceId)) {
      throw new SshConfigurationError('PBX_NOT_FOUND');
    }

    const parsed = configurationSchema.safeParse(input);
    if (!parsed.success) throw new SshConfigurationError('INVALID_INPUT');

    const previous = this.storage.sshConfigs.get(pbxInstanceId);
    const now = new Date().toISOString();
    const record: SshConfigRecord = {
      pbxInstanceId,
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      authMethod: parsed.data.authMethod,
      hostKeyPolicy: HOST_KEY_POLICY,
      hostKeyFingerprint: parsed.data.hostKeyFingerprint,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    return this.storage.transaction(() => {
      this.storage.sshConfigs.put(record);

      if (parsed.data.authMethod === 'PASSWORD') {
        this.putSecret(pbxInstanceId, SSH_PASSWORD_SECRET, parsed.data.credential);
        this.secrets.deleteSecret(pbxInstanceId, SSH_PRIVATE_KEY_SECRET);
        this.secrets.deleteSecret(pbxInstanceId, SSH_PRIVATE_KEY_PASSPHRASE_SECRET);
      } else {
        this.putSecret(pbxInstanceId, SSH_PRIVATE_KEY_SECRET, parsed.data.credential);
        if (parsed.data.keyPassphrase !== undefined) {
          this.putSecret(
            pbxInstanceId,
            SSH_PRIVATE_KEY_PASSPHRASE_SECRET,
            parsed.data.keyPassphrase,
          );
        } else {
          this.secrets.deleteSecret(pbxInstanceId, SSH_PRIVATE_KEY_PASSPHRASE_SECRET);
        }
        this.secrets.deleteSecret(pbxInstanceId, SSH_PASSWORD_SECRET);
      }

      return this.safe(record);
    });
  }

  delete(pbxInstanceId: string): boolean {
    return this.storage.transaction(() => {
      const deleted = this.storage.sshConfigs.delete(pbxInstanceId);
      if (!deleted) return false;
      this.secrets.deleteSecret(pbxInstanceId, SSH_PASSWORD_SECRET);
      this.secrets.deleteSecret(pbxInstanceId, SSH_PRIVATE_KEY_SECRET);
      this.secrets.deleteSecret(pbxInstanceId, SSH_PRIVATE_KEY_PASSPHRASE_SECRET);
      return true;
    });
  }

  private safe(record: SshConfigRecord): SafeSshConfiguration {
    const credentialName =
      record.authMethod === 'PASSWORD' ? SSH_PASSWORD_SECRET : SSH_PRIVATE_KEY_SECRET;
    return {
      ...record,
      hasCredential: this.secrets.hasSecret(record.pbxInstanceId, credentialName),
      hasPrivateKeyPassphrase:
        record.authMethod === 'PRIVATE_KEY' &&
        this.secrets.hasSecret(record.pbxInstanceId, SSH_PRIVATE_KEY_PASSPHRASE_SECRET),
    };
  }

  private putSecret(pbxInstanceId: string, secretName: string, value: string): void {
    const plaintext = toSecretBuffer(value);
    try {
      this.secrets.putSecret(pbxInstanceId, secretName, plaintext);
    } finally {
      plaintext.fill(0);
    }
  }
}

export const SSH_SECRET_NAMES = Object.freeze({
  passwordCredential: SSH_PASSWORD_SECRET,
  privateKeyCredential: SSH_PRIVATE_KEY_SECRET,
  privateKeyPassphrase: SSH_PRIVATE_KEY_PASSPHRASE_SECRET,
});

export type RestrictedSshAuthMethod = SshAuthMethod;
