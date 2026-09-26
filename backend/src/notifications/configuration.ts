import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SecretStore } from '../security/secret-store.js';
import type { AppStorage, NotificationChannelConfig } from '../storage/index.js';

const CHANNEL_ID = /^[a-z][a-z0-9._-]{0,63}$/u;

const inputSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  targetUrl: z.string().trim().max(2048).optional(),
});

export type SafeNotificationChannel = Omit<NotificationChannelConfig, 'secretName'> & {
  hasTarget: boolean;
};

export class NotificationConfigurationError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'PBX_NOT_FOUND' | 'CHANNEL_NOT_FOUND') {
    super(`Notification configuration ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'NotificationConfigurationError';
  }
}

function targetSecretName(channelId: string): string {
  return `notification-webhook-${createHash('sha256').update(channelId).digest('hex').slice(0, 24)}`;
}

function validateTarget(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new NotificationConfigurationError('INVALID_INPUT');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hash !== '' ||
    !parsed.hostname ||
    parsed.href.length > 2048
  )
    throw new NotificationConfigurationError('INVALID_INPUT');
  return parsed.href;
}

export class NotificationConfigurationService {
  constructor(
    private readonly storage: AppStorage,
    private readonly secrets: SecretStore,
  ) {}

  list(instanceId: string): SafeNotificationChannel[] {
    if (!this.storage.pbxProfiles.get(instanceId))
      throw new NotificationConfigurationError('PBX_NOT_FOUND');
    return this.storage.notificationChannels.list(instanceId).map((record) => this.safe(record));
  }

  get(instanceId: string, channelId: string): SafeNotificationChannel | undefined {
    if (!this.storage.pbxProfiles.get(instanceId))
      throw new NotificationConfigurationError('PBX_NOT_FOUND');
    const record = this.storage.notificationChannels.get(channelId);
    return record?.instanceId === instanceId ? this.safe(record) : undefined;
  }

  configure(instanceId: string, channelId: string, input: unknown): SafeNotificationChannel {
    if (!this.storage.pbxProfiles.get(instanceId))
      throw new NotificationConfigurationError('PBX_NOT_FOUND');
    if (!CHANNEL_ID.test(channelId)) throw new NotificationConfigurationError('INVALID_INPUT');
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new NotificationConfigurationError('INVALID_INPUT');

    const previous = this.storage.notificationChannels.get(channelId);
    if (previous && previous.instanceId !== instanceId)
      throw new NotificationConfigurationError('CHANNEL_NOT_FOUND');

    const secretName = previous?.secretName ?? targetSecretName(channelId);
    if (parsed.data.targetUrl === undefined && !this.secrets.hasSecret(instanceId, secretName))
      throw new NotificationConfigurationError('INVALID_INPUT');

    const now = new Date().toISOString();
    const record: NotificationChannelConfig = {
      id: channelId,
      instanceId,
      transport: 'WEBHOOK',
      displayName: parsed.data.displayName,
      enabled: parsed.data.enabled,
      secretName,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    return this.storage.transaction(() => {
      if (parsed.data.targetUrl !== undefined) {
        const normalized = validateTarget(parsed.data.targetUrl);
        const plaintext = Buffer.from(normalized, 'utf8');
        try {
          this.secrets.putSecret(instanceId, secretName, plaintext);
        } finally {
          plaintext.fill(0);
        }
      }
      this.storage.notificationChannels.put(record);
      return this.safe(record);
    });
  }

  delete(instanceId: string, channelId: string): boolean {
    const record = this.storage.notificationChannels.get(channelId);
    if (!record || record.instanceId !== instanceId) return false;
    return this.storage.transaction(() => {
      const deleted = this.storage.notificationChannels.delete(channelId);
      if (!deleted) return false;
      this.secrets.deleteSecret(instanceId, record.secretName);
      return true;
    });
  }

  private safe(record: NotificationChannelConfig): SafeNotificationChannel {
    return {
      id: record.id,
      instanceId: record.instanceId,
      transport: record.transport,
      displayName: record.displayName,
      enabled: record.enabled,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      hasTarget: this.secrets.hasSecret(record.instanceId, record.secretName),
    };
  }
}
