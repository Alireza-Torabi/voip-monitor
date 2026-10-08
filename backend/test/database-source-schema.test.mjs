import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import {
  AsteriskConventionalSqlHistoryAdapter,
  HistoricalSourceSchemaError,
} from '../dist/database/source-schema.js';

const PBX_ID = '99999999-9999-4999-8999-999999999999';
const FROM = '2026-10-07T10:00';
const TO = '2026-10-08T10:00';
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
    databaseScopes: ['pbx_reporting'],
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
  queueAnalyticsRows = [
    {
      entered_calls: '20',
      connected_calls: '14',
      abandoned_calls: '4',
      timed_out_calls: '2',
      long_wait_abandoned_calls: '2',
      average_wait_before_abandon_seconds: '37.5',
    },
  ],
  queueWaitRows = [
    { wait_seconds: '10' },
    { wait_seconds: '25' },
    { wait_seconds: '45' },
    { wait_seconds: '70' },
  ],
  outcomeRows = [
    {
      total_calls: '10',
      answered_calls: '6',
      no_answer_calls: '2',
      busy_calls: '1',
      failed_calls: '0',
      average_duration_seconds: '31.5',
    },
  ],
} = {}) {
  const calls = [];
  return {
    calls,
    async query(pbxInstanceId, request, limits) {
      calls.push({ pbxInstanceId, request, limits });
      if (request.sql.includes('information_schema.columns')) return result(schemaRows);
      if (request.sql.includes('COUNT(*) AS total_calls')) return result(outcomeRows);
      if (request.sql.includes(' AS entered_calls')) return result(queueAnalyticsRows);
      if (request.sql.includes(' AS wait_seconds')) return result(queueWaitRows);
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
    queueAbandonment: { availability: 'SUPPORTED' },
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
  assert.deepEqual(inspection.request.parameters, [
    'pbx_reporting',
    'cdr',
    'cel',
    'queue_log',
    'queuelog',
  ]);
  assert.equal(transport.calls.at(-1).limits.maxRows, 25);
});

test('call outcome analytics aggregate directly in the source over an explicit date/time window', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);

  const analytics = await adapter.callOutcomeAnalytics(PBX_ID, FROM, TO);
  assert.deepEqual(analytics, {
    instanceId: PBX_ID,
    source: 'DATABASE',
    from: '2026-10-07T10:00:00',
    to: '2026-10-08T10:00:00',
    totalCalls: 10,
    answeredCalls: 6,
    noAnswerCalls: 2,
    busyCalls: 1,
    failedCalls: 0,
    unknownCalls: 1,
    answerRatioPercent: 60,
    averageDurationSeconds: 31.5,
  });
  const query = transport.calls.find((entry) =>
    entry.request.sql.includes('COUNT(*) AS total_calls'),
  );
  assert.ok(query);
  assert.match(query.request.sql, /WHERE .* >= \? AND .* <= \?/u);
  assert.deepEqual(query.request.parameters, ['2026-10-07 10:00:00', '2026-10-08 10:00:00']);
  assert.equal(query.limits.maxRows, 1);

  await assert.rejects(
    adapter.callOutcomeAnalytics(PBX_ID, 'not-a-date', TO),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_RANGE',
  );
});

test('PostgreSQL call outcome analytics use the explicit source-local date/time window', async () => {
  const schemaRows = fixture.schemaRows.map((row) => ({ ...row, table_schema: 'public' }));
  const transport = fakeTransport({ schemaRows });
  const adapter = adapterFor(
    configuration({ dialect: 'POSTGRESQL', port: 5432, databaseScopes: ['public'] }),
    transport,
  );
  await adapter.callOutcomeAnalytics(PBX_ID, FROM, TO);
  const query = transport.calls.find((entry) =>
    entry.request.sql.includes('COUNT(*) AS total_calls'),
  );
  assert.ok(query);
  assert.match(query.request.sql, /WHERE .* >= \? AND .* <= \?/u);
  assert.deepEqual(query.request.parameters, ['2026-10-07 10:00:00', '2026-10-08 10:00:00']);
});

test('queue abandonment analytics keep caller abandon separate from queue timeout', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);

  const analytics = await adapter.queueAbandonmentAnalytics(PBX_ID, 'support', FROM, TO, 1);
  assert.deepEqual(analytics, {
    instanceId: PBX_ID,
    source: 'DATABASE',
    from: '2026-10-07T10:00:00',
    to: '2026-10-08T10:00:00',
    queueId: 'support',
    longWaitThresholdMinutes: 1,
    enteredCalls: 20,
    connectedCalls: 14,
    abandonedCalls: 4,
    timedOutCalls: 2,
    longWaitAbandonedCalls: 2,
    abandonmentRatePercent: 20,
    averageWaitBeforeAbandonSeconds: 37.5,
    p50WaitBeforeAbandonSeconds: 25,
    p90WaitBeforeAbandonSeconds: 70,
  });

  const aggregate = transport.calls.find((entry) =>
    entry.request.sql.includes(' AS entered_calls'),
  );
  assert.ok(aggregate);
  assert.match(aggregate.request.sql, /ABANDON/u);
  assert.match(aggregate.request.sql, /EXITWITHTIMEOUT/u);
  assert.deepEqual(aggregate.request.parameters, [
    60,
    'support',
    '2026-10-07 10:00:00',
    '2026-10-08 10:00:00',
  ]);
  assert.match(aggregate.request.sql, /AND .* >= \? AND .* <= \?/u);
  assert.equal(aggregate.limits.maxRows, 1);

  const waits = transport.calls.find((entry) => entry.request.sql.includes(' AS wait_seconds'));
  assert.ok(waits);
  assert.deepEqual(waits.request.parameters, [
    'support',
    '2026-10-07 10:00:00',
    '2026-10-08 10:00:00',
  ]);
  assert.equal(waits.limits.maxRows, 4);
});

