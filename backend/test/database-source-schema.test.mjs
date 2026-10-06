import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import {
  AsteriskConventionalSqlHistoryAdapter,
  HistoricalSourceSchemaError,
} from '../dist/database/source-schema.js';

const PBX_ID = '99999999-9999-4999-8999-999999999999';
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/asterisk-history-source.json', import.meta.url), 'utf8'),
);

function configuration(overrides = {}) {
  return {
    pbxInstanceId: PBX_ID,
    dialect: 'MYSQL_MARIADB',
    host: 'db.example.test',
    port: 3306,
    databaseName: 'pbx_reporting',
    username: 'readonly_monitor',
    accessMode: 'READ_ONLY',
    tlsMode: 'REQUIRED',
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    hasCredential: true,
    ...overrides,
  };
}

function result(rows) {
  return { rows, rowCount: rows.length };
}

function fakeTransport({
  schemaRows = fixture.schemaRows,
  callRows = fixture.callRows,
  celRows = fixture.celRows,
  queueRows = fixture.queueRows,
} = {}) {
  const calls = [];
  return {
    calls,
    async query(pbxInstanceId, request, limits) {
      calls.push({ pbxInstanceId, request, limits });
      if (request.sql.includes('information_schema.columns')) return result(schemaRows);
      if (request.sql.includes(' AS record_id')) return result(callRows);
      if (request.sql.includes(' AS extension')) return result(celRows);
      if (request.sql.includes(' AS queue_id')) return result(queueRows);
      throw new Error('unexpected synthetic query');
    },
  };
}

function adapterFor(config, transport) {
  return new AsteriskConventionalSqlHistoryAdapter({
    configuration: { get: () => config },
    transport,
  });
}

test('Asterisk conventional schema inspection and row normalization are provider-neutral', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);

  const capabilities = await adapter.inspect(PBX_ID);
  assert.deepEqual(capabilities, {
    instanceId: PBX_ID,
    source: 'DATABASE',
    adapter: 'ASTERISK_CONVENTIONAL_SQL_V1',
    calls: { availability: 'SUPPORTED' },
    callEvents: { availability: 'SUPPORTED' },
    queueEvents: { availability: 'SUPPORTED' },
  });

  const calls = await adapter.listRecentCalls(PBX_ID, 50);
  assert.deepEqual(calls, [
    {
      instanceId: PBX_ID,
      source: 'DATABASE',
      recordId: 'synthetic-cdr-1',
      correlationId: 'synthetic-call-1',
      sourceStartedAt: '2026-10-06 10:00:00',
      sourceNumber: '1001',
      destinationNumber: '2002',
      durationSeconds: 42,
      billableSeconds: 35,
      disposition: 'ANSWERED',
    },
    {
      instanceId: PBX_ID,
      source: 'DATABASE',
      recordId: 'synthetic-cdr-2',
      correlationId: 'synthetic-call-2',
      sourceStartedAt: '2026-10-06 09:55:00',
      sourceNumber: '1002',
      destinationNumber: '2003',
      durationSeconds: 15,
      billableSeconds: 0,
      disposition: 'NO_ANSWER',
    },
  ]);

  const callEvents = await adapter.listRecentCallEvents(PBX_ID, 25);
  assert.equal(callEvents[0].eventType, 'ANSWERED');
  assert.equal(callEvents[1].eventType, 'HUNG_UP');
  assert.equal(callEvents[0].callerNumber, '1001');

  const queueEvents = await adapter.listRecentQueueEvents(PBX_ID, 25);
  assert.equal(queueEvents[0].eventType, 'ENTERED');
  assert.ok(!('agentId' in queueEvents[0]));
  assert.equal(queueEvents[1].eventType, 'CONNECTED');
  assert.equal(queueEvents[1].agentId, 'Local/1001');

  const inspection = transport.calls[0];
  assert.equal(inspection.pbxInstanceId, PBX_ID);
  assert.deepEqual(inspection.request.parameters, ['pbx_reporting', 'cdr', 'cel', 'queue_log']);
  assert.equal(transport.calls.at(-1).limits.maxRows, 25);
});

test('schema discovery distinguishes missing, mismatched and ambiguous datasets', async () => {
  const base = fixture.schemaRows
    .map((row) => ({ ...row, table_schema: 'public' }))
    .filter((row) => !(row.table_name === 'cdr' && row.column_name === 'billsec'))
    .filter((row) => row.table_name !== 'queue_log');
  const secondCel = base
    .filter((row) => row.table_name === 'cel')
    .map((row) => ({ ...row, table_schema: 'tenant_two' }));
  const transport = fakeTransport({ schemaRows: [...base, ...secondCel] });
  const adapter = adapterFor(configuration({ dialect: 'POSTGRESQL', port: 5432 }), transport);

  const capabilities = await adapter.inspect(PBX_ID);
  assert.equal(capabilities.calls.availability, 'SCHEMA_MISMATCH');
  assert.equal(capabilities.callEvents.availability, 'AMBIGUOUS');
  assert.equal(capabilities.queueEvents.availability, 'NOT_FOUND');

  const inspection = transport.calls[0];
  assert.match(inspection.request.sql, /table_catalog = \?/u);
  assert.deepEqual(inspection.request.parameters, [
    'pbx_reporting',
    'cdr',
    'cel',
    'queue_log',
    'pg_catalog',
    'information_schema',
  ]);

  await assert.rejects(
    adapter.listRecentCalls(PBX_ID),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'DATASET_UNAVAILABLE',
  );
});

test('PostgreSQL source queries preserve the discovered schema and cast source values to text', async () => {
  const schemaRows = fixture.schemaRows.map((row) => ({
    ...row,
    table_schema: 'public',
  }));
  const transport = fakeTransport({ schemaRows });
  const adapter = adapterFor(configuration({ dialect: 'POSTGRESQL', port: 5432 }), transport);

  await adapter.listRecentCalls(PBX_ID, 10);
  const dataQuery = transport.calls.find((entry) => entry.request.sql.includes(' AS record_id'));
  assert.ok(dataQuery);
  assert.match(dataQuery.request.sql, /FROM "public"\."cdr"/u);
  assert.match(dataQuery.request.sql, /CAST\("calldate" AS TEXT\)/u);
  assert.doesNotMatch(dataQuery.request.sql, /pbx_reporting\.cdr/u);
});

test('source row validation fails closed and does not forward malformed history', async () => {
  const transport = fakeTransport({
    callRows: [
      {
        ...fixture.callRows[0],
        duration_seconds: '-1',
      },
    ],
  });
  const adapter = adapterFor(configuration(), transport);

  await assert.rejects(
    adapter.listRecentCalls(PBX_ID),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_SOURCE_ROW',
  );
});

test('invalid caller limits are rejected before schema or network work', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);

  await assert.rejects(
    adapter.listRecentCalls(PBX_ID, 0),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_LIMIT',
  );
  assert.equal(transport.calls.length, 0);
});

test('missing database-source configuration fails before transport work', async () => {
  const transport = fakeTransport();
  const adapter = new AsteriskConventionalSqlHistoryAdapter({
    configuration: { get: () => undefined },
    transport,
  });

  await assert.rejects(
    adapter.inspect(PBX_ID),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'NOT_CONFIGURED',
  );
  assert.equal(transport.calls.length, 0);
});
