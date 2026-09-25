import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { PbxConnectionState } from '@voip-monitor/shared';
import { z } from 'zod';
import type { SecretStore } from '../security/secret-store.js';
import type { AppStorage, PbxProfileRecord } from '../storage/index.js';

const AMI_SECRET = 'ami-password';
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hostnameLabel = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
export function validHost(value: string): boolean {
  if (value.length < 1 || value.length > 253) return false;
  if (isIP(value) !== 0) return true;
  if (/^[0-9.]+$/.test(value)) return false;
  return value.split('.').every((label) => hostnameLabel.test(label));
}
const host = z.string().refine(validHost);
const secret = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 1024);
const fields = {
  displayName: z.string().trim().min(1).max(100),
  providerType: z.literal('ASTERISK'),
  enabled: z.boolean(),
  amiHost: host,
  amiPort: z.number().int().min(1).max(65535),
  amiUsername: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .refine((value) =>
      [...value].every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    ),
};
const createSchema = z.strictObject({
  ...fields,
  amiPassword: secret,
});
const updateSchema = z
  .strictObject({
    displayName: fields.displayName.optional(),
    enabled: fields.enabled.optional(),
    amiHost: fields.amiHost.optional(),
    amiPort: fields.amiPort.optional(),
    amiUsername: fields.amiUsername.optional(),
    amiPassword: secret.optional(),
    removeAmiPassword: z.literal(true).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0 && !(value.amiPassword && value.removeAmiPassword),
  );
export type SafePbxProfile = PbxProfileRecord & {
  connectionStatus: PbxConnectionState;
  hasAmiPassword: boolean;
};
export class OnboardingInputError extends Error {
  constructor() {
    super('Invalid PBX profile');
    this.name = 'OnboardingInputError';
  }
}
export class PbxOnboardingService {
  constructor(
    private readonly storage: AppStorage,
    private readonly secrets: SecretStore,
    private readonly connectionState: (id: string) => PbxConnectionState = () => 'UNVERIFIED',
  ) {}
  private safe(profile: PbxProfileRecord): SafePbxProfile {
    return {
      ...profile,
      connectionStatus: this.connectionState(profile.id),
      hasAmiPassword: this.secrets.hasSecret(profile.id, AMI_SECRET),
    };
  }
  list(): SafePbxProfile[] {
    return this.storage.pbxProfiles.list().map((profile) => this.safe(profile));
  }
  get(id: string): SafePbxProfile | undefined {
    if (!idPattern.test(id)) return undefined;
    const profile = this.storage.pbxProfiles.get(id);
    return profile ? this.safe(profile) : undefined;
  }
  create(input: unknown): SafePbxProfile {
    const result = createSchema.safeParse(input);
    if (!result.success) throw new OnboardingInputError();
    const { amiPassword, ...data } = result.data;
    const now = new Date().toISOString();
    const profile: PbxProfileRecord = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
    return this.storage.transaction(() => {
      this.storage.pbxProfiles.create(profile);
      const plaintext = Buffer.from(amiPassword, 'utf8');
      try {
        this.secrets.putSecret(profile.id, AMI_SECRET, plaintext);
      } finally {
        plaintext.fill(0);
      }
      this.storage.setup.set('PBX_CONFIGURED_UNVERIFIED');
      return this.safe(profile);
    });
  }
  update(id: string, input: unknown): SafePbxProfile | undefined {
    if (!idPattern.test(id)) return undefined;
    const result = updateSchema.safeParse(input);
    if (!result.success) throw new OnboardingInputError();
    const { amiPassword, removeAmiPassword, ...changes } = result.data;
    return this.storage.transaction(() => {
      const previous = this.storage.pbxProfiles.get(id);
      if (!previous) return;
      const updated: PbxProfileRecord = {
        ...previous,
        displayName: changes.displayName ?? previous.displayName,
        enabled: changes.enabled ?? previous.enabled,
        amiHost: changes.amiHost ?? previous.amiHost,
        amiPort: changes.amiPort ?? previous.amiPort,
        amiUsername: changes.amiUsername ?? previous.amiUsername,
        updatedAt: new Date().toISOString(),
      };
      this.storage.pbxProfiles.update(updated);
      if (amiPassword !== undefined) {
        const plaintext = Buffer.from(amiPassword, 'utf8');
        try {
          this.secrets.putSecret(id, AMI_SECRET, plaintext);
        } finally {
          plaintext.fill(0);
        }
      } else if (removeAmiPassword) {
        this.secrets.deleteSecret(id, AMI_SECRET);
      }
      const connectionChanged =
        changes.amiHost !== undefined ||
        changes.amiPort !== undefined ||
        changes.amiUsername !== undefined ||
        amiPassword !== undefined ||
        removeAmiPassword === true;
      if (connectionChanged) {
        this.storage.pbxProfiles.clearVerification(id);
        this.storage.pbxInstances.clearDiscovery(id);
        this.storage.setup.set(
          this.storage.pbxProfiles.verifiedCount() > 0 ? 'COMPLETE' : 'PBX_CONFIGURED_UNVERIFIED',
        );
      }
      return this.safe(updated);
    });
  }
  delete(id: string): boolean {
    if (!idPattern.test(id)) return false;
    let removed = false;
    this.storage.transaction(() => {
      removed = this.storage.pbxProfiles.delete(id);
      if (removed) {
        if (this.storage.pbxProfiles.count() === 0) this.storage.setup.set('SETUP_IN_PROGRESS');
        else
          this.storage.setup.set(
            this.storage.pbxProfiles.verifiedCount() > 0 ? 'COMPLETE' : 'PBX_CONFIGURED_UNVERIFIED',
          );
      }
    });
    return removed;
  }
}
