import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import {
  MysqlMariadbReadOnlyAdapter,
  PostgresqlReadOnlyAdapter,
} from '../dist/database/adapters.js';
import { DatabaseQueryError, prepareReadOnlyQuery } from '../dist/database/query.js';

const limits = { timeoutMs: 1000, maxRows: 5, maxOutputBytes: 4096 };

function target(overrides = {}) {
  return {
    host: 'db.example.test',
    address: '10.10.10.5',
    port: 3306,
    databaseName: 'pbx_reporting',
    username: 'readonly_monitor',
    tlsMode: 'REQUIRED',
    ...overrides,
  };
}

test('MySQL/MariaDB adapter connects only to the approved numeric address and runs a read-only transaction', async () => {
  let options;
  const calls = [];
  let rolledBack = false;
  let ended = false;
  let destroyed = false;

  const connection = {
    async query(statement, values) {
      calls.push({ statement, values });
      if (typeof statement === 'string') return [[], []];
      return [[{ linkedid: 'call-1', duration: 20 }], []];
    },
    async rollback() {
      rolledBack = true;
    },
    async end() {
      ended = true;
    },
    destroy() {
      destroyed = true;
    },
  };

  let streamTarget;
  const syntheticStream = {};
  const adapter = new MysqlMariadbReadOnlyAdapter(
    async (value) => {
      options = value;
      return connection;
    },
    (address, port) => {
      streamTarget = { address, port };
      return syntheticStream;
    },
  );
  const query = prepareReadOnlyQuery(
    'MYSQL_MARIADB',
    { sql: 'SELECT linkedid, duration FROM cdr WHERE disposition = ?', parameters: ['ANSWERED'] },
    limits,
  );

  const rows = await adapter.execute(
    target(),
    Buffer.from('synthetic-database-credential'),
    query,
    new globalThis.AbortController().signal,
  );

  assert.deepEqual(rows, [{ linkedid: 'call-1', duration: 20 }]);
  assert.equal(options.host, 'db.example.test');
  assert.equal(options.port, 3306);
  assert.equal(typeof options.stream, 'function');
  assert.equal(options.stream(), syntheticStream);
  assert.deepEqual(streamTarget, { address: '10.10.10.5', port: 3306 });
  assert.equal(options.user, 'readonly_monitor');
  assert.equal(options.database, 'pbx_reporting');
  assert.equal(options.password, 'synthetic-database-credential');
  assert.equal(options.multipleStatements, false);
  assert.equal(options.enableCleartextPlugin, false);
  assert.equal(options.dateStrings, true);
  assert.equal(options.jsonStrings, true);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.verifyIdentity, true);
  assert.equal(options.ssl.minVersion, 'TLSv1.2');
  assert.equal(calls[0].statement, 'START TRANSACTION READ ONLY');
  assert.equal(calls[1].statement.sql, query.statement);
  assert.equal(calls[1].statement.timeout, limits.timeoutMs);
  assert.deepEqual(calls[1].values, query.parameters);
  assert.equal(rolledBack, true);
  assert.equal(ended, true);
  assert.equal(destroyed, false);
});

test('MySQL/MariaDB adapter falls back for MySQL 5.5 read-only transaction syntax', async () => {
  const calls = [];
  let rolledBack = false;
  const connection = {
    async query(statement) {
      calls.push(statement);
      if (statement === 'START TRANSACTION READ ONLY') {
        const error = new Error('synthetic parse failure');
        error.code = 'ER_PARSE_ERROR';
        error.errno = 1064;
        throw error;
      }
      if (statement === 'START TRANSACTION') return [[], []];
      return [[{ value: 1 }], []];
    },
    async rollback() {
      rolledBack = true;
    },
    async end() {},
    destroy() {},
  };
  const adapter = new MysqlMariadbReadOnlyAdapter(async () => connection);

  const rows = await adapter.execute(
    target({ tlsMode: 'DISABLED' }),
    Buffer.from('synthetic-database-credential'),
    prepareReadOnlyQuery('MYSQL_MARIADB', { sql: 'SELECT 1 AS value' }, limits),
    new globalThis.AbortController().signal,
  );

  assert.deepEqual(rows, [{ value: 1 }]);
  assert.equal(calls[0], 'START TRANSACTION READ ONLY');
  assert.equal(calls[1], 'START TRANSACTION');
  assert.equal(typeof calls[2], 'object');
  assert.equal(rolledBack, true);
});

test('MySQL/MariaDB adapter does not hide non-syntax read-only transaction failures', async () => {
  const connection = {
    async query(statement) {
      if (statement === 'START TRANSACTION READ ONLY') {
        const error = new Error('synthetic permission failure');
        error.code = 'ER_ACCESS_DENIED_ERROR';
        error.errno = 1045;
        throw error;
      }
      return [[], []];
    },
    async rollback() {},
    async end() {},
    destroy() {},
  };
  const adapter = new MysqlMariadbReadOnlyAdapter(async () => connection);

  await assert.rejects(
    adapter.execute(
      target({ tlsMode: 'DISABLED' }),
      Buffer.from('synthetic-database-credential'),
      prepareReadOnlyQuery('MYSQL_MARIADB', { sql: 'SELECT 1 AS value' }, limits),
      new globalThis.AbortController().signal,
    ),
    (error) => error instanceof DatabaseQueryError && error.code === 'QUERY_FAILED',
  );
});

