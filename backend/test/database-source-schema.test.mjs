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
  queueCatalogRows = [{ queue_id: 'sales' }, { queue_id: 'support' }],
  queueCallerRows = [
    { queue_id: 'support', caller_id: 'caller-a', caller_calls: '2' },
    { queue_id: 'support', caller_id: 'caller-b', caller_calls: '1' },
    { queue_id: 'support', caller_id: 'caller-c', caller_calls: '1' },
    { queue_id: 'sales', caller_id: 'caller-a', caller_calls: '1' },
    { queue_id: 'sales', caller_id: 'caller-d', caller_calls: '2' },
  ],
  queueDetailEntryRows = [
    {
      entered_at: '2026-10-07 10:05:00',
      call_id: 'detail-call-1',
      queue_id: 'support',
      caller_number: '1001',
      initial_position: '2',
    },
    {
      entered_at: '2026-10-07 10:10:00',
      call_id: 'detail-call-2',
      queue_id: 'support',
      caller_number: '1002',
      initial_position: '3',
    },
  ],
  queueDetailOutcomeRows = [
    {
      source_occurred_at: '2026-10-07 10:05:12',
      call_id: 'detail-call-1',
      queue_id: 'support',
      event_type: 'CONNECT',
      agent_id: 'Local/1001',
      data1_value: '12',
      data2_value: '',
      data3_value: '',
      data4_value: null,
    },
    {
      source_occurred_at: '2026-10-07 10:07:12',
      call_id: 'detail-call-1',
      queue_id: 'support',
      event_type: 'COMPLETEAGENT',
      agent_id: 'Local/1001',
      data1_value: '12',
      data2_value: '120',
      data3_value: '2',
      data4_value: null,
    },
    {
      source_occurred_at: '2026-10-07 10:10:45',
      call_id: 'detail-call-2',
      queue_id: 'support',
      event_type: 'ABANDON',
      agent_id: 'NONE',
      data1_value: '',
      data2_value: '',
      data3_value: '45',
      data4_value: null,
    },
  ],
  queuePerformanceCountRows = [
    { queue_id: 'support', event_type: 'ENTERQUEUE', event_count: '20' },
    { queue_id: 'support', event_type: 'CONNECT', event_count: '14' },
    { queue_id: 'support', event_type: 'ABANDON', event_count: '4' },
    { queue_id: 'support', event_type: 'EXITWITHTIMEOUT', event_count: '1' },
    { queue_id: 'support', event_type: 'EXITWITHKEY', event_count: '1' },
    { queue_id: 'support', event_type: 'RINGNOANSWER', event_count: '3' },
    { queue_id: 'support', event_type: 'RINGCANCELED', event_count: '1' },
    { queue_id: 'sales', event_type: 'ENTERQUEUE', event_count: '10' },
    { queue_id: 'sales', event_type: 'CONNECT', event_count: '8' },
    { queue_id: 'sales', event_type: 'ABANDON', event_count: '1' },
    { queue_id: 'sales', event_type: 'EXITEMPTY', event_count: '1' },
    { queue_id: 'sales', event_type: 'RINGNOANSWER', event_count: '2' },
  ],
  queuePerformanceTimingRows = {
    CONNECT: [
      { queue_id: 'support', wait_sum_seconds: '140', wait_samples: '14' },
      { queue_id: 'sales', wait_sum_seconds: '80', wait_samples: '8' },
    ],
    ABANDON: [
      { queue_id: 'support', wait_sum_seconds: '300', wait_samples: '4' },
      { queue_id: 'sales', wait_sum_seconds: '50', wait_samples: '1' },
    ],
    EXITWITHTIMEOUT: [{ queue_id: 'support', wait_sum_seconds: '80', wait_samples: '1' }],
    EXITWITHKEY: [{ queue_id: 'support', wait_sum_seconds: '80', wait_samples: '1' }],
    EXITEMPTY: [{ queue_id: 'sales', wait_sum_seconds: '70', wait_samples: '1' }],
  },
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
      if (request.sql.includes(' AS bounded_row_count')) {
        const isEntry = request.parameters.includes('ENTERQUEUE');
        if (!isEntry) return result([{ bounded_row_count: String(queueDetailOutcomeRows.length) }]);
        const isDetailWindow = request.parameters.some(
          (value) => typeof value === 'string' && value.includes('2026-10-07 11:00:00'),
        );
        return result([
          {
            bounded_row_count: String(
              isDetailWindow
                ? queueDetailEntryRows.length
                : queueCallerRows.reduce((total, row) => total + Number(row.caller_calls ?? 1), 0),
            ),
          },
        ]);
      }
      if (request.sql.includes('COUNT(*) AS total_calls')) return result(outcomeRows);
      if (request.sql.includes('SELECT DISTINCT') && request.sql.includes(' AS queue_id'))
        return result(queueCatalogRows);
      if (request.sql.includes(' AS entered_at')) return result(queueDetailEntryRows);
      if (request.sql.includes(' AS data1_value')) return result(queueDetailOutcomeRows);
      if (request.sql.includes(' AS caller_id')) return result(queueCallerRows);
      if (request.sql.includes(' AS event_count')) return result(queuePerformanceCountRows);
      if (request.sql.includes(' AS wait_sum_seconds')) {
        const eventName = request.parameters.at(-3);
        return result(queuePerformanceTimingRows[eventName] ?? []);
      }
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
    queuePerformance: { availability: 'SUPPORTED' },
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
  assert.match(
    aggregate.request.sql,
    /`event` IN \('ENTERQUEUE', 'CONNECT', 'ABANDON', 'EXITWITHTIMEOUT'\)/u,
  );
  assert.doesNotMatch(aggregate.request.sql, /UPPER\(TRIM\(CAST\(`event` AS CHAR\)\)\)/u);
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

