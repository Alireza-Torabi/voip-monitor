import { Client, type HostVerifier } from 'ssh2';
import { NodeAddressResolver } from '../providers/asterisk/resolver.js';
import { NetworkBoundaryError } from '../network/policy.js';
import { parseSshConfigurationInput, type SshConfigurationInput } from './configuration.js';
import { validateSshResolvedTarget, verifyPinnedSshHostKey } from './trust.js';

export type SshVerificationErrorCode =
  | 'INVALID_INPUT'
  | 'HOST_KEY_MISMATCH'
  | 'AUTHENTICATION_FAILED'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'TARGET_BLOCKED';

export class SshVerificationError extends Error {
  constructor(readonly code: SshVerificationErrorCode) {
    super(`SSH verification ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'SshVerificationError';
  }
}

export interface SshConnectionVerifier {
  verify(input: unknown): Promise<void>;
}

export interface Ssh2ConnectionVerifierOptions {
  resolve?: ((host: string) => Promise<readonly string[]>) | undefined;
  validate?: ((host: string, addresses: readonly string[]) => string[]) | undefined;
  connectTimeoutMs?: number | undefined;
  clientFactory?: (() => Client) | undefined;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

function errorLevel(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'level' in error && typeof error.level === 'string'
    ? error.level
    : undefined;
}

export class Ssh2ConnectionVerifier implements SshConnectionVerifier {
  private readonly resolve: (host: string) => Promise<readonly string[]>;
  private readonly validate: (host: string, addresses: readonly string[]) => string[];
  private readonly connectTimeoutMs: number;
  private readonly clientFactory: () => Client;

  constructor(options: Ssh2ConnectionVerifierOptions = {}) {
    this.resolve = options.resolve ?? ((host) => new NodeAddressResolver().resolve(host));
    this.validate =
      options.validate ?? ((host, addresses) => validateSshResolvedTarget({ host }, addresses));
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.clientFactory = options.clientFactory ?? (() => new Client());
  }

  async verify(input: unknown): Promise<void> {
    let config: SshConfigurationInput;
    try {
      config = parseSshConfigurationInput(input);
    } catch {
      throw new SshVerificationError('INVALID_INPUT');
    }

    let addresses: string[];
    try {
      addresses = this.validate(config.host, await this.resolve(config.host));
    } catch (error) {
      if (error instanceof NetworkBoundaryError) throw new SshVerificationError('TARGET_BLOCKED');
      throw new SshVerificationError('CONNECTION_FAILED');
    }
    const address = addresses[0];
    if (!address) throw new SshVerificationError('CONNECTION_FAILED');

    const client = this.clientFactory();
    let hostKeyMismatch = false;
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error): void => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve();
        };
        client.once('ready', () => finish());
        client.once('error', (error) => finish(error));
        client.once('timeout', () => finish(new Error('ssh timeout')));
        const hostVerifier: HostVerifier = (key, verify) => {
          try {
            verifyPinnedSshHostKey(config.hostKeyFingerprint, key);
            verify(true);
          } catch {
            hostKeyMismatch = true;
            verify(false);
          }
        };
        client.connect({
          host: address,
          port: config.port,
          username: config.username,
          ...(config.authMethod === 'PASSWORD' ? { password: config.credential } : {}),
          ...(config.authMethod === 'PRIVATE_KEY' ? { privateKey: config.credential } : {}),
          ...(config.authMethod === 'PRIVATE_KEY' && config.keyPassphrase
            ? { passphrase: config.keyPassphrase }
            : {}),
          readyTimeout: this.connectTimeoutMs,
          hostVerifier,
        });
      });
    } catch (error) {
      if (hostKeyMismatch) throw new SshVerificationError('HOST_KEY_MISMATCH');
      if (errorLevel(error) === 'client-authentication')
        throw new SshVerificationError('AUTHENTICATION_FAILED');
      if (error instanceof Error && /timeout/iu.test(error.message))
        throw new SshVerificationError('TIMEOUT');
      throw new SshVerificationError('CONNECTION_FAILED');
    } finally {
      try {
        client.end();
      } catch {
        client.destroy();
      }
    }
  }
}
