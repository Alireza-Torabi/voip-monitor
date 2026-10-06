import { lookup } from 'node:dns/promises';

export interface DatabaseAddressResolver {
  resolve(host: string): Promise<readonly string[]>;
}

export class NodeDatabaseAddressResolver implements DatabaseAddressResolver {
  async resolve(host: string): Promise<readonly string[]> {
    const results = await lookup(host, { all: true, verbatim: true });
    return results.map((result) => result.address);
  }
}
