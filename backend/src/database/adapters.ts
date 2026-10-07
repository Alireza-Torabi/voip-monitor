import { Buffer } from 'node:buffer';
import { createConnection as createTcpConnection, isIP, type Socket } from 'node:net';
import * as mysql from 'mysql2/promise.js';
import { Client as PgClient, type ClientConfig, type QueryResultRow } from 'pg';
import type { DatabaseTlsMode } from '../storage/index.js';
import { DatabaseQueryError, type PreparedReadOnlyQuery } from './query.js';

export interface DatabaseDriverTarget {
  host: string;
  address: string;
  port: number;
  databaseName: string;
  username: string;
  tlsMode: DatabaseTlsMode;
}

export interface DatabaseDialectAdapter {
  execute(
    target: DatabaseDriverTarget,
    credential: Buffer,
    query: PreparedReadOnlyQuery,
    signal: AbortSignal,
  ): Promise<readonly Record<string, unknown>[]>;
}

export type MysqlConnectionFactory = (
  options: mysql.ConnectionOptions,
) => Promise<mysql.Connection>;
export type MysqlTcpStreamFactory = (address: string, port: number) => Socket;

export type PostgresClientLike = {
  connect(): Promise<unknown>;
  query(
    queryTextOrConfig: string | { text: string; values?: readonly unknown[] },
    values?: readonly unknown[],
  ): Promise<{ rows: QueryResultRow[] }>;
  end(): Promise<void>;
};

export type PostgresClientFactory = (options: ClientConfig) => PostgresClientLike;

function mysqlConnectionError(error: unknown, signal: AbortSignal): DatabaseQueryError {
  if (signal.aborted) return new DatabaseQueryError('TIMEOUT');
  if (error instanceof DatabaseQueryError) return error;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
    if (candidate.code === 'ER_ACCESS_DENIED_ERROR' || candidate.errno === 1045)
      return new DatabaseQueryError('AUTHENTICATION_FAILED');
    if (candidate.code === 'ER_BAD_DB_ERROR' || candidate.errno === 1049)
      return new DatabaseQueryError('DATABASE_NOT_FOUND');
    if (candidate.code === 'ER_HOST_IS_BLOCKED' || candidate.errno === 1129)
      return new DatabaseQueryError('HOST_BLOCKED');
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    if (/ssl|tls|certificate/i.test(code) || /ssl|tls|certificate/i.test(message))
      return new DatabaseQueryError('TLS_FAILED');
  }
  return new DatabaseQueryError('CONNECTION_FAILED');
}

function queryError(error: unknown, signal: AbortSignal): DatabaseQueryError {
  if (signal.aborted) return new DatabaseQueryError('TIMEOUT');
  if (error instanceof DatabaseQueryError) return error;
  return new DatabaseQueryError('QUERY_FAILED');
}

function isMysqlReadOnlyTransactionSyntaxUnsupported(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate.code === 'ER_PARSE_ERROR' || candidate.errno === 1064;
}

async function safeMysqlEnd(connection: mysql.Connection | undefined): Promise<void> {
  if (!connection) return;
  try {
    await connection.end();
  } catch {
    connection.destroy();
  }
}

export class MysqlMariadbReadOnlyAdapter implements DatabaseDialectAdapter {
  constructor(
    private readonly createConnection: MysqlConnectionFactory = mysql.createConnection,
    private readonly createTcpStream: MysqlTcpStreamFactory = (address, port) =>
      createTcpConnection({ host: address, port, family: isIP(address) as 4 | 6 }),
  ) {}

  async execute(
    target: DatabaseDriverTarget,
    credential: Buffer,
    query: PreparedReadOnlyQuery,
    signal: AbortSignal,
  ): Promise<readonly Record<string, unknown>[]> {
    let connection: mysql.Connection | undefined;
    let transactionStarted = false;
    const password = credential.toString('utf8');

    try {
      connection = await this.createConnection({
        host: target.host,
        port: target.port,
        stream: () => this.createTcpStream(target.address, target.port),
        user: target.username,
        ['password']: password,
        database: target.databaseName,
        connectTimeout: Math.min(query.limits.timeoutMs, 10_000),
        multipleStatements: false,
        enableCleartextPlugin: false,
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
        jsonStrings: true,
        ...(target.tlsMode === 'REQUIRED'
          ? {
              ssl: {
                rejectUnauthorized: true,
                verifyIdentity: true,
                minVersion: 'TLSv1.2',
              },
            }
          : {}),
      });

      const abort = (): void => connection?.destroy();
      signal.addEventListener('abort', abort, { once: true });
      try {
        try {
          await connection.query('START TRANSACTION READ ONLY');
        } catch (error) {
          if (!isMysqlReadOnlyTransactionSyntaxUnsupported(error)) throw error;
          await connection.query('START TRANSACTION');
        }
        transactionStarted = true;
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          {
            sql: query.statement,
            timeout: query.limits.timeoutMs,
            rowsAsArray: false,
          },
          [...query.parameters],
        );
        return rows.map((row) => ({ ...row }));
      } finally {
        signal.removeEventListener('abort', abort);
        if (transactionStarted && !signal.aborted) {
          try {
            await connection.rollback();
          } catch {
            // Connection close below is the final read-only transaction cleanup path.
          }
        }
      }
    } catch (error) {
      if (!connection) throw mysqlConnectionError(error, signal);
      throw queryError(error, signal);
    } finally {
      await safeMysqlEnd(connection);
    }
  }
}

function postgresSsl(target: DatabaseDriverTarget): ClientConfig['ssl'] {
  if (target.tlsMode === 'DISABLED') return false;
  return {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    ...(isIP(target.host) === 0 ? { servername: target.host } : {}),
  };
}

export class PostgresqlReadOnlyAdapter implements DatabaseDialectAdapter {
  constructor(
    private readonly createClient: PostgresClientFactory = (options) =>
      new PgClient(options) as PostgresClientLike,
  ) {}

  async execute(
    target: DatabaseDriverTarget,
    credential: Buffer,
    query: PreparedReadOnlyQuery,
    signal: AbortSignal,
  ): Promise<readonly Record<string, unknown>[]> {
    const client = this.createClient({
      host: target.address,
      port: target.port,
      user: target.username,
      ['password']: credential.toString('utf8'),
      database: target.databaseName,
      application_name: 'voip-monitor',
      connectionTimeoutMillis: Math.min(query.limits.timeoutMs, 10_000),
      query_timeout: query.limits.timeoutMs,
      statement_timeout: query.limits.timeoutMs,
      ssl: postgresSsl(target),
    });

    let connected = false;
    let transactionStarted = false;
    const abort = (): void => {
      void client.end().catch(() => undefined);
    };
    signal.addEventListener('abort', abort, { once: true });

    try {
      await client.connect();
      connected = true;
      await client.query('BEGIN READ ONLY');
      transactionStarted = true;
      const result = await client.query({
        text: query.statement,
        values: [...query.parameters],
      });
      return result.rows.map((row) => ({ ...row }));
    } catch (error) {
      if (!connected) {
        if (signal.aborted) throw new DatabaseQueryError('TIMEOUT');
        throw new DatabaseQueryError('CONNECTION_FAILED');
      }
      throw queryError(error, signal);
    } finally {
      signal.removeEventListener('abort', abort);
      if (connected && transactionStarted && !signal.aborted) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Connection close below is the final read-only transaction cleanup path.
        }
      }
      if (connected) {
        try {
          await client.end();
        } catch {
          // No raw driver error is exposed from cleanup.
        }
      }
    }
  }
}
