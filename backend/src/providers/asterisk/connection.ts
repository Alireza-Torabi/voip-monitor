import { isIP } from 'node:net';
import { validateResolvedTarget } from './network-policy.js';
import type { AmiTransport } from './transport.js';

export interface AddressResolver {
  resolve(host: string): Promise<readonly string[]>;
}

export interface AsteriskConnectionConfig {
  host: string;
  port: number;
}

/**
 * Connection orchestration with injected DNS and transport boundaries.
 * This file contains no DNS/socket implementation, so tests and CI cannot
 * contact a PBX through it accidentally.
 */
export class AsteriskConnection {
  constructor(
    private readonly resolver: AddressResolver,
    private readonly transport: AmiTransport,
  ) {}

  async connect(config: AsteriskConnectionConfig): Promise<void> {
    const resolved = isIP(config.host) ? [config.host] : await this.resolver.resolve(config.host);
    const approved = validateResolvedTarget(config.host, resolved);
    const address = approved[0];
    if (!address) throw new Error('No approved PBX address');
    await this.transport.connect({
      host: config.host,
      address,
      port: config.port,
    });
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }
}