test('MySQL/MariaDB adapter omits TLS only for the explicit disabled policy', async () => {
  let options;
  const connection = {
    async query(statement) {
      return typeof statement === 'string' ? [[], []] : [[{ value: 1 }], []];
    },
    async rollback() {},
    async end() {},
    destroy() {},
  };
  const adapter = new MysqlMariadbReadOnlyAdapter(async (value) => {
    options = value;
    return connection;
  });

  await adapter.execute(
    target({ tlsMode: 'DISABLED' }),
    Buffer.from('synthetic-database-credential'),
    prepareReadOnlyQuery('MYSQL_MARIADB', { sql: 'SELECT 1 AS value' }, limits),
    new globalThis.AbortController().signal,
  );

  assert.equal(options.ssl, undefined);
});

test('PostgreSQL adapter uses hostname verification with the approved numeric address and read-only transaction', async () => {
  let options;
  const calls = [];
  let connected = false;
  let ended = false;

  const adapter = new PostgresqlReadOnlyAdapter((value) => {
    options = value;
    return {
      async connect() {
        connected = true;
      },
      async query(statement) {
        calls.push(statement);
        if (typeof statement === 'string') return { rows: [] };
        return { rows: [{ linkedid: 'call-2', billsec: 30 }] };
      },
      async end() {
        ended = true;
      },
    };
  });

  const query = prepareReadOnlyQuery(
    'POSTGRESQL',
    { sql: 'SELECT linkedid, billsec FROM cdr WHERE disposition = ?', parameters: ['ANSWERED'] },
    limits,
  );
  const rows = await adapter.execute(
    target({ port: 5432 }),
    Buffer.from('synthetic-database-credential'),
    query,
    new globalThis.AbortController().signal,
  );

  assert.deepEqual(rows, [{ linkedid: 'call-2', billsec: 30 }]);
  assert.equal(connected, true);
  assert.equal(ended, true);
  assert.equal(options.host, '10.10.10.5');
  assert.equal(options.port, 5432);
  assert.equal(options.user, 'readonly_monitor');
  assert.equal(options.database, 'pbx_reporting');
  assert.equal(options.password, 'synthetic-database-credential');
  assert.equal(options.query_timeout, limits.timeoutMs);
  assert.equal(options.statement_timeout, limits.timeoutMs);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, 'db.example.test');
  assert.equal(calls[0], 'BEGIN READ ONLY');
  assert.equal(calls[1].text, query.statement);
  assert.deepEqual(calls[1].values, query.parameters);
  assert.equal(calls[2], 'ROLLBACK');
});

test('dialect adapters map connection failures to bounded errors without driver details', async () => {
  const mysql = new MysqlMariadbReadOnlyAdapter(async () => {
    throw new Error('private mysql driver detail');
  });
  await assert.rejects(
    mysql.execute(
      target(),
      Buffer.from('synthetic-database-credential'),
      prepareReadOnlyQuery('MYSQL_MARIADB', { sql: 'SELECT 1 AS value' }, limits),
      new globalThis.AbortController().signal,
    ),
    (error) =>
      error instanceof DatabaseQueryError &&
      error.code === 'CONNECTION_FAILED' &&
      !error.message.includes('private mysql driver detail'),
  );

  const postgres = new PostgresqlReadOnlyAdapter(() => ({
    async connect() {
      throw new Error('private postgres driver detail');
    },
    async query() {
      return { rows: [] };
    },
    async end() {},
  }));
  await assert.rejects(
    postgres.execute(
      target({ port: 5432 }),
      Buffer.from('synthetic-database-credential'),
      prepareReadOnlyQuery('POSTGRESQL', { sql: 'SELECT 1 AS value' }, limits),
      new globalThis.AbortController().signal,
    ),
    (error) =>
      error instanceof DatabaseQueryError &&
      error.code === 'CONNECTION_FAILED' &&
      !error.message.includes('private postgres driver detail'),
  );
});

test('MySQL/MariaDB adapter classifies common connection failures without exposing raw details', async () => {
  const cases = [
    ['ER_ACCESS_DENIED_ERROR', 1045, 'AUTHENTICATION_FAILED'],
    ['ER_BAD_DB_ERROR', 1049, 'DATABASE_NOT_FOUND'],
    ['ER_HOST_IS_BLOCKED', 1129, 'HOST_BLOCKED'],
  ];
  for (const [code, errno, expected] of cases) {
    const adapter = new MysqlMariadbReadOnlyAdapter(async () => {
      const error = new Error('synthetic private driver detail');
      error.code = code;
      error.errno = errno;
      throw error;
    });
    await assert.rejects(
      adapter.execute(
        target({ tlsMode: 'DISABLED' }),
        Buffer.from('synthetic-database-credential'),
        prepareReadOnlyQuery('MYSQL_MARIADB', { sql: 'SELECT 1 AS value' }, limits),
        new globalThis.AbortController().signal,
      ),
      (error) =>
        error instanceof DatabaseQueryError &&
        error.code === expected &&
        !error.message.includes('synthetic private driver detail'),
    );
  }
});
