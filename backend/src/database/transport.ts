import { isIP } from 'node:net';
import { validateResolvedTarget } from '../network/policy.js';
import type { SecretStore } from '../security/secret-store.js';
import type { DatabaseDialect } from '../storage/index.js';
import {
  DATABASE_SOURCE_SECRET_NAMES,
  type DatabaseSourceConfigurationService,
} from './configuration.js';
import {
  MysqlMariadbReadOnlyAdapter,
  PostgresqlReadOnlyAdapter,
  type DatabaseDialectAdapter,
} from './adapters.js';
import type { DatabaseAddressResolver } from './resolver.js';
import {
  DatabaseQueryError,
  normalizeDatabaseRows,
  prepareReadOnlyQuery,
  type DatabaseQueryLimits,
  type DatabaseResultRow,
  type ReadOnlyDatabaseQuery,
} from './query.js';

export interface ReadOnlyDatabaseTransportOptions {
  configuration: DatabaseSourceConfigurationService;
  secrets: SecretStore;
  resolver: DatabaseAddressResolver;
  adapters?: Partial<Record<DatabaseDialect, DatabaseDialectAdapter>>;
}

export interface DatabaseQueryResult {
  rows: readonly DatabaseResultRow[];
  rowCount: number;
}

function defaultAdapters(): Record<DatabaseDialect, DatabaseDialectAdapter> {
  return {
    MYSQL_MARIADB: new MysqlMariadbReadOnlyAdapter(),
    POSTGRESQL: new PostgresqlReadOnlyAdapter(),
  };
}

export class ReadOnlyDatabaseTransport {
  private readonly adapters: Record<DatabaseDialect, DatabaseDialectAdapter>;

  constructor(private readonly options: ReadOnlyDatabaseTransportOptions) {
    this.adapters = { ...defaultAdapters(), ...options.adapters };
  }

  async query(
    pbxInstanceId: string,
    request: ReadOnlyDatabaseQuery,
    limits?: DatabaseQueryLimits,
  ): Promise<DatabaseQueryResult> {
    const config = this.options.configuration.get(pbxInstanceId);
    if (!config) throw new DatabaseQueryError('NOT_CONFIGURED');
    if (config.accessMode !== 'READ_ONLY' || !config.hasCredential) {
      throw new DatabaseQueryError('PERMISSION_DENIED');
    }

    const prepared = prepareReadOnlyQuery(config.dialect, request, limits);
    const credential = this.options.secrets.getSecret(
      pbxInstanceId,
      DATABASE_SOURCE_SECRET_NAMES.passwordCredential,
    );
    if (!credential) throw new DatabaseQueryError('PERMISSION_DENIED');

    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new DatabaseQueryError('TIMEOUT'));
      }, prepared.limits.timeoutMs);
    });

    try {
      const resolved =
        isIP(config.host) === 0
          ? await Promise.race([this.options.resolver.resolve(config.host), timeout])
          : [config.host];
      const approved = validateResolvedTarget(config.host, resolved);
      const address = approved[0];
      if (!address) throw new DatabaseQueryError('CONNECTION_FAILED');

      const adapter = this.adapters[config.dialect];
      let rawRows: readonly Record<string, unknown>[];
      try {
        rawRows = await Promise.race([
          adapter.execute(
            {
              host: config.host,
              address,
              port: config.port,
              databaseName: config.databaseName,
              username: config.username,
              tlsMode: config.tlsMode,
            },
            credential,
            prepared,
            controller.signal,
          ),
          timeout,
        ]);
      } catch (error) {
        if (error instanceof DatabaseQueryError) throw error;
        throw new DatabaseQueryError('QUERY_FAILED');
      }

      const rows = normalizeDatabaseRows(rawRows, prepared.limits);
      return { rows, rowCount: rows.length };
    } catch (error) {
      if (error instanceof DatabaseQueryError) throw error;
      throw new DatabaseQueryError('CONNECTION_FAILED');
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      credential.fill(0);
    }
  }
}
