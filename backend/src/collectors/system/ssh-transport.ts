import { Buffer } from 'node:buffer';

export type RestrictedSshCommandId =
  'CPU_STAT' | 'MEMINFO' | 'FILESYSTEMS' | 'UPTIME' | 'SERVICE_STATUS';

export interface RestrictedSshExecutionLimits {
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface RestrictedSshCommand {
  id: RestrictedSshCommandId;
  program: string;
  args: readonly string[];
}

export type RestrictedSshCommandRequest =
  | { id: 'CPU_STAT' }
  | { id: 'MEMINFO' }
  | { id: 'FILESYSTEMS' }
  | { id: 'UPTIME' }
  | { id: 'SERVICE_STATUS'; serviceIds: readonly string[] };

export interface RestrictedSshCommandResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export type RestrictedSshTransportErrorCode =
  | 'TIMEOUT'
  | 'OUTPUT_LIMIT'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'CONNECTION_FAILED'
  | 'COMMAND_FAILED'
  | 'INVALID_COMMAND';

export class RestrictedSshTransportError extends Error {
  constructor(readonly code: RestrictedSshTransportErrorCode) {
    super(`Restricted SSH transport ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'RestrictedSshTransportError';
  }
}

export interface RestrictedSshTransport {
  execute(
    command: RestrictedSshCommand,
    limits: RestrictedSshExecutionLimits,
  ): Promise<RestrictedSshCommandResult>;
}

export const DEFAULT_RESTRICTED_SSH_LIMITS: Readonly<RestrictedSshExecutionLimits> = Object.freeze({
  timeoutMs: 5_000,
  maxOutputBytes: 256 * 1024,
});

const SERVICE_ID = /^[A-Za-z0-9_.@-]+$/;
const MAX_SERVICE_IDS = 32;
const MAX_SERVICE_ID_LENGTH = 128;
const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function invalidCommand(): never {
  throw new RestrictedSshTransportError('INVALID_COMMAND');
}

function validateServiceIds(serviceIds: readonly string[]): string[] {
  if (serviceIds.length === 0 || serviceIds.length > MAX_SERVICE_IDS) invalidCommand();

  const unique = new Set<string>();
  for (const serviceId of serviceIds) {
    if (
      !serviceId ||
      serviceId.length > MAX_SERVICE_ID_LENGTH ||
      !SERVICE_ID.test(serviceId) ||
      unique.has(serviceId)
    ) {
      invalidCommand();
    }
    unique.add(serviceId);
  }

  return [...unique];
}

/**
 * Resolve only the read-only commands approved for system metrics.
 * Callers cannot supply a shell fragment, program name, path, or arbitrary argument.
 */
export function resolveRestrictedSshCommand(
  request: RestrictedSshCommandRequest,
): RestrictedSshCommand {
  switch (request.id) {
    case 'CPU_STAT':
      return { id: request.id, program: 'cat', args: ['/proc/stat'] };
    case 'MEMINFO':
      return { id: request.id, program: 'cat', args: ['/proc/meminfo'] };
    case 'FILESYSTEMS':
      return { id: request.id, program: 'df', args: ['-P', '-B1'] };
    case 'UPTIME':
      return { id: request.id, program: 'cat', args: ['/proc/uptime'] };
    case 'SERVICE_STATUS': {
      const serviceIds = validateServiceIds(request.serviceIds);
      return {
        id: request.id,
        program: 'systemctl',
        args: [
          'show',
          '--no-pager',
          '--property=Id',
          '--property=ActiveState',
          '--',
          ...serviceIds,
        ],
      };
    }
  }
}

function validateLimits(limits: RestrictedSshExecutionLimits): void {
  if (
    !Number.isSafeInteger(limits.timeoutMs) ||
    limits.timeoutMs <= 0 ||
    limits.timeoutMs > MAX_TIMEOUT_MS ||
    !Number.isSafeInteger(limits.maxOutputBytes) ||
    limits.maxOutputBytes <= 0 ||
    limits.maxOutputBytes > MAX_OUTPUT_BYTES
  ) {
    invalidCommand();
  }
}

function outputBytes(result: RestrictedSshCommandResult): number {
  return Buffer.byteLength(result.stdout, 'utf8') + Buffer.byteLength(result.stderr ?? '', 'utf8');
}

export async function runRestrictedSshCommand(
  transport: RestrictedSshTransport,
  request: RestrictedSshCommandRequest,
  limits: RestrictedSshExecutionLimits = DEFAULT_RESTRICTED_SSH_LIMITS,
): Promise<RestrictedSshCommandResult> {
  validateLimits(limits);
  const command = resolveRestrictedSshCommand(request);

  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new RestrictedSshTransportError('TIMEOUT')),
        limits.timeoutMs,
      );
      // Keep the safety timeout referenced so a pending transport cannot let the process exit early.
    });

    const result = await Promise.race([transport.execute(command, { ...limits }), timeout]);
    if (
      !result ||
      typeof result !== 'object' ||
      !Number.isSafeInteger(result.exitCode) ||
      typeof result.stdout !== 'string' ||
      (result.stderr !== undefined && typeof result.stderr !== 'string')
    ) {
      throw new RestrictedSshTransportError('COMMAND_FAILED');
    }

    if (outputBytes(result) > limits.maxOutputBytes) {
      throw new RestrictedSshTransportError('OUTPUT_LIMIT');
    }
    if (result.exitCode !== 0) {
      throw new RestrictedSshTransportError('COMMAND_FAILED');
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      ...(result.stderr === undefined ? {} : { stderr: result.stderr }),
    };
  } catch (error) {
    if (error instanceof RestrictedSshTransportError) throw error;
    throw new RestrictedSshTransportError('CONNECTION_FAILED');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
