import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { DatabaseQueryError } from '../dist/database/query.js';
import { ReadOnlyDatabaseTransport } from '../dist/database/transport.js';
import { DatabaseConnectionBackoff } from '../dist/database/backoff.js';

const PBX_ID = 'synthetic-pbx';

function safeConfig(overrides = {}) {
  return {
    pbxInstanceId: PBX_ID,
    dialect: 'MYSQL_MARIADB',
    host: 'db.example.test',
    port: 3306,
    databaseName: 'pbx_reporting',
    username: 'readonly_monitor',
    accessMode: 'READ_ONLY',
    tlsMode: 'REQUIRED',
    hasCredential: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function fixture({ config = safeConfig(), addresses = ['10.10.10.5'], rows = [{ id: '1' }] } = {}) {
  let resolutions = 0;
  let executions = 0;
  let seenTarget;
  let seenQuery;
  let seenSignal;
  const credential = Buffer.from('synthetic-database-credential');

  const adapter = {
    async execute(target, suppliedCredential, query, signal) {
      executions += 1;
      seenTarget = target;
      seenQuery = query;
      seenSignal = signal;
      assert.equal(suppliedCredential.toString(), 'synthetic-database-credential');
      return rows;
    },
  };

  const transport = new ReadOnlyDatabaseTransport({
    configuration: { get: () => config },
    secrets: {
      getSecret(_id, name) {
        return name === 'database-password' ? credential : undefined;
      },
    },
    resolver: {
      async resolve() {
        resolutions += 1;
        return addresses;
      },
    },
    adapters: { MYSQL_MARIADB: adapter },
  });

  return {
    transport,
    credential,
    adapter,
    get resolutions() {
      return resolutions;
    },
    get executions() {
      return executions;
    },
    get target() {
      return seenTarget;
    },
    get query() {
      return seenQuery;
    },
    get signal() {
      return seenSignal;
    },
  };
}

test('database transport resolves once, validates the numeric address and preserves explicit TLS policy', async () => {
  const value = fixture();
  const result = await value.transport.query(
    PBX_ID,
    { sql: 'SELECT linkedid FROM cdr WHERE disposition = ?', parameters: ['ANSWERED'] },
    { timeoutMs: 1000, maxRows: 10, maxOutputBytes: 4096 },
  );

  assert.deepEqual(result, { rows: [{ id: '1' }], rowCount: 1 });
  assert.equal(value.resolutions, 1);
  assert.equal(value.executions, 1);
  assert.deepEqual(value.target, {
    host: 'db.example.test',
    address: '10.10.10.5',
    port: 3306,
    databaseName: 'pbx_reporting',
    username: 'readonly_monitor',
    tlsMode: 'REQUIRED',
  });
  assert.match(value.query.statement, /^SELECT linkedid FROM cdr/u);
  assert.deepEqual(value.query.parameters, ['ANSWERED', 10]);
  assert.equal(value.signal.aborted, true);
  assert.ok(value.credential.every((byte) => byte === 0));
});

test('database transport skips DNS for a literal address and passes an explicit disabled TLS exception', async () => {
  const value = fixture({
    config: safeConfig({ host: '10.20.30.40', tlsMode: 'DISABLED' }),
  });
  await value.transport.query(PBX_ID, { sql: 'SELECT 1 AS value' });

  assert.equal(value.resolutions, 0);
  assert.equal(value.target.address, '10.20.30.40');
  assert.equal(value.target.tlsMode, 'DISABLED');
});

test('database transport rejects unsafe resolved targets before any dialect adapter executes', async () => {
  const value = fixture({ addresses: ['127.0.0.1'] });
  await assert.rejects(
    value.transport.query(PBX_ID, { sql: 'SELECT 1 AS value' }),
    (error) => error instanceof DatabaseQueryError && error.code === 'CONNECTION_FAILED',
  );
  assert.equal(value.resolutions, 1);
  assert.equal(value.executions, 0);
  assert.ok(value.credential.every((byte) => byte === 0));
});

test('database transport bounds address resolution within the same operation timeout', async () => {
  const credential = Buffer.from('synthetic-resolution-credential');
  const transport = new ReadOnlyDatabaseTransport({
    configuration: { get: () => safeConfig() },
    secrets: { getSecret: () => credential },
    resolver: {
      resolve() {
        return new Promise(() => {});
      },
    },
    adapters: {
      MYSQL_MARIADB: {
        async execute() {
          throw new Error('adapter must not run before resolution');
        },
      },
    },
  });

  await assert.rejects(
    transport.query(
      PBX_ID,
      { sql: 'SELECT 1 AS value' },
      { timeoutMs: 20, maxRows: 2, maxOutputBytes: 1024 },
    ),
    (error) => error instanceof DatabaseQueryError && error.code === 'TIMEOUT',
  );
  assert.ok(credential.every((byte) => byte === 0));
});

test('database transport enforces row and output limits after the server-side row cap', async () => {
  const rowLimited = fixture({ rows: [{ id: '1' }, { id: '2' }, { id: '3' }] });
  await assert.rejects(
    rowLimited.transport.query(
      PBX_ID,
      { sql: 'SELECT id FROM cdr' },
      { timeoutMs: 1000, maxRows: 2, maxOutputBytes: 4096 },
    ),
    (error) => error instanceof DatabaseQueryError && error.code === 'ROW_LIMIT',
  );

  const outputLimited = fixture({ rows: [{ value: 'x'.repeat(1024) }] });
  await assert.rejects(
    outputLimited.transport.query(
      PBX_ID,
      { sql: 'SELECT value FROM cdr' },
      { timeoutMs: 1000, maxRows: 2, maxOutputBytes: 100 },
    ),
    (error) => error instanceof DatabaseQueryError && error.code === 'OUTPUT_LIMIT',
  );
});

test('database transport aborts an uncooperative adapter at the bounded timeout', async () => {
  let aborted = false;
  const credential = Buffer.from('synthetic-timeout-credential');
  const transport = new ReadOnlyDatabaseTransport({
    configuration: { get: () => safeConfig() },
    secrets: { getSecret: () => credential },
    resolver: { resolve: async () => ['10.10.10.5'] },
    adapters: {
      MYSQL_MARIADB: {
        execute(_target, _credential, _query, signal) {
          return new Promise(() => {
            signal.addEventListener(
              'abort',
              () => {
                aborted = true;
              },
              { once: true },
            );
          });
        },
      },
    },
  });

  await assert.rejects(
    transport.query(
      PBX_ID,
      { sql: 'SELECT 1 AS value' },
      { timeoutMs: 20, maxRows: 2, maxOutputBytes: 1024 },
    ),
    (error) => error instanceof DatabaseQueryError && error.code === 'TIMEOUT',
  );
  assert.equal(aborted, true);
  assert.ok(credential.every((byte) => byte === 0));
});

test('database transport fails closed when configuration or credential is unavailable', async () => {
  const missingConfig = new ReadOnlyDatabaseTransport({
    configuration: { get: () => undefined },
    secrets: { getSecret: () => undefined },
    resolver: { resolve: async () => ['10.10.10.5'] },
  });
  await assert.rejects(
    missingConfig.query(PBX_ID, { sql: 'SELECT 1 AS value' }),
    (error) => error instanceof DatabaseQueryError && error.code === 'NOT_CONFIGURED',
  );

  const missingCredential = new ReadOnlyDatabaseTransport({
    configuration: { get: () => safeConfig() },
    secrets: { getSecret: () => undefined },
    resolver: { resolve: async () => ['10.10.10.5'] },
  });
  await assert.rejects(
    missingCredential.query(PBX_ID, { sql: 'SELECT 1 AS value' }),
    (error) => error instanceof DatabaseQueryError && error.code === 'PERMISSION_DENIED',
  );
});

test('database transport suppresses repeated connection attempts during backoff and resets after success', async () => {
  let now = 0;
  const backoff = new DatabaseConnectionBackoff(() => now);
  let attempts = 0;
  const failing = new ReadOnlyDatabaseTransport({
    configuration: { get: () => safeConfig({ host: '10.20.30.40' }) },
    secrets: { getSecret: () => Buffer.from('synthetic-value') },
    resolver: { resolve: async () => ['10.20.30.40'] },
    backoff,
    adapters: {
      MYSQL_MARIADB: {
        async execute() {
          attempts += 1;
          throw new DatabaseQueryError('CONNECTION_FAILED');
        },
      },
    },
  });

  await assert.rejects(
    failing.query(PBX_ID, { sql: 'SELECT 1 AS value' }),
    (error) => error instanceof DatabaseQueryError && error.code === 'CONNECTION_FAILED',
  );
  assert.equal(attempts, 1);
  await assert.rejects(
    failing.query(PBX_ID, { sql: 'SELECT 1 AS value' }),
    (error) => error instanceof DatabaseQueryError && error.code === 'BACKOFF',
  );
  assert.equal(attempts, 1);

  now += 30_000;
  const succeeding = new ReadOnlyDatabaseTransport({
    configuration: { get: () => safeConfig({ host: '10.20.30.40' }) },
    secrets: { getSecret: () => Buffer.from('synthetic-value') },
    resolver: { resolve: async () => ['10.20.30.40'] },
    backoff,
    adapters: { MYSQL_MARIADB: { execute: async () => [{ value: 1 }] } },
  });
  await succeeding.query(PBX_ID, { sql: 'SELECT 1 AS value' });
  assert.equal(backoff.remainingMs(PBX_ID), 0);
});
