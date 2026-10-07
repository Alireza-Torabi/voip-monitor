import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';
import { validateResolvedTarget } from '../network/policy.js';
import type { DatabaseDialect } from '../storage/index.js';
import {
  MysqlMariadbReadOnlyAdapter,
  PostgresqlReadOnlyAdapter,
  type DatabaseDialectAdapter,
} from './adapters.js';
import {
  parseDatabaseSourceConfigurationInput,
  type DatabaseSourceConfigurationInput,
} from './configuration.js';
import { DatabaseQueryError, prepareReadOnlyQuery } from './query.js';
import type { DatabaseAddressResolver } from './resolver.js';
import type { DatabaseConnectionBackoff } from './backoff.js';

const VERIFICATION_TIMEOUT_MS = 5_000;

export interface DatabaseSourceVerifier {
  verify(pbxInstanceId: string, input: unknown): Promise<void>;
}

function defaultAdapters(): Record<DatabaseDialect, DatabaseDialectAdapter> {
  return {
    MYSQL_MARIADB: new MysqlMariadbReadOnlyAdapter(),
    POSTGRESQL: new PostgresqlReadOnlyAdapter(),
  };
}

export class ReadOnlyDatabaseSourceVerifier implements DatabaseSourceVerifier {
  private readonly adapters: Record<DatabaseDialect, DatabaseDialectAdapter>;

  constructor(
    private readonly resolver: DatabaseAddressResolver,
    private readonly backoff?: DatabaseConnectionBackoff,
    adapters?: Partial<Record<DatabaseDialect, DatabaseDialectAdapter>>,
  ) {
    this.adapters = { ...defaultAdapters(), ...adapters };
  }

  async verify(pbxInstanceId: string, input: unknown): Promise<void> {
    this.backoff?.assertAllowed(pbxInstanceId);
    const candidate = parseDatabaseSourceConfigurationInput(input);
    await this.verifyCandidate(pbxInstanceId, candidate);
  }

  private async verifyCandidate(
    pbxInstanceId: string,
    candidate: DatabaseSourceConfigurationInput,
  ): Promise<void> {
    const credential = Buffer.from(candidate.credential, 'utf8');
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new DatabaseQueryError('TIMEOUT'));
      }, VERIFICATION_TIMEOUT_MS);
    });

    try {
      const resolved =
        isIP(candidate.host) === 0
          ? await Promise.race([this.resolver.resolve(candidate.host), timeout])
          : [candidate.host];
      const approved = validateResolvedTarget(candidate.host, resolved);
      const address = approved[0];
      if (!address) throw new DatabaseQueryError('CONNECTION_FAILED');

      const prepared = prepareReadOnlyQuery(
        candidate.dialect,
        { sql: 'SELECT 1 AS verification_value' },
        { timeoutMs: VERIFICATION_TIMEOUT_MS, maxRows: 1, maxOutputBytes: 1024 },
      );

      await Promise.race([
        this.adapters[candidate.dialect].execute(
          {
            host: candidate.host,
            address,
            port: candidate.port,
            databaseName: candidate.databaseName,
            username: candidate.username,
            tlsMode: candidate.tlsMode,
          },
          credential,
          prepared,
          controller.signal,
        ),
        timeout,
      ]);
      this.backoff?.recordSuccess(pbxInstanceId);
    } catch (error) {
      if (error instanceof DatabaseQueryError) {
        if (error.code === 'CONNECTION_FAILED' || error.code === 'TIMEOUT')
          this.backoff?.recordFailure(pbxInstanceId);
        throw error;
      }
      this.backoff?.recordFailure(pbxInstanceId);
      throw new DatabaseQueryError('CONNECTION_FAILED');
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      credential.fill(0);
    }
  }
}