test('queue catalog is source-backed, distinct and bounded', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);
  assert.deepEqual(await adapter.listQueueIds(PBX_ID), ['sales', 'support']);
  const query = transport.calls.find(
    (entry) =>
      entry.request.sql.includes('SELECT DISTINCT') && entry.request.sql.includes(' AS queue_id'),
  );
  assert.ok(query);
  assert.match(query.request.sql, /ORDER BY `queuename`/u);
  assert.equal(query.limits.maxRows, 200);
});

test('queue performance report aggregates multiple queues with exact source-side totals', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);
  const report = await adapter.queuePerformanceReport(PBX_ID, ['support', 'sales'], FROM, TO);

  assert.equal(report.aggregationMode, 'SOURCE_AGGREGATE_CHUNKED');
  assert.equal(report.chunkCount, 1);
  assert.deepEqual(report.queueIds, ['support', 'sales']);
  assert.equal(report.queues.length, 2);
  assert.equal(report.queues[0].queueId, 'support');
  assert.equal(report.queues[0].enteredCalls, 20);
  assert.equal(report.queues[0].answeredCalls, 14);
  assert.equal(report.queues[0].unansweredCalls, 6);
  assert.equal(report.queues[0].confirmedLostCalls, 6);
  assert.equal(report.queues[0].callerAbandonedCalls, 4);
  assert.equal(report.queues[0].timedOutCalls, 1);
  assert.equal(report.queues[0].exitWithKeyCalls, 1);
  assert.equal(report.queues[0].ringNoAnswerAttempts, 3);
  assert.equal(report.queues[0].averageAnswerSeconds, 10);
  assert.equal(report.queues[0].averageWaitSeconds, 30);
  assert.equal(report.queues[0].incomingSharePercent, (20 / 30) * 100);
  assert.equal(report.queues[0].answerRatePercent, 70);
  assert.equal(report.queues[0].uniqueCallers, 3);
  assert.equal(report.queues[0].repeatCallers, 1);
  assert.ok(Math.abs(report.queues[0].repeatCallerRatePercent - 100 / 3) < 1e-9);
  assert.equal(report.queues[0].averageCallsPerCaller, 4 / 3);
  assert.equal(report.queues[0].callsFromRepeatCallers, 2);
  assert.equal(report.queues[0].repeatCallSharePercent, 50);
  assert.equal(report.queues[0].callerIdentificationRatePercent, 20);
  assert.equal(report.total.enteredCalls, 30);
  assert.equal(report.total.answeredCalls, 22);
  assert.equal(report.total.unansweredCalls, 8);
  assert.equal(report.total.confirmedLostCalls, 8);
  assert.equal(report.total.incomingSharePercent, 100);
  assert.equal(report.total.averageAnswerSeconds, 10);
  assert.equal(report.total.averageWaitSeconds, 800 / 30);
  assert.equal(report.total.uniqueCallers, 4);
  assert.equal(report.total.repeatCallers, 2);
  assert.equal(report.total.repeatCallerRatePercent, 50);
  const callerRowsQuery = transport.calls.find((entry) =>
    entry.request.sql.includes(' AS caller_calls'),
  );
  assert.ok(callerRowsQuery);
  assert.match(callerRowsQuery.request.sql, /GROUP BY `queuename`, `data2`/u);
  assert.match(callerRowsQuery.request.sql, /COUNT\(\*\) AS caller_calls/u);
  assert.doesNotMatch(callerRowsQuery.request.sql, /ORDER BY `queuename`, `event`, `time`/u);
  assert.equal(report.total.averageCallsPerCaller, 7 / 4);
  assert.equal(report.total.callsFromRepeatCallers, 5);
  assert.equal(report.total.repeatCallSharePercent, (5 / 7) * 100);
  assert.equal(report.total.callerIdentificationRatePercent, (7 / 30) * 100);
  const callerQuery = transport.calls.find((entry) => entry.request.sql.includes(' AS caller_id'));
  assert.ok(callerQuery);
  assert.doesNotMatch(callerQuery.request.sql, /LIMIT/u);
  assert.equal(callerQuery.limits.maxRows, 1000);
  const callerCountQuery = transport.calls.find(
    (entry) =>
      entry.request.sql.includes(' AS bounded_row_count') &&
      entry.request.parameters.includes('ENTERQUEUE'),
  );
  assert.ok(callerCountQuery);
  assert.equal(callerCountQuery.limits.maxRows, 1);

  const countQuery = transport.calls.find((entry) => entry.request.sql.includes(' AS event_count'));
  assert.ok(countQuery);
  assert.match(countQuery.request.sql, /GROUP BY `queuename`, `event`/u);
  assert.match(countQuery.request.sql, /`queuename` IN \(\?, \?\)/u);
  assert.doesNotMatch(countQuery.request.sql, /UPPER\(TRIM\(CAST\(`event` AS CHAR\)\)\)/u);
  assert.deepEqual(countQuery.request.parameters.slice(0, 4), [
    'support',
    'sales',
    '2026-10-07 10:00:00',
    '2026-10-08 10:00:00',
  ]);
  assert.equal(countQuery.limits.maxRows, 20);
  const connectTiming = transport.calls.find(
    (entry) =>
      entry.request.sql.includes(' AS wait_sum_seconds') &&
      entry.request.parameters.includes('CONNECT'),
  );
  assert.ok(connectTiming);
  assert.match(connectTiming.request.sql, /`event` = \?/u);
  assert.equal(connectTiming.limits.maxRows, 2);
});

