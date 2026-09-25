import { Buffer } from 'node:buffer';
import { Client, type ClientChannel, type HostVerifier } from 'ssh2';
import type { SshConfigurationService } from '../../ssh/configuration.js';
import { SSH_SECRET_NAMES } from '../../ssh/configuration.js';
import { validateSshResolvedTarget, verifyPinnedSshHostKey } from '../../ssh/trust.js';
import type { SecretStore } from '../../security/secret-store.js';
import {
  RestrictedSshTransportError,
  type RestrictedSshCommand,
  type RestrictedSshExecutionLimits,
  type RestrictedSshCommandResult,
  type RestrictedSshTransport,
} from './ssh-transport.js';

export type SshAddressResolver = (host: string) => Promise<readonly string[]>;

export type SshResolvedAddressValidator = (host: string, addresses: readonly string[]) => string[];

export interface Ssh2RestrictedSshTransportOptions {
  configuration: SshConfigurationService;
  secrets: SecretStore;
  pbxInstanceId: string;
  resolveAddresses: SshAddressResolver;
  validateAddresses?: SshResolvedAddressValidator;
  connectTimeoutMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const MAX_CONNECT_TIMEOUT_MS = 30_000;

function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function commandLine(command: RestrictedSshCommand): string {
  return [command.program, ...command.args].map(shellQuote).join(' ');
}

function validateConnectTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_CONNECT_TIMEOUT_MS) {
    throw new RestrictedSshTransportError('INVALID_COMMAND');
  }
  return value;
}

function collectChunk(
  target: Buffer[],
  chunk: Buffer | string,
  total: { value: number },
  limit: number,
): void {
  const bytes = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk, 'utf8');
  total.value += bytes.length;
  if (total.value > limit) {
    bytes.fill(0);
    throw new RestrictedSshTransportError('OUTPUT_LIMIT');
  }
  target.push(bytes);
}

function closeClient(client: Client): void {
  try {
    client.end();
  } catch {
    client.destroy();
  }
}

function destroyChannel(channel: ClientChannel): void {
  try {
    channel.close();
  } catch {
    // Connection cleanup remains the final safety path.
  }
}

export class Ssh2RestrictedSshTransport implements RestrictedSshTransport {
  private readonly connectTimeoutMs: number;
  private readonly validateAddresses: SshResolvedAddressValidator;

  constructor(private readonly options: Ssh2RestrictedSshTransportOptions) {
    this.connectTimeoutMs = validateConnectTimeout(
      options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    );
    this.validateAddresses =
      options.validateAddresses ??
      ((host, addresses) => validateSshResolvedTarget({ host }, addresses));
  }

  async execute(
    command: RestrictedSshCommand,
    limits: RestrictedSshExecutionLimits,
  ): Promise<RestrictedSshCommandResult> {
    const config = this.options.configuration.get(this.options.pbxInstanceId);
    if (!config || !config.hasCredential) {
      throw new RestrictedSshTransportError('PERMISSION_DENIED');
    }

    const resolved = await this.options.resolveAddresses(config.host);
    const addresses = this.validateAddresses(config.host, resolved);
    const address = addresses[0];
    if (!address) throw new RestrictedSshTransportError('CONNECTION_FAILED');

    const client = new Client();
    let credential: Buffer | undefined;
    let passphrase: Buffer | undefined;
    let channel: ClientChannel | undefined;

    try {
      if (config.authMethod === 'PASSWORD') {
        credential = this.options.secrets.getSecret(
          config.pbxInstanceId,
          SSH_SECRET_NAMES.passwordCredential,
        );
        if (!credential) throw new RestrictedSshTransportError('PERMISSION_DENIED');
      } else {
        credential = this.options.secrets.getSecret(
          config.pbxInstanceId,
          SSH_SECRET_NAMES.privateKeyCredential,
        );
        if (!credential) throw new RestrictedSshTransportError('PERMISSION_DENIED');
        if (config.hasPrivateKeyPassphrase) {
          passphrase = this.options.secrets.getSecret(
            config.pbxInstanceId,
            SSH_SECRET_NAMES.privateKeyPassphrase,
          );
        }
      }

      return await this.executeConnected(
        client,
        address,
        config,
        credential,
        passphrase,
        command,
        limits,
        (nextChannel) => {
          channel = nextChannel;
        },
      );
    } catch (error) {
      if (error instanceof RestrictedSshTransportError) throw error;
      throw new RestrictedSshTransportError('CONNECTION_FAILED');
    } finally {
      if (channel) destroyChannel(channel);
      closeClient(client);
      credential?.fill(0);
      passphrase?.fill(0);
    }
  }

