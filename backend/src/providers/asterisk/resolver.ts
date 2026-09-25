import { lookup } from 'node:dns/promises';
import type { AddressResolver } from './connection.js';

/**
 * Runtime resolver for the future real provider path.
 * Connection code validates every returned address and the TCP transport must
 * use the selected numeric address without resolving the hostname again.
 */
export class NodeAddressResolver implements AddressResolver {
  async resolve(host: string): Promise<readonly string[]> {
    const results = await lookup(host, { all: true, verbatim: true });
    return results.map((result) => result.address);
  }
}