test('queue performance report chunks long windows without a raw-row sampling limit', async () => {
  const transport = fakeTransport({
    queueCallerRows: [{ queue_id: 'support', caller_id: 'caller-a', caller_calls: '2' }],
    queuePerformanceCountRows: [
      { queue_id: 'support', event_type: 'ENTERQUEUE', event_count: '2' },
      { queue_id: 'support', event_type: 'CONNECT', event_count: '1' },
      { queue_id: 'support', event_type: 'ABANDON', event_count: '1' },
      { queue_id: 'support', event_type: 'RINGNOANSWER', event_count: '1' },
    ],
    queuePerformanceTimingRows: {
      CONNECT: [{ queue_id: 'support', wait_sum_seconds: '5', wait_samples: '1' }],
      ABANDON: [{ queue_id: 'support', wait_sum_seconds: '10', wait_samples: '1' }],
    },
  });
  const adapter = adapterFor(configuration(), transport);
  const report = await adapter.queuePerformanceReport(
    PBX_ID,
    ['support'],
    '2026-09-01T00:00',
    '2026-09-16T00:00',
  );
  assert.equal(report.chunkCount, 15);
  assert.equal(report.total.enteredCalls, 30);
  assert.equal(report.total.answeredCalls, 15);
  assert.equal(report.total.confirmedLostCalls, 15);
  const queries = transport.calls.filter((entry) => entry.request.sql.includes(' AS event_count'));
  assert.equal(queries.length, 15);
  assert.match(queries[0].request.sql, /`time` < \?/u);
  assert.match(queries[1].request.sql, /`time` < \?/u);
  assert.match(queries[14].request.sql, /`time` <= \?/u);
  assert.deepEqual(queries[0].request.parameters.slice(0, 3), [
    'support',
    '2026-09-01 00:00:00',
    '2026-09-02 00:00:00',
  ]);
  assert.deepEqual(queries[14].request.parameters.slice(0, 3), [
    'support',
    '2026-09-15 00:00:00',
    '2026-09-16 00:00:00',
  ]);
  const timingQueries = transport.calls.filter((entry) =>
    entry.request.sql.includes(' AS wait_sum_seconds'),
  );
  assert.equal(timingQueries.length, 30);
  await assert.rejects(
    adapter.queuePerformanceReport(PBX_ID, ['support'], '2026-01-01T00:00', '2026-04-02T00:00'),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_RANGE',
  );
});