  private async executeConnected(
    client: Client,
    address: string,
    config: {
      port: number;
      username: string;
      authMethod: 'PASSWORD' | 'PRIVATE_KEY';
      hostKeyFingerprint: string;
    },
    credential: Buffer,
    passphrase: Buffer | undefined,
    command: RestrictedSshCommand,
    limits: RestrictedSshExecutionLimits,
    onChannel: (channel: ClientChannel) => void,
  ): Promise<RestrictedSshCommandResult> {
    const password = config.authMethod === 'PASSWORD' ? credential.toString('utf8') : undefined;
    const privateKey = config.authMethod === 'PRIVATE_KEY' ? credential : undefined;

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
          verify(false);
        }
      };

      client.connect({
        host: address,
        port: config.port,
        username: config.username,
        ...(password === undefined ? {} : { password }),
        ...(privateKey === undefined ? {} : { privateKey }),
        ...(passphrase === undefined ? {} : { passphrase }),
        readyTimeout: this.connectTimeoutMs,
        hostVerifier,
      });
    });

    return await this.executeChannel(client, command, limits, onChannel);
  }

  private async executeChannel(
    client: Client,
    command: RestrictedSshCommand,
    limits: RestrictedSshExecutionLimits,
    onChannel: (channel: ClientChannel) => void,
  ): Promise<RestrictedSshCommandResult> {
    return await new Promise<RestrictedSshCommandResult>((resolve, reject) => {
      let settled = false;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      const total = { value: 0 };
      let exitCode: number | undefined;

      const fail = (error: RestrictedSshTransportError): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        reject(error);
      };

      const succeed = (): void => {
        if (settled || exitCode === undefined) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const out = Buffer.concat(stdout);
        const err = Buffer.concat(stderr);
        stdout.forEach((chunk) => chunk.fill(0));
        stderr.forEach((chunk) => chunk.fill(0));
        const stdoutText = out.toString('utf8');
        const stderrText = err.toString('utf8');
        out.fill(0);
        err.fill(0);
        resolve({
          exitCode,
          stdout: stdoutText,
          ...(stderrText.length === 0 ? {} : { stderr: stderrText }),
        });
      };

      const timer = setTimeout(
        () => fail(new RestrictedSshTransportError('TIMEOUT')),
        limits.timeoutMs,
      );
      timer.unref();

      client.exec(commandLine(command), { pty: false }, (error, nextChannel) => {
        if (error) {
          fail(new RestrictedSshTransportError('COMMAND_FAILED'));
          return;
        }

        onChannel(nextChannel);
        nextChannel.on('data', (chunk: Buffer | string) => {
          try {
            collectChunk(stdout, chunk, total, limits.maxOutputBytes);
          } catch (caught) {
            fail(
              caught instanceof RestrictedSshTransportError
                ? caught
                : new RestrictedSshTransportError('OUTPUT_LIMIT'),
            );
            destroyChannel(nextChannel);
          }
        });
        nextChannel.stderr.on('data', (chunk: Buffer | string) => {
          try {
            collectChunk(stderr, chunk, total, limits.maxOutputBytes);
          } catch (caught) {
            fail(
              caught instanceof RestrictedSshTransportError
                ? caught
                : new RestrictedSshTransportError('OUTPUT_LIMIT'),
            );
            destroyChannel(nextChannel);
          }
        });
        nextChannel.on('exit', (code) => {
          exitCode = code ?? 255;
        });
        nextChannel.once('error', () => {
          fail(new RestrictedSshTransportError('COMMAND_FAILED'));
        });
        nextChannel.once('close', () => {
          if (exitCode === undefined || exitCode !== 0) {
            fail(new RestrictedSshTransportError('COMMAND_FAILED'));
          } else {
            succeed();
          }
        });
      });
    });
  }
}