test('queue abandonment percentiles are omitted rather than sampled when abandon volume exceeds the bound', async () => {
  const transport = fakeTransport({
    queueAnalyticsRows: [
      {
        entered_calls: '1500',
        connected_calls: '400',
        abandoned_calls: '1001',
        timed_out_calls: '99',
        long_wait_abandoned_calls: '500',
        average_wait_before_abandon_seconds: '52.5',
      },
    ],
  });
  const adapter = adapterFor(configuration(), transport);
  const analytics = await adapter.queueAbandonmentAnalytics(PBX_ID, 'support', FROM, TO, 1);
  assert.equal(analytics.abandonedCalls, 1001);
  assert.equal(analytics.averageWaitBeforeAbandonSeconds, 52.5);
  assert.equal('p50WaitBeforeAbandonSeconds' in analytics, false);
  assert.equal('p90WaitBeforeAbandonSeconds' in analytics, false);
  assert.equal(
    transport.calls.some((entry) => entry.request.sql.includes(' AS wait_seconds')),
    false,
  );
});

test('queue abandonment analytics fail closed without wait-time schema and validate inputs', async () => {
  const schemaRows = fixture.schemaRows.filter(
    (row) => !(row.table_name === 'queue_log' && row.column_name === 'data3'),
  );
  const adapter = adapterFor(configuration(), fakeTransport({ schemaRows }));
  const capabilities = await adapter.inspect(PBX_ID);
  assert.equal(capabilities.queueEvents.availability, 'SUPPORTED');
  assert.equal(capabilities.queueAbandonment.availability, 'SCHEMA_MISMATCH');
  await assert.rejects(
    adapter.queueAbandonmentAnalytics(PBX_ID, 'support', FROM, TO, 1),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'DATASET_UNAVAILABLE',
  );

  const valid = adapterFor(configuration(), fakeTransport());
  await assert.rejects(
    valid.queueAbandonmentAnalytics(PBX_ID, '', FROM, TO, 1),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_QUEUE',
  );
  await assert.rejects(
    valid.queueAbandonmentAnalytics(PBX_ID, 'support', FROM, TO, 0),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_THRESHOLD',
  );
});

test('FreePBX queuelog table alias is discovered for queue history and abandonment analytics', async () => {
  const schemaRows = fixture.schemaRows.map((row) =>
    row.table_name === 'queue_log' ? { ...row, table_name: 'queuelog' } : row,
  );
  const adapter = adapterFor(configuration(), fakeTransport({ schemaRows }));
  const capabilities = await adapter.inspect(PBX_ID);
  assert.equal(capabilities.queueEvents.availability, 'SUPPORTED');
  assert.equal(capabilities.queueAbandonment.availability, 'SUPPORTED');
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
  const adapter = adapterFor(
    configuration({ dialect: 'POSTGRESQL', port: 5432, databaseScopes: ['public'] }),
    transport,
  );

  const capabilities = await adapter.inspect(PBX_ID);
  assert.equal(capabilities.calls.availability, 'SCHEMA_MISMATCH');
  assert.equal(capabilities.callEvents.availability, 'AMBIGUOUS');
  assert.equal(capabilities.queueEvents.availability, 'NOT_FOUND');
  assert.equal(capabilities.queueAbandonment.availability, 'NOT_FOUND');

  const inspection = transport.calls[0];
  assert.match(inspection.request.sql, /table_catalog = \?/u);
  assert.deepEqual(inspection.request.parameters, [
    'pbx_reporting',
    'public',
    'cdr',
    'cel',
    'queue_log',
    'queuelog',
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
  const adapter = adapterFor(
    configuration({ dialect: 'POSTGRESQL', port: 5432, databaseScopes: ['public'] }),
    transport,
  );

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

test('MySQL schema discovery is restricted to every configured database scope', async () => {
  const schemaRows = fixture.schemaRows.map((row) => ({
    ...row,
    table_schema: row.table_name === 'cdr' ? 'pbx_reporting' : 'pbx_config',
  }));
  const transport = fakeTransport({ schemaRows });
  const adapter = adapterFor(
    configuration({ databaseScopes: ['pbx_reporting', 'pbx_config'] }),
    transport,
  );

  const capabilities = await adapter.inspect(PBX_ID);
  assert.equal(capabilities.calls.availability, 'SUPPORTED');
  assert.equal(capabilities.callEvents.availability, 'SUPPORTED');
  assert.equal(capabilities.queueEvents.availability, 'SUPPORTED');
  const inspection = transport.calls[0];
  assert.match(inspection.request.sql, /table_schema IN \(\?, \?\)/u);
  assert.deepEqual(inspection.request.parameters, [
    'pbx_reporting',
    'pbx_config',
    'cdr',
    'cel',
    'queue_log',
    'queuelog',
  ]);
  assert.equal(inspection.limits.maxRows, 500);
});