test('queue performance detail chunk returns one normalized row per queue entry', async () => {
  const transport = fakeTransport();
  const adapter = adapterFor(configuration(), transport);
  const detail = await adapter.queuePerformanceDetailChunk(
    PBX_ID,
    ['support'],
    '2026-10-07T10:00',
    '2026-10-07T11:00',
    '2026-10-08T10:00',
  );
  assert.equal(detail.items.length, 2);
  assert.deepEqual(detail.items[0], {
    queueId: 'support',
    callId: 'detail-call-1',
    callerNumber: '1001',
    enteredAt: '2026-10-07 10:05:00',
    initialPosition: 2,
    outcome: 'ANSWERED',
    agentId: 'Local/1001',
    connectedAt: '2026-10-07 10:05:12',
    completedAt: '2026-10-07 10:07:12',
    waitSeconds: 12,
    talkSeconds: 120,
  });
  assert.deepEqual(detail.items[1], {
    queueId: 'support',
    callId: 'detail-call-2',
    callerNumber: '1002',
    enteredAt: '2026-10-07 10:10:00',
    initialPosition: 3,
    outcome: 'CALLER_ABANDONED',
    outcomeAt: '2026-10-07 10:10:45',
    waitSeconds: 45,
  });
  const entryQuery = transport.calls.find((entry) => entry.request.sql.includes(' AS entered_at'));
  const outcomeQuery = transport.calls.find((entry) =>
    entry.request.sql.includes(' AS data1_value'),
  );
  assert.ok(entryQuery);
  assert.ok(outcomeQuery);
  assert.doesNotMatch(entryQuery.request.sql, /LIMIT/u);
  assert.doesNotMatch(outcomeQuery.request.sql, /LIMIT/u);
  assert.equal(entryQuery.limits.maxRows, 1000);
  assert.equal(outcomeQuery.limits.maxRows, 1000);
  const detailCountQueries = transport.calls.filter((entry) =>
    entry.request.sql.includes(' AS bounded_row_count'),
  );
  assert.ok(detailCountQueries.length >= 2);
  assert.ok(detailCountQueries.every((entry) => entry.limits.maxRows === 1));
  assert.deepEqual(outcomeQuery.request.parameters.slice(-2), [
    '2026-10-07 10:00:00',
    '2026-10-08 10:00:00',
  ]);
});

test('queue performance report validates bounded unique queue selection', async () => {
  const adapter = adapterFor(configuration(), fakeTransport());
  await assert.rejects(
    adapter.queuePerformanceReport(PBX_ID, [], FROM, TO),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_QUEUE',
  );
  await assert.rejects(
    adapter.queuePerformanceReport(PBX_ID, ['support', 'support'], FROM, TO),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_QUEUE',
  );
  await assert.rejects(
    adapter.queuePerformanceReport(
      PBX_ID,
      Array.from({ length: 17 }, (_, index) => `queue-${index}`),
      FROM,
      TO,
    ),
    (error) => error instanceof HistoricalSourceSchemaError && error.code === 'INVALID_QUEUE',
  );
});

test('PostgreSQL queue analytics keep normalized event comparison semantics', async () => {
  const schemaRows = fixture.schemaRows.map((row) => ({ ...row, table_schema: 'public' }));
  const transport = fakeTransport({ schemaRows });
  const adapter = adapterFor(
    configuration({ dialect: 'POSTGRESQL', port: 5432, databaseScopes: ['public'] }),
    transport,
  );
  await adapter.queueAbandonmentAnalytics(PBX_ID, 'support', FROM, TO, 1);
  const aggregate = transport.calls.find((entry) =>
    entry.request.sql.includes(' AS entered_calls'),
  );
  assert.ok(aggregate);
  assert.match(aggregate.request.sql, /UPPER\(TRIM\(CAST\("event" AS TEXT\)\)\)/u);
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
  assert.equal(capabilities.queuePerformance.availability, 'SUPPORTED');
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
  assert.equal(capabilities.queuePerformance.availability, 'NOT_FOUND');

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
  assert.equal(capabilities.queuePerformance.availability, 'SUPPORTED');
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
