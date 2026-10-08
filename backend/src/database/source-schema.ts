import { createHmac, randomBytes } from 'node:crypto';
import type {
  HistoricalCallDisposition,
  HistoricalCallOutcomeAnalytics,
  HistoricalReportWindow,
  HistoricalCallEventRecord,
  HistoricalCallEventType,
  HistoricalCallRecord,
  HistoricalDatasetAvailability,
  HistoricalQueueAbandonmentAnalytics,
  HistoricalQueueCallDetail,
  HistoricalQueueCallDetailChunk,
  HistoricalQueueCallOutcome,
  HistoricalQueuePerformanceMetrics,
  HistoricalQueuePerformanceReport,
  HistoricalQueuePerformanceRow,
  HistoricalQueueEventRecord,
  HistoricalQueueEventType,
  HistoricalSourceCapabilities,
  PbxInstanceId,
} from '@voip-monitor/shared';
import type { DatabaseDialect } from '../storage/index.js';
import type { SafeDatabaseSourceConfiguration } from './configuration.js';
import type { DatabaseQueryLimits, DatabaseResultRow, ReadOnlyDatabaseQuery } from './query.js';
import type { DatabaseQueryResult } from './transport.js';

const ADAPTER_ID = 'ASTERISK_CONVENTIONAL_SQL_V1' as const;
const MAX_HISTORY_ROWS = 200;
const HISTORY_OUTPUT_BYTES = 512 * 1024;
const HISTORY_TIMEOUT_MS = 5_000;
const MAX_QUEUE_PERCENTILE_ROWS = 1_000;
const MAX_LONG_WAIT_THRESHOLD_MINUTES = 60;
const MAX_QUEUE_REPORT_QUEUES = 16;
const MAX_QUEUE_CATALOG_ROWS = 200;
const MAX_QUEUE_REPORT_DAYS = 30;
const QUEUE_REPORT_CHUNK_DAYS = 1;
const MAX_ADAPTIVE_SOURCE_ROWS = 1_000;
const MAX_QUEUE_DETAIL_ITEMS_PER_CHUNK = 20_000;
const QUEUE_DETAIL_CHUNK_MAX_MS = 24 * 60 * 60 * 1000;
const QUEUE_DETAIL_OUTCOME_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

const DATASETS = {
  calls: {
    tables: ['cdr'],
    required: ['calldate', 'src', 'dst', 'duration', 'billsec', 'disposition', 'uniqueid'],
    optional: ['linkedid'],
  },
  callEvents: {
    tables: ['cel'],
    required: ['eventtime', 'eventtype', 'uniqueid'],
    optional: ['linkedid', 'exten', 'cid_num'],
  },
  queueEvents: {
    tables: ['queue_log', 'queuelog'],
    required: ['time', 'callid', 'queuename', 'agent', 'event'],
    optional: [],
  },
  queueAbandonment: {
    tables: ['queue_log', 'queuelog'],
    required: ['time', 'callid', 'queuename', 'event', 'data3'],
    optional: [],
  },
  queuePerformance: {
    tables: ['queue_log', 'queuelog'],
    required: ['time', 'callid', 'queuename', 'event', 'data1', 'data2', 'data3'],
    optional: ['agent', 'data4'],
  },
} as const;

type DatasetKey = keyof typeof DATASETS;

interface DatabaseSourceConfigurationReader {
  get(pbxInstanceId: string): SafeDatabaseSourceConfiguration | undefined;
}

interface HistoricalDatabaseQueryPort {
  query(
    pbxInstanceId: string,
    request: ReadOnlyDatabaseQuery,
    limits?: DatabaseQueryLimits,
  ): Promise<DatabaseQueryResult>;
}

export interface AsteriskHistoricalSchemaAdapterOptions {
  configuration: DatabaseSourceConfigurationReader;
  transport: HistoricalDatabaseQueryPort;
}

interface SourceTable {
  schema: string;
  table: string;
  columns: ReadonlyMap<string, string>;
}

interface InspectedDataset {
  availability: HistoricalDatasetAvailability;
  table?: SourceTable;
}

interface Inspection {
  config: SafeDatabaseSourceConfiguration;
  calls: InspectedDataset;
  callEvents: InspectedDataset;
  queueEvents: InspectedDataset;
  queueAbandonment: InspectedDataset;
  queuePerformance: InspectedDataset;
}

export type HistoricalSourceSchemaErrorCode =
  | 'NOT_CONFIGURED'
  | 'DATASET_UNAVAILABLE'
  | 'INVALID_SOURCE_ROW'
  | 'INVALID_LIMIT'
  | 'INVALID_RANGE'
  | 'INVALID_QUEUE'
  | 'INVALID_THRESHOLD'
  | 'EXPORT_TOO_LARGE';

export class HistoricalSourceSchemaError extends Error {
  constructor(readonly code: HistoricalSourceSchemaErrorCode) {
    super(`Historical source schema ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'HistoricalSourceSchemaError';
  }
}

function historyLimits(maxRows: number): DatabaseQueryLimits {
  return {
    timeoutMs: HISTORY_TIMEOUT_MS,
    maxRows,
    maxOutputBytes: HISTORY_OUTPUT_BYTES,
  };
}

interface ValidatedReportWindow extends HistoricalReportWindow {
  queryFrom: string;
  queryTo: string;
}

function normalizeSourceLocalDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (!match) throw new HistoricalSourceSchemaError('INVALID_RANGE');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new HistoricalSourceSchemaError('INVALID_RANGE');
  }
  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}`;
}

function validateReportWindow(from: string, to: string): ValidatedReportWindow {
  const normalizedFrom = normalizeSourceLocalDateTime(from);
  const normalizedTo = normalizeSourceLocalDateTime(to);
  if (normalizedFrom >= normalizedTo) throw new HistoricalSourceSchemaError('INVALID_RANGE');
  return {
    from: normalizedFrom,
    to: normalizedTo,
    queryFrom: normalizedFrom.replace('T', ' '),
    queryTo: normalizedTo.replace('T', ' '),
  };
}

function validateLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_HISTORY_ROWS) {
    throw new HistoricalSourceSchemaError('INVALID_LIMIT');
  }
  return limit;
}

function validateQueueId(queueId: string): string {
  if (typeof queueId !== 'string') throw new HistoricalSourceSchemaError('INVALID_QUEUE');
  const normalized = queueId.trim();
  if (
    !normalized ||
    normalized.length > 128 ||
    [...normalized].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new HistoricalSourceSchemaError('INVALID_QUEUE');
  }
  return normalized;
}

function validateQueueIds(queueIds: readonly string[]): string[] {
  if (
    !Array.isArray(queueIds) ||
    queueIds.length === 0 ||
    queueIds.length > MAX_QUEUE_REPORT_QUEUES
  ) {
    throw new HistoricalSourceSchemaError('INVALID_QUEUE');
  }
  const normalized = queueIds.map((queueId) => validateQueueId(queueId));
  if (new Set(normalized).size !== normalized.length) {
    throw new HistoricalSourceSchemaError('INVALID_QUEUE');
  }
  return normalized;
}

function sourceLocalMillis(value: string): number {
  const parsed = Date.parse(`${value}Z`);
  if (!Number.isFinite(parsed)) throw new HistoricalSourceSchemaError('INVALID_RANGE');
  return parsed;
}

function sourceLocalFromMillis(value: number): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function splitQueueReportWindow(window: ValidatedReportWindow): ValidatedReportWindow[] {
  const fromMs = sourceLocalMillis(window.from);
  const toMs = sourceLocalMillis(window.to);
  const dayMs = 24 * 60 * 60 * 1000;
  if (toMs - fromMs > MAX_QUEUE_REPORT_DAYS * dayMs) {
    throw new HistoricalSourceSchemaError('INVALID_RANGE');
  }
  const chunkMs = QUEUE_REPORT_CHUNK_DAYS * dayMs;
  const chunks: ValidatedReportWindow[] = [];
  let cursor = fromMs;
  while (cursor < toMs) {
    const end = Math.min(cursor + chunkMs, toMs);
    const from = sourceLocalFromMillis(cursor);
    const to = sourceLocalFromMillis(end);
    chunks.push({ from, to, queryFrom: from.replace('T', ' '), queryTo: to.replace('T', ' ') });
    cursor = end;
  }
  return chunks;
}

function reportWindowFromMillis(fromMs: number, toMs: number): ValidatedReportWindow {
  const from = sourceLocalFromMillis(fromMs);
  const to = sourceLocalFromMillis(toMs);
  return {
    from,
    to,
    queryFrom: from.replace('T', ' '),
    queryTo: to.replace('T', ' '),
  };
}

function splitWindowHalf(
  window: ValidatedReportWindow,
): [ValidatedReportWindow, ValidatedReportWindow] {
  const fromMs = sourceLocalMillis(window.from);
  const toMs = sourceLocalMillis(window.to);
  if (toMs - fromMs <= 1_000) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  const midpoint = fromMs + Math.floor((toMs - fromMs) / 2);
  return [reportWindowFromMillis(fromMs, midpoint), reportWindowFromMillis(midpoint, toMs)];
}

function adaptiveHistoryLimits(): DatabaseQueryLimits {
  return {
    timeoutMs: HISTORY_TIMEOUT_MS,
    maxRows: MAX_ADAPTIVE_SOURCE_ROWS,
    maxOutputBytes: 2 * 1024 * 1024,
  };
}

async function boundedRowCount(
  transport: HistoricalDatabaseQueryPort,
  pbxInstanceId: PbxInstanceId,
  request: ReadOnlyDatabaseQuery,
): Promise<number> {
  const result = await transport.query(pbxInstanceId, request, historyLimits(1));
  if (result.rows.length !== 1) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  return aggregateInteger(result.rows[0]?.bounded_row_count);
}

async function queryAdaptiveRows(
  transport: HistoricalDatabaseQueryPort,
  pbxInstanceId: PbxInstanceId,
  window: ValidatedReportWindow,
  inclusiveEnd: boolean,
  buildCountQuery: (window: ValidatedReportWindow, inclusiveEnd: boolean) => ReadOnlyDatabaseQuery,
  buildRowsQuery: (window: ValidatedReportWindow, inclusiveEnd: boolean) => ReadOnlyDatabaseQuery,
): Promise<DatabaseResultRow[]> {
  const count = await boundedRowCount(
    transport,
    pbxInstanceId,
    buildCountQuery(window, inclusiveEnd),
  );
  if (count === 0) return [];
  if (count > MAX_ADAPTIVE_SOURCE_ROWS) {
    const [first, second] = splitWindowHalf(window);
    return [
      ...(await queryAdaptiveRows(
        transport,
        pbxInstanceId,
        first,
        false,
        buildCountQuery,
        buildRowsQuery,
      )),
      ...(await queryAdaptiveRows(
        transport,
        pbxInstanceId,
        second,
        inclusiveEnd,
        buildCountQuery,
        buildRowsQuery,
      )),
    ];
  }
  const result = await transport.query(
    pbxInstanceId,
    buildRowsQuery(window, inclusiveEnd),
    adaptiveHistoryLimits(),
  );
  if (result.rows.length !== count) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  return [...result.rows];
}

async function queryAdaptiveConsume(
  transport: HistoricalDatabaseQueryPort,
  pbxInstanceId: PbxInstanceId,
  window: ValidatedReportWindow,
  inclusiveEnd: boolean,
  buildCountQuery: (window: ValidatedReportWindow, inclusiveEnd: boolean) => ReadOnlyDatabaseQuery,
  buildRowsQuery: (window: ValidatedReportWindow, inclusiveEnd: boolean) => ReadOnlyDatabaseQuery,
  consumeRows: (rows: readonly DatabaseResultRow[]) => void,
): Promise<void> {
  const rows = await queryAdaptiveRows(
    transport,
    pbxInstanceId,
    window,
    inclusiveEnd,
    buildCountQuery,
    buildRowsQuery,
  );
  consumeRows(rows);
}

async function queryAdaptiveGroupedConsume(
  transport: HistoricalDatabaseQueryPort,
  pbxInstanceId: PbxInstanceId,
  window: ValidatedReportWindow,
  inclusiveEnd: boolean,
  buildSourceCountQuery: (
    window: ValidatedReportWindow,
    inclusiveEnd: boolean,
  ) => ReadOnlyDatabaseQuery,
  buildGroupedRowsQuery: (
    window: ValidatedReportWindow,
    inclusiveEnd: boolean,
  ) => ReadOnlyDatabaseQuery,
  consumeRows: (rows: readonly DatabaseResultRow[]) => void,
): Promise<void> {
  const sourceRows = await boundedRowCount(
    transport,
    pbxInstanceId,
    buildSourceCountQuery(window, inclusiveEnd),
  );
  if (sourceRows === 0) return;
  if (sourceRows > MAX_ADAPTIVE_SOURCE_ROWS) {
    const [first, second] = splitWindowHalf(window);
    await queryAdaptiveGroupedConsume(
      transport,
      pbxInstanceId,
      first,
      false,
      buildSourceCountQuery,
      buildGroupedRowsQuery,
      consumeRows,
    );
    await queryAdaptiveGroupedConsume(
      transport,
      pbxInstanceId,
      second,
      inclusiveEnd,
      buildSourceCountQuery,
      buildGroupedRowsQuery,
      consumeRows,
    );
    return;
  }
  const result = await transport.query(
    pbxInstanceId,
    buildGroupedRowsQuery(window, inclusiveEnd),
    adaptiveHistoryLimits(),
  );
  if (result.rows.length > sourceRows) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  consumeRows(result.rows);
}

function validateLongWaitThreshold(minutes: number): number {
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_LONG_WAIT_THRESHOLD_MINUTES) {
    throw new HistoricalSourceSchemaError('INVALID_THRESHOLD');
  }
  return minutes;
}

function boundedText(value: unknown, maxLength: number, required = true): string | undefined {
  if (value === null || value === undefined) {
    if (required) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
    return undefined;
  }
  if (typeof value !== 'string') throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  const normalized = value.trim();
  if (!normalized) {
    if (required) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
    return undefined;
  }
  if (
    normalized.length > maxLength ||
    [...normalized].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
  return normalized;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value >= 0) return value;
    throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
  if (typeof value !== 'string' || !/^\d{1,12}$/u.test(value.trim())) {
    throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  return parsed;
}

function normalizeDisposition(value: unknown): HistoricalCallDisposition {
  const source = boundedText(value, 64)?.toUpperCase().replaceAll('-', ' ').replaceAll('_', ' ');
  switch (source) {
    case 'ANSWERED':
      return 'ANSWERED';
    case 'NO ANSWER':
    case 'NOANSWER':
      return 'NO_ANSWER';
    case 'BUSY':
      return 'BUSY';
    case 'FAILED':
    case 'CONGESTION':
    case 'CHANUNAVAIL':
    case 'CHANNEL UNAVAILABLE':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

function normalizeCallEventType(value: unknown): HistoricalCallEventType {
  const source = boundedText(value, 64)?.toUpperCase();
  switch (source) {
    case 'CHAN_START':
      return 'CHANNEL_STARTED';
    case 'CHAN_END':
      return 'CHANNEL_ENDED';
    case 'ANSWER':
      return 'ANSWERED';
    case 'HANGUP':
      return 'HUNG_UP';
    case 'BRIDGE_ENTER':
    case 'BRIDGE_START':
      return 'BRIDGE_ENTERED';
    case 'BRIDGE_EXIT':
    case 'BRIDGE_END':
      return 'BRIDGE_LEFT';
    case 'APP_START':
      return 'APPLICATION_STARTED';
    case 'APP_END':
      return 'APPLICATION_ENDED';
    case 'LINKEDID_END':
      return 'LINKED_ID_ENDED';
    case 'USER_DEFINED':
      return 'USER_DEFINED';
    default:
      return 'OTHER';
  }
}

function normalizeQueueEventType(value: unknown): HistoricalQueueEventType {
  const source = boundedText(value, 64)?.toUpperCase().replaceAll('-', '').replaceAll('_', '');
  switch (source) {
    case 'ENTERQUEUE':
      return 'ENTERED';
    case 'CONNECT':
      return 'CONNECTED';
    case 'COMPLETEAGENT':
    case 'COMPLETECALLER':
      return 'COMPLETED';
    case 'ABANDON':
      return 'ABANDONED';
    case 'EXITWITHTIMEOUT':
      return 'TIMED_OUT';
    case 'EXITWITHKEY':
      return 'EXITED';
    case 'TRANSFER':
      return 'TRANSFERRED';
    case 'RINGNOANSWER':
      return 'RING_NO_ANSWER';
    default:
      return 'OTHER';
  }
}

function quoteIdentifier(dialect: DatabaseDialect, value: string): string {
  if (
    !value ||
    value.length > 128 ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new HistoricalSourceSchemaError('DATASET_UNAVAILABLE');
  }
  if (dialect === 'MYSQL_MARIADB') return `\`${value.replaceAll('`', '``')}\``;
  return `"${value.replaceAll('"', '""')}"`;
}

function tableReference(dialect: DatabaseDialect, table: SourceTable): string {
  return `${quoteIdentifier(dialect, table.schema)}.${quoteIdentifier(dialect, table.table)}`;
}

function column(dialect: DatabaseDialect, table: SourceTable, name: string): string | undefined {
  const actual = table.columns.get(name.toLowerCase());
  return actual ? quoteIdentifier(dialect, actual) : undefined;
}

function castText(dialect: DatabaseDialect, expression: string): string {
  return `CAST(${expression} AS ${dialect === 'MYSQL_MARIADB' ? 'CHAR' : 'TEXT'})`;
}

function requiredColumn(dialect: DatabaseDialect, table: SourceTable, name: string): string {
  const result = column(dialect, table, name);
  if (!result) throw new HistoricalSourceSchemaError('DATASET_UNAVAILABLE');
  return result;
}

function optionalTextExpression(
  dialect: DatabaseDialect,
  table: SourceTable,
  name: string,
  alias: string,
): string {
  const source = column(dialect, table, name);
  return source ? `${castText(dialect, source)} AS ${alias}` : `NULL AS ${alias}`;
}

function schemaInspectionQuery(
  dialect: DatabaseDialect,
  databaseName: string,
  databaseScopes: readonly string[],
): ReadOnlyDatabaseQuery {
  const tableNames = [...new Set(Object.values(DATASETS).flatMap((dataset) => dataset.tables))];
  const tablePlaceholders = tableNames.map(() => '?').join(', ');
  const scopePlaceholders = databaseScopes.map(() => '?').join(', ');
  if (dialect === 'MYSQL_MARIADB') {
    return {
      sql: `SELECT table_schema, table_name, column_name
            FROM information_schema.columns
            WHERE table_schema IN (${scopePlaceholders})
              AND table_name IN (${tablePlaceholders})
            ORDER BY table_schema, table_name, ordinal_position`,
      parameters: [...databaseScopes, ...tableNames],
    };
  }
  return {
    sql: `SELECT table_schema, table_name, column_name
          FROM information_schema.columns
          WHERE table_catalog = ?
            AND table_schema IN (${scopePlaceholders})
            AND table_name IN (${tablePlaceholders})
          ORDER BY table_schema, table_name, ordinal_position`,
    parameters: [databaseName, ...databaseScopes, ...tableNames],
  };
}

function inspectionRow(row: DatabaseResultRow): {
  schema: string;
  table: string;
  column: string;
} {
  return {
    schema: boundedText(row.table_schema, 128)!,
    table: boundedText(row.table_name, 128)!,
    column: boundedText(row.column_name, 128)!,
  };
}

function tableGroups(rows: readonly DatabaseResultRow[]): SourceTable[] {
  const groups = new Map<string, { schema: string; table: string; columns: Map<string, string> }>();
  for (const row of rows) {
    const parsed = inspectionRow(row);
    const key = `${parsed.schema}\u0000${parsed.table}`;
    const existing = groups.get(key) ?? {
      schema: parsed.schema,
      table: parsed.table,
      columns: new Map<string, string>(),
    };
    const lower = parsed.column.toLowerCase();
    if (!existing.columns.has(lower)) existing.columns.set(lower, parsed.column);
    groups.set(key, existing);
  }
  return [...groups.values()];
}

function inspectDataset(
  tables: readonly SourceTable[],
  dataset: (typeof DATASETS)[DatasetKey],
): InspectedDataset {
  const allowedTables = new Set(dataset.tables.map((name) => name.toLowerCase()));
  const candidates = tables.filter((table) => allowedTables.has(table.table.toLowerCase()));
  if (candidates.length === 0) return { availability: 'NOT_FOUND' };

  const matching = candidates.filter((table) =>
    dataset.required.every((required) => table.columns.has(required)),
  );
  if (matching.length === 0) return { availability: 'SCHEMA_MISMATCH' };
  if (matching.length > 1) return { availability: 'AMBIGUOUS' };
  const table = matching[0];
  if (!table) return { availability: 'SCHEMA_MISMATCH' };
  return { availability: 'SUPPORTED', table };
}

function safeCapability(dataset: InspectedDataset): {
  availability: HistoricalDatasetAvailability;
} {
  return { availability: dataset.availability };
}

function callQuery(dialect: DatabaseDialect, table: SourceTable): ReadOnlyDatabaseQuery {
  const uniqueid = requiredColumn(dialect, table, 'uniqueid');
  const calldate = requiredColumn(dialect, table, 'calldate');
  const src = requiredColumn(dialect, table, 'src');
  const dst = requiredColumn(dialect, table, 'dst');
  const duration = requiredColumn(dialect, table, 'duration');
  const billsec = requiredColumn(dialect, table, 'billsec');
  const disposition = requiredColumn(dialect, table, 'disposition');

  return {
    sql: `SELECT
            ${castText(dialect, uniqueid)} AS record_id,
            ${optionalTextExpression(dialect, table, 'linkedid', 'correlation_id')},
            ${castText(dialect, calldate)} AS source_started_at,
            ${castText(dialect, src)} AS source_number,
            ${castText(dialect, dst)} AS destination_number,
            ${castText(dialect, duration)} AS duration_seconds,
            ${castText(dialect, billsec)} AS billable_seconds,
            ${castText(dialect, disposition)} AS disposition
          FROM ${tableReference(dialect, table)}
          ORDER BY ${calldate} DESC`,
  };
}

function callOutcomeQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
): ReadOnlyDatabaseQuery {
  const calldate = requiredColumn(dialect, table, 'calldate');
  const duration = requiredColumn(dialect, table, 'duration');
  const disposition = requiredColumn(dialect, table, 'disposition');
  const normalized = `UPPER(TRIM(${castText(dialect, disposition)}))`;
  const numericDuration = `CAST(${duration} AS DECIMAL(20,3))`;
  return {
    sql: `SELECT
            COUNT(*) AS total_calls,
            SUM(CASE WHEN ${normalized} = 'ANSWERED' THEN 1 ELSE 0 END) AS answered_calls,
            SUM(CASE WHEN ${normalized} IN ('NO ANSWER', 'NOANSWER', 'NO_ANSWER') THEN 1 ELSE 0 END) AS no_answer_calls,
            SUM(CASE WHEN ${normalized} = 'BUSY' THEN 1 ELSE 0 END) AS busy_calls,
            SUM(CASE WHEN ${normalized} IN ('FAILED', 'CONGESTION', 'CHANUNAVAIL', 'CHANNEL UNAVAILABLE') THEN 1 ELSE 0 END) AS failed_calls,
            AVG(${numericDuration}) AS average_duration_seconds
          FROM ${tableReference(dialect, table)}
          WHERE ${calldate} >= ? AND ${calldate} <= ?`,
    parameters: [window.queryFrom, window.queryTo],
  };
}

function aggregateInteger(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return nonNegativeInteger(value);
}

function nonNegativeFinite(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
  return parsed;
}

function parseCallOutcomeAnalytics(
  pbxInstanceId: PbxInstanceId,
  window: ValidatedReportWindow,
  row: DatabaseResultRow | undefined,
): HistoricalCallOutcomeAnalytics {
  const totalCalls = aggregateInteger(row?.total_calls);
  const answeredCalls = aggregateInteger(row?.answered_calls);
  const noAnswerCalls = aggregateInteger(row?.no_answer_calls);
  const busyCalls = aggregateInteger(row?.busy_calls);
  const failedCalls = aggregateInteger(row?.failed_calls);
  const knownCalls = answeredCalls + noAnswerCalls + busyCalls + failedCalls;
  if (knownCalls > totalCalls) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  const unknownCalls = totalCalls - knownCalls;
  const averageDurationSeconds = nonNegativeFinite(row?.average_duration_seconds);
  return {
    instanceId: pbxInstanceId,
    source: 'DATABASE',
    from: window.from,
    to: window.to,
    totalCalls,
    answeredCalls,
    noAnswerCalls,
    busyCalls,
    failedCalls,
    unknownCalls,
    answerRatioPercent: totalCalls === 0 ? 0 : (answeredCalls / totalCalls) * 100,
    averageDurationSeconds,
  };
}

function queueEventFilterExpression(dialect: DatabaseDialect, eventColumn: string): string {
  return dialect === 'MYSQL_MARIADB'
    ? eventColumn
    : `UPPER(TRIM(${castText(dialect, eventColumn)}))`;
}

function queueAbandonmentQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueId: string,
  longWaitThresholdSeconds: number,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const data3 = requiredColumn(dialect, table, 'data3');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const waitSeconds = `CAST(NULLIF(TRIM(${castText(dialect, data3)}), '') AS DECIMAL(20,3))`;
  return {
    sql: `SELECT
            SUM(CASE WHEN ${normalizedEvent} = 'ENTERQUEUE' THEN 1 ELSE 0 END) AS entered_calls,
            SUM(CASE WHEN ${normalizedEvent} = 'CONNECT' THEN 1 ELSE 0 END) AS connected_calls,
            SUM(CASE WHEN ${normalizedEvent} = 'ABANDON' THEN 1 ELSE 0 END) AS abandoned_calls,
            SUM(CASE WHEN ${normalizedEvent} = 'EXITWITHTIMEOUT' THEN 1 ELSE 0 END) AS timed_out_calls,
            SUM(CASE WHEN ${normalizedEvent} = 'ABANDON' AND ${waitSeconds} >= ? THEN 1 ELSE 0 END) AS long_wait_abandoned_calls,
            AVG(CASE WHEN ${normalizedEvent} = 'ABANDON' THEN ${waitSeconds} ELSE NULL END) AS average_wait_before_abandon_seconds
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} = ?
            AND ${time} >= ? AND ${time} <= ?
            AND ${normalizedEvent} IN ('ENTERQUEUE', 'CONNECT', 'ABANDON', 'EXITWITHTIMEOUT')`,
    parameters: [longWaitThresholdSeconds, queueId, window.queryFrom, window.queryTo],
  };
}

function queueCatalogQuery(dialect: DatabaseDialect, table: SourceTable): ReadOnlyDatabaseQuery {
  const queuename = requiredColumn(dialect, table, 'queuename');
  return {
    sql: `SELECT DISTINCT ${castText(dialect, queuename)} AS queue_id
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IS NOT NULL AND ${queuename} <> ''
          ORDER BY ${queuename}`,
  };
}

type CallerCountMap = Map<string, number>;

interface QueueCallerMetrics {
  uniqueCallers: number;
  repeatCallers: number;
  repeatCallerRatePercent: number;
  averageCallsPerCaller: number;
  callsFromRepeatCallers: number;
  repeatCallSharePercent: number;
  callerIdentificationRatePercent: number;
}

function queueCallerEntryCountQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT COUNT(*) AS bounded_row_count
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} = ?
            AND ${time} >= ? AND ${time} ${endOperator} ?`,
    parameters: [...queueIds, 'ENTERQUEUE', window.queryFrom, window.queryTo],
  };
}

function queueCallerEntryRowsQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const caller = requiredColumn(dialect, table, 'data2');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const callerText = castText(dialect, caller);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT
            ${castText(dialect, queuename)} AS queue_id,
            ${callerText} AS caller_id,
            COUNT(*) AS caller_calls
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} = ?
            AND ${time} >= ? AND ${time} ${endOperator} ?
            AND ${caller} IS NOT NULL
            AND TRIM(${callerText}) <> ''
          GROUP BY ${queuename}, ${caller}
          ORDER BY ${queuename}, ${caller}`,
    parameters: [...queueIds, 'ENTERQUEUE', window.queryFrom, window.queryTo],
  };
}

function callerDigest(key: Uint8Array, callerId: string): string {
  return createHmac('sha256', key).update(callerId, 'utf8').digest('hex');
}

function incrementCallerCount(counts: CallerCountMap, digest: string, increment = 1): void {
  counts.set(digest, (counts.get(digest) ?? 0) + increment);
}

function callerMetrics(counts: CallerCountMap, enteredCalls: number): QueueCallerMetrics {
  let identifiedCalls = 0;
  let repeatCallers = 0;
  let callsFromRepeatCallers = 0;
  for (const count of counts.values()) {
    identifiedCalls += count;
    if (count > 1) {
      repeatCallers += 1;
      callsFromRepeatCallers += count;
    }
  }
  const uniqueCallers = counts.size;
  return {
    uniqueCallers,
    repeatCallers,
    repeatCallerRatePercent: uniqueCallers === 0 ? 0 : (repeatCallers / uniqueCallers) * 100,
    averageCallsPerCaller: uniqueCallers === 0 ? 0 : identifiedCalls / uniqueCallers,
    callsFromRepeatCallers,
    repeatCallSharePercent:
      identifiedCalls === 0 ? 0 : (callsFromRepeatCallers / identifiedCalls) * 100,
    callerIdentificationRatePercent:
      enteredCalls === 0 ? 0 : (identifiedCalls / enteredCalls) * 100,
  };
}

interface QueuePerformanceAccumulator {
  queueId: string;
  enteredCalls: number;
  answeredCalls: number;
  callerAbandonedCalls: number;
  timedOutCalls: number;
  exitWithKeyCalls: number;
  forcedExitCalls: number;
  systemFailureCalls: number;
  ringNoAnswerAttempts: number;
  ringCanceledAttempts: number;
  answerWaitSumSeconds: number;
  answerWaitSamples: number;
  waitSumSeconds: number;
  waitSamples: number;
}

function emptyQueuePerformanceAccumulator(queueId: string): QueuePerformanceAccumulator {
  return {
    queueId,
    enteredCalls: 0,
    answeredCalls: 0,
    callerAbandonedCalls: 0,
    timedOutCalls: 0,
    exitWithKeyCalls: 0,
    forcedExitCalls: 0,
    systemFailureCalls: 0,
    ringNoAnswerAttempts: 0,
    ringCanceledAttempts: 0,
    answerWaitSumSeconds: 0,
    answerWaitSamples: 0,
    waitSumSeconds: 0,
    waitSamples: 0,
  };
}

function numericSourceExpression(dialect: DatabaseDialect, expression: string): string {
  return `CAST(NULLIF(TRIM(${castText(dialect, expression)}), '') AS DECIMAL(20,3))`;
}

const QUEUE_PERFORMANCE_EVENT_NAMES = [
  'ENTERQUEUE',
  'CONNECT',
  'ABANDON',
  'EXITWITHTIMEOUT',
  'EXITWITHKEY',
  'EXITEMPTY',
  'AGENTDUMP',
  'SYSCOMPAT',
  'RINGNOANSWER',
  'RINGCANCELED',
] as const;

type QueuePerformanceWaitEvent =
  'CONNECT' | 'ABANDON' | 'EXITWITHTIMEOUT' | 'EXITEMPTY' | 'EXITWITHKEY';

const QUEUE_PERFORMANCE_WAIT_EVENTS: readonly QueuePerformanceWaitEvent[] = [
  'CONNECT',
  'ABANDON',
  'EXITWITHTIMEOUT',
  'EXITEMPTY',
  'EXITWITHKEY',
];

function queuePerformanceCountQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const eventPlaceholders = QUEUE_PERFORMANCE_EVENT_NAMES.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT
            ${castText(dialect, queuename)} AS queue_id,
            ${castText(dialect, event)} AS event_type,
            COUNT(*) AS event_count
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${time} >= ? AND ${time} ${endOperator} ?
            AND ${normalizedEvent} IN (${eventPlaceholders})
          GROUP BY ${queuename}, ${event}
          ORDER BY ${queuename}, ${event}`,
    parameters: [...queueIds, window.queryFrom, window.queryTo, ...QUEUE_PERFORMANCE_EVENT_NAMES],
  };
}

function waitColumnForEvent(
  dialect: DatabaseDialect,
  table: SourceTable,
  eventName: QueuePerformanceWaitEvent,
): string | undefined {
  if (eventName === 'CONNECT') return requiredColumn(dialect, table, 'data1');
  if (eventName === 'EXITWITHKEY') return column(dialect, table, 'data4');
  return requiredColumn(dialect, table, 'data3');
}

function queuePerformanceTimingQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  eventName: QueuePerformanceWaitEvent,
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery | undefined {
  const waitColumn = waitColumnForEvent(dialect, table, eventName);
  if (!waitColumn) return undefined;
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const waitSeconds = numericSourceExpression(dialect, waitColumn);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT
            ${castText(dialect, queuename)} AS queue_id,
            SUM(CASE WHEN ${waitSeconds} IS NOT NULL THEN ${waitSeconds} ELSE 0 END) AS wait_sum_seconds,
            SUM(CASE WHEN ${waitSeconds} IS NOT NULL THEN 1 ELSE 0 END) AS wait_samples
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} = ?
            AND ${time} >= ? AND ${time} ${endOperator} ?
          GROUP BY ${queuename}
          ORDER BY ${queuename}`,
    parameters: [...queueIds, eventName, window.queryFrom, window.queryTo],
  };
}

function applyQueuePerformanceCount(
  accumulator: QueuePerformanceAccumulator,
  eventName: string,
  count: number,
): void {
  switch (eventName) {
    case 'ENTERQUEUE':
      accumulator.enteredCalls += count;
      break;
    case 'CONNECT':
      accumulator.answeredCalls += count;
      break;
    case 'ABANDON':
      accumulator.callerAbandonedCalls += count;
      break;
    case 'EXITWITHTIMEOUT':
      accumulator.timedOutCalls += count;
      break;
    case 'EXITWITHKEY':
      accumulator.exitWithKeyCalls += count;
      break;
    case 'EXITEMPTY':
      accumulator.forcedExitCalls += count;
      break;
    case 'AGENTDUMP':
    case 'SYSCOMPAT':
      accumulator.systemFailureCalls += count;
      break;
    case 'RINGNOANSWER':
      accumulator.ringNoAnswerAttempts += count;
      break;
    case 'RINGCANCELED':
      accumulator.ringCanceledAttempts += count;
      break;
    default:
      throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
}

function parseQueuePerformanceCountRow(row: DatabaseResultRow): {
  queueId: string;
  eventName: string;
  count: number;
} {
  return {
    queueId: boundedText(row.queue_id, 128)!,
    eventName: boundedText(row.event_type, 64)!.toUpperCase(),
    count: aggregateInteger(row.event_count),
  };
}

function parseQueuePerformanceTimingRow(row: DatabaseResultRow): {
  queueId: string;
  sumSeconds: number;
  samples: number;
} {
  return {
    queueId: boundedText(row.queue_id, 128)!,
    sumSeconds: nonNegativeFinite(row.wait_sum_seconds),
    samples: aggregateInteger(row.wait_samples),
  };
}

function applyQueuePerformanceTiming(
  accumulator: QueuePerformanceAccumulator,
  eventName: QueuePerformanceWaitEvent,
  sumSeconds: number,
  samples: number,
): void {
  if (eventName === 'CONNECT') {
    accumulator.answerWaitSumSeconds += sumSeconds;
    accumulator.answerWaitSamples += samples;
  }
  accumulator.waitSumSeconds += sumSeconds;
  accumulator.waitSamples += samples;
}

function mergeQueuePerformanceAccumulator(
  target: QueuePerformanceAccumulator,
  source: QueuePerformanceAccumulator,
): void {
  target.enteredCalls += source.enteredCalls;
  target.answeredCalls += source.answeredCalls;
  target.callerAbandonedCalls += source.callerAbandonedCalls;
  target.timedOutCalls += source.timedOutCalls;
  target.exitWithKeyCalls += source.exitWithKeyCalls;
  target.forcedExitCalls += source.forcedExitCalls;
  target.systemFailureCalls += source.systemFailureCalls;
  target.ringNoAnswerAttempts += source.ringNoAnswerAttempts;
  target.ringCanceledAttempts += source.ringCanceledAttempts;
  target.answerWaitSumSeconds += source.answerWaitSumSeconds;
  target.answerWaitSamples += source.answerWaitSamples;
  target.waitSumSeconds += source.waitSumSeconds;
  target.waitSamples += source.waitSamples;
}

function sumQueuePerformanceAccumulators(
  values: readonly QueuePerformanceAccumulator[],
): QueuePerformanceAccumulator {
  const total = emptyQueuePerformanceAccumulator('TOTAL');
  for (const value of values) mergeQueuePerformanceAccumulator(total, value);
  return total;
}

function queuePerformanceMetrics(
  value: QueuePerformanceAccumulator,
  selectedEnteredCalls: number,
  callerCounts: CallerCountMap,
): HistoricalQueuePerformanceMetrics {
  const unansweredCalls = Math.max(0, value.enteredCalls - value.answeredCalls);
  const confirmedLostCalls =
    value.callerAbandonedCalls +
    value.timedOutCalls +
    value.exitWithKeyCalls +
    value.forcedExitCalls +
    value.systemFailureCalls;
  const unresolvedUnansweredCalls = Math.max(0, unansweredCalls - confirmedLostCalls);
  const outcomeExcessCalls = Math.max(0, confirmedLostCalls - unansweredCalls);
  const rate = (count: number) =>
    value.enteredCalls === 0 ? 0 : (count / value.enteredCalls) * 100;
  return {
    enteredCalls: value.enteredCalls,
    answeredCalls: value.answeredCalls,
    unansweredCalls,
    confirmedLostCalls,
    callerAbandonedCalls: value.callerAbandonedCalls,
    timedOutCalls: value.timedOutCalls,
    exitWithKeyCalls: value.exitWithKeyCalls,
    forcedExitCalls: value.forcedExitCalls,
    systemFailureCalls: value.systemFailureCalls,
    unresolvedUnansweredCalls,
    outcomeExcessCalls,
    ringNoAnswerAttempts: value.ringNoAnswerAttempts,
    ringCanceledAttempts: value.ringCanceledAttempts,
    incomingSharePercent:
      selectedEnteredCalls === 0 ? 0 : (value.enteredCalls / selectedEnteredCalls) * 100,
    answerRatePercent: rate(value.answeredCalls),
    unansweredRatePercent: rate(unansweredCalls),
    confirmedLostRatePercent: rate(confirmedLostCalls),
    callerAbandonRatePercent: rate(value.callerAbandonedCalls),
    timedOutRatePercent: rate(value.timedOutCalls),
    exitWithKeyRatePercent: rate(value.exitWithKeyCalls),
    forcedExitRatePercent: rate(value.forcedExitCalls),
    systemFailureRatePercent: rate(value.systemFailureCalls),
    unresolvedUnansweredRatePercent: rate(unresolvedUnansweredCalls),
    ringNoAnswerAttemptsPer100Entered: rate(value.ringNoAnswerAttempts),
    ...callerMetrics(callerCounts, value.enteredCalls),
    ...(value.answerWaitSamples > 0
      ? { averageAnswerSeconds: value.answerWaitSumSeconds / value.answerWaitSamples }
      : {}),
    ...(value.waitSamples > 0
      ? { averageWaitSeconds: value.waitSumSeconds / value.waitSamples }
      : {}),
  };
}

const QUEUE_DETAIL_OUTCOME_EVENTS = [
  'CONNECT',
  'ABANDON',
  'EXITWITHTIMEOUT',
  'EXITWITHKEY',
  'EXITEMPTY',
  'AGENTDUMP',
  'SYSCOMPAT',
  'COMPLETEAGENT',
  'COMPLETECALLER',
] as const;

function queueDetailEntryCountQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT COUNT(*) AS bounded_row_count
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} = ?
            AND ${time} >= ? AND ${time} ${endOperator} ?`,
    parameters: [...queueIds, 'ENTERQUEUE', window.queryFrom, window.queryTo],
  };
}

function queueDetailEntryQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const callid = requiredColumn(dialect, table, 'callid');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const caller = requiredColumn(dialect, table, 'data2');
  const position = requiredColumn(dialect, table, 'data3');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT
            ${castText(dialect, time)} AS entered_at,
            ${castText(dialect, callid)} AS call_id,
            ${castText(dialect, queuename)} AS queue_id,
            ${castText(dialect, caller)} AS caller_number,
            ${castText(dialect, position)} AS initial_position
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} = ?
            AND ${time} >= ? AND ${time} ${endOperator} ?
          ORDER BY ${queuename}, ${event}, ${time}`,
    parameters: [...queueIds, 'ENTERQUEUE', window.queryFrom, window.queryTo],
  };
}

function queueDetailOutcomeCountQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const eventPlaceholders = QUEUE_DETAIL_OUTCOME_EVENTS.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT COUNT(*) AS bounded_row_count
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} IN (${eventPlaceholders})
            AND ${time} >= ? AND ${time} ${endOperator} ?`,
    parameters: [...queueIds, ...QUEUE_DETAIL_OUTCOME_EVENTS, window.queryFrom, window.queryTo],
  };
}

function queueDetailOutcomeQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueIds: readonly string[],
  inclusiveEnd: boolean,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const callid = requiredColumn(dialect, table, 'callid');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const data1 = requiredColumn(dialect, table, 'data1');
  const data2 = requiredColumn(dialect, table, 'data2');
  const data3 = requiredColumn(dialect, table, 'data3');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const queuePlaceholders = queueIds.map(() => '?').join(', ');
  const eventPlaceholders = QUEUE_DETAIL_OUTCOME_EVENTS.map(() => '?').join(', ');
  const endOperator = inclusiveEnd ? '<=' : '<';
  return {
    sql: `SELECT
            ${castText(dialect, time)} AS source_occurred_at,
            ${castText(dialect, callid)} AS call_id,
            ${castText(dialect, queuename)} AS queue_id,
            ${castText(dialect, event)} AS event_type,
            ${optionalTextExpression(dialect, table, 'agent', 'agent_id')},
            ${castText(dialect, data1)} AS data1_value,
            ${castText(dialect, data2)} AS data2_value,
            ${castText(dialect, data3)} AS data3_value,
            ${optionalTextExpression(dialect, table, 'data4', 'data4_value')}
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} IN (${queuePlaceholders})
            AND ${normalizedEvent} IN (${eventPlaceholders})
            AND ${time} >= ? AND ${time} ${endOperator} ?
          ORDER BY ${queuename}, ${event}, ${time}`,
    parameters: [...queueIds, ...QUEUE_DETAIL_OUTCOME_EVENTS, window.queryFrom, window.queryTo],
  };
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  return nonNegativeInteger(value);
}

function optionalNonNegativeFinite(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  return nonNegativeFinite(value);
}

function queueDetailKey(queueId: string, callId: string): string {
  return `${queueId}\u0000${callId}`;
}

function queueDetailOutcomeForEvent(eventName: string): HistoricalQueueCallOutcome | undefined {
  switch (eventName) {
    case 'CONNECT':
      return 'ANSWERED';
    case 'ABANDON':
      return 'CALLER_ABANDONED';
    case 'EXITWITHTIMEOUT':
      return 'QUEUE_TIMEOUT';
    case 'EXITWITHKEY':
      return 'EXIT_WITH_KEY';
    case 'EXITEMPTY':
      return 'FORCED_EXIT';
    case 'AGENTDUMP':
    case 'SYSCOMPAT':
      return 'SYSTEM_FAILURE';
    default:
      return undefined;
  }
}

function outcomePriority(outcome: HistoricalQueueCallOutcome): number {
  if (outcome === 'ANSWERED') return 100;
  if (outcome === 'SYSTEM_FAILURE') return 50;
  if (outcome === 'UNRESOLVED') return 0;
  return 80;
}

function outcomeWaitSeconds(eventName: string, row: DatabaseResultRow): number | undefined {
  if (eventName === 'CONNECT') return optionalNonNegativeFinite(row.data1_value);
  if (eventName === 'EXITWITHKEY') return optionalNonNegativeFinite(row.data4_value);
  if (eventName === 'ABANDON' || eventName === 'EXITWITHTIMEOUT' || eventName === 'EXITEMPTY') {
    return optionalNonNegativeFinite(row.data3_value);
  }
  return undefined;
}

function applyDetailOutcome(detail: HistoricalQueueCallDetail, row: DatabaseResultRow): void {
  const occurredAt = boundedText(row.source_occurred_at, 64)!;
  if (occurredAt < detail.enteredAt) return;
  const eventName = boundedText(row.event_type, 64)!.toUpperCase();
  if (eventName === 'COMPLETEAGENT' || eventName === 'COMPLETECALLER') {
    detail.completedAt = occurredAt;
    const talkSeconds = optionalNonNegativeFinite(row.data2_value);
    if (talkSeconds !== undefined) detail.talkSeconds = talkSeconds;
    const completionAgent = boundedText(row.agent_id, 128, false);
    if (completionAgent && completionAgent.toUpperCase() !== 'NONE' && !detail.agentId) {
      detail.agentId = completionAgent;
    }
    return;
  }
  const nextOutcome = queueDetailOutcomeForEvent(eventName);
  if (!nextOutcome) return;
  const currentPriority = outcomePriority(detail.outcome);
  const nextPriority = outcomePriority(nextOutcome);
  if (
    nextPriority < currentPriority ||
    (nextPriority === currentPriority && detail.outcomeAt && occurredAt >= detail.outcomeAt)
  ) {
    return;
  }
  detail.outcome = nextOutcome;
  const waitSeconds = outcomeWaitSeconds(eventName, row);
  if (waitSeconds !== undefined) detail.waitSeconds = waitSeconds;
  const agentId = boundedText(row.agent_id, 128, false);
  if (nextOutcome === 'ANSWERED') {
    detail.connectedAt = occurredAt;
    if (agentId && agentId.toUpperCase() !== 'NONE') detail.agentId = agentId;
    delete detail.outcomeAt;
  } else {
    detail.outcomeAt = occurredAt;
    if (agentId && agentId.toUpperCase() !== 'NONE') detail.agentId = agentId;
  }
}

function queueAbandonWaitsQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  window: ValidatedReportWindow,
  queueId: string,
): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const event = requiredColumn(dialect, table, 'event');
  const data3 = requiredColumn(dialect, table, 'data3');
  const normalizedEvent = queueEventFilterExpression(dialect, event);
  const waitSeconds = `CAST(NULLIF(TRIM(${castText(dialect, data3)}), '') AS DECIMAL(20,3))`;
  return {
    sql: `SELECT ${castText(dialect, data3)} AS wait_seconds
          FROM ${tableReference(dialect, table)}
          WHERE ${queuename} = ?
            AND ${time} >= ? AND ${time} <= ?
            AND ${normalizedEvent} = 'ABANDON'
          ORDER BY ${waitSeconds} ASC`,
    parameters: [queueId, window.queryFrom, window.queryTo],
  };
}

function percentileNearestRank(sorted: readonly number[], percentile: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

function parseQueueAbandonmentAnalytics(
  pbxInstanceId: PbxInstanceId,
  window: ValidatedReportWindow,
  queueId: string,
  longWaitThresholdMinutes: number,
  row: DatabaseResultRow | undefined,
  percentileWaits?: readonly number[],
): HistoricalQueueAbandonmentAnalytics {
  const enteredCalls = aggregateInteger(row?.entered_calls);
  const connectedCalls = aggregateInteger(row?.connected_calls);
  const abandonedCalls = aggregateInteger(row?.abandoned_calls);
  const timedOutCalls = aggregateInteger(row?.timed_out_calls);
  const longWaitAbandonedCalls = aggregateInteger(row?.long_wait_abandoned_calls);
  if (longWaitAbandonedCalls > abandonedCalls) {
    throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
  }
  const averageRaw = row?.average_wait_before_abandon_seconds;
  const averageWaitBeforeAbandonSeconds =
    averageRaw === null || averageRaw === undefined ? undefined : nonNegativeFinite(averageRaw);
  const result: HistoricalQueueAbandonmentAnalytics = {
    instanceId: pbxInstanceId,
    source: 'DATABASE',
    from: window.from,
    to: window.to,
    queueId,
    longWaitThresholdMinutes,
    enteredCalls,
    connectedCalls,
    abandonedCalls,
    timedOutCalls,
    longWaitAbandonedCalls,
    ...(enteredCalls > 0 ? { abandonmentRatePercent: (abandonedCalls / enteredCalls) * 100 } : {}),
    ...(averageWaitBeforeAbandonSeconds === undefined ? {} : { averageWaitBeforeAbandonSeconds }),
  };
  if (percentileWaits) {
    const p50 = percentileNearestRank(percentileWaits, 0.5);
    const p90 = percentileNearestRank(percentileWaits, 0.9);
    if (p50 !== undefined) result.p50WaitBeforeAbandonSeconds = p50;
    if (p90 !== undefined) result.p90WaitBeforeAbandonSeconds = p90;
  }
  return result;
}

function callEventQuery(dialect: DatabaseDialect, table: SourceTable): ReadOnlyDatabaseQuery {
  const eventtime = requiredColumn(dialect, table, 'eventtime');
  const eventtype = requiredColumn(dialect, table, 'eventtype');
  const uniqueid = requiredColumn(dialect, table, 'uniqueid');
  return {
    sql: `SELECT
            ${castText(dialect, eventtime)} AS source_occurred_at,
            ${castText(dialect, eventtype)} AS event_type,
            ${castText(dialect, uniqueid)} AS call_id,
            ${optionalTextExpression(dialect, table, 'linkedid', 'correlation_id')},
            ${optionalTextExpression(dialect, table, 'exten', 'extension')},
            ${optionalTextExpression(dialect, table, 'cid_num', 'caller_number')}
          FROM ${tableReference(dialect, table)}
          ORDER BY ${eventtime} DESC, ${uniqueid} DESC`,
  };
}

function queueEventQuery(dialect: DatabaseDialect, table: SourceTable): ReadOnlyDatabaseQuery {
  const time = requiredColumn(dialect, table, 'time');
  const event = requiredColumn(dialect, table, 'event');
  const callid = requiredColumn(dialect, table, 'callid');
  const queuename = requiredColumn(dialect, table, 'queuename');
  const agent = requiredColumn(dialect, table, 'agent');
  return {
    sql: `SELECT
            ${castText(dialect, time)} AS source_occurred_at,
            ${castText(dialect, event)} AS event_type,
            ${castText(dialect, callid)} AS call_id,
            ${castText(dialect, queuename)} AS queue_id,
            ${castText(dialect, agent)} AS agent_id
          FROM ${tableReference(dialect, table)}
          ORDER BY ${time} DESC, ${callid} DESC`,
  };
}

function parseCall(pbxInstanceId: string, row: DatabaseResultRow): HistoricalCallRecord {
  const correlationId = boundedText(row.correlation_id, 128, false);
  const sourceNumber = boundedText(row.source_number, 128, false);
  const destinationNumber = boundedText(row.destination_number, 128, false);
  return {
    instanceId: pbxInstanceId,
    source: 'DATABASE',
    recordId: boundedText(row.record_id, 128)!,
    ...(correlationId ? { correlationId } : {}),
    sourceStartedAt: boundedText(row.source_started_at, 64)!,
    ...(sourceNumber ? { sourceNumber } : {}),
    ...(destinationNumber ? { destinationNumber } : {}),
    durationSeconds: nonNegativeInteger(row.duration_seconds),
    billableSeconds: nonNegativeInteger(row.billable_seconds),
    disposition: normalizeDisposition(row.disposition),
  };
}

function parseCallEvent(pbxInstanceId: string, row: DatabaseResultRow): HistoricalCallEventRecord {
  const correlationId = boundedText(row.correlation_id, 128, false);
  const extension = boundedText(row.extension, 128, false);
  const callerNumber = boundedText(row.caller_number, 128, false);
  return {
    instanceId: pbxInstanceId,
    source: 'DATABASE',
    sourceOccurredAt: boundedText(row.source_occurred_at, 64)!,
    eventType: normalizeCallEventType(row.event_type),
    callId: boundedText(row.call_id, 128)!,
    ...(correlationId ? { correlationId } : {}),
    ...(extension ? { extension } : {}),
    ...(callerNumber ? { callerNumber } : {}),
  };
}

function parseQueueEvent(
  pbxInstanceId: string,
  row: DatabaseResultRow,
): HistoricalQueueEventRecord {
  const agentId = boundedText(row.agent_id, 128, false);
  return {
    instanceId: pbxInstanceId,
    source: 'DATABASE',
    sourceOccurredAt: boundedText(row.source_occurred_at, 64)!,
    eventType: normalizeQueueEventType(row.event_type),
    callId: boundedText(row.call_id, 128)!,
    queueId: boundedText(row.queue_id, 128)!,
    ...(agentId && agentId.toUpperCase() !== 'NONE' ? { agentId } : {}),
  };
}

export class AsteriskConventionalSqlHistoryAdapter {
  constructor(private readonly options: AsteriskHistoricalSchemaAdapterOptions) {}

  async inspect(pbxInstanceId: PbxInstanceId): Promise<HistoricalSourceCapabilities> {
    const inspection = await this.inspectInternal(pbxInstanceId);
    return {
      instanceId: pbxInstanceId,
      source: 'DATABASE',
      adapter: ADAPTER_ID,
      calls: safeCapability(inspection.calls),
      callEvents: safeCapability(inspection.callEvents),
      queueEvents: safeCapability(inspection.queueEvents),
      queueAbandonment: safeCapability(inspection.queueAbandonment),
      queuePerformance: safeCapability(inspection.queuePerformance),
    };
  }

  async callOutcomeAnalytics(
    pbxInstanceId: PbxInstanceId,
    from: string,
    to: string,
  ): Promise<HistoricalCallOutcomeAnalytics> {
    const window = validateReportWindow(from, to);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.calls);
    const result = await this.options.transport.query(
      pbxInstanceId,
      callOutcomeQuery(inspection.config.dialect, table, window),
      historyLimits(1),
    );
    return parseCallOutcomeAnalytics(pbxInstanceId, window, result.rows[0]);
  }

  async queueAbandonmentAnalytics(
    pbxInstanceId: PbxInstanceId,
    queueId: string,
    from: string,
    to: string,
    longWaitThresholdMinutes: number,
  ): Promise<HistoricalQueueAbandonmentAnalytics> {
    const validatedQueueId = validateQueueId(queueId);
    const window = validateReportWindow(from, to);
    const validatedThresholdMinutes = validateLongWaitThreshold(longWaitThresholdMinutes);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.queueAbandonment);
    const result = await this.options.transport.query(
      pbxInstanceId,
      queueAbandonmentQuery(
        inspection.config.dialect,
        table,
        window,
        validatedQueueId,
        validatedThresholdMinutes * 60,
      ),
      historyLimits(1),
    );
    const abandonedCalls = aggregateInteger(result.rows[0]?.abandoned_calls);
    let percentileWaits: number[] | undefined;
    if (abandonedCalls > 0 && abandonedCalls <= MAX_QUEUE_PERCENTILE_ROWS) {
      const waits = await this.options.transport.query(
        pbxInstanceId,
        queueAbandonWaitsQuery(inspection.config.dialect, table, window, validatedQueueId),
        historyLimits(abandonedCalls),
      );
      if (waits.rows.length !== abandonedCalls) {
        throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
      }
      percentileWaits = waits.rows.map((wait) => nonNegativeFinite(wait.wait_seconds));
    }
    return parseQueueAbandonmentAnalytics(
      pbxInstanceId,
      window,
      validatedQueueId,
      validatedThresholdMinutes,
      result.rows[0],
      percentileWaits,
    );
  }

  async listQueueIds(pbxInstanceId: PbxInstanceId): Promise<string[]> {
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.queuePerformance);
    const result = await this.options.transport.query(
      pbxInstanceId,
      queueCatalogQuery(inspection.config.dialect, table),
      historyLimits(MAX_QUEUE_CATALOG_ROWS),
    );
    const ids = result.rows.map((row) => boundedText(row.queue_id, 128)!);
    if (new Set(ids).size !== ids.length)
      throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
    return ids;
  }

  async queuePerformanceReport(
    pbxInstanceId: PbxInstanceId,
    queueIds: readonly string[],
    from: string,
    to: string,
  ): Promise<HistoricalQueuePerformanceReport> {
    const validatedQueueIds = validateQueueIds(queueIds);
    const window = validateReportWindow(from, to);
    const chunks = splitQueueReportWindow(window);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.queuePerformance);
    const selected = new Set(validatedQueueIds);
    const accumulators = new Map(
      validatedQueueIds.map((queueId) => [queueId, emptyQueuePerformanceAccumulator(queueId)]),
    );

    for (const [index, chunk] of chunks.entries()) {
      const inclusiveEnd = index === chunks.length - 1;
      const counts = await this.options.transport.query(
        pbxInstanceId,
        queuePerformanceCountQuery(
          inspection.config.dialect,
          table,
          chunk,
          validatedQueueIds,
          inclusiveEnd,
        ),
        historyLimits(validatedQueueIds.length * QUEUE_PERFORMANCE_EVENT_NAMES.length),
      );
      const chunkEvents = new Set<string>();
      const seenCounts = new Set<string>();
      for (const row of counts.rows) {
        const parsed = parseQueuePerformanceCountRow(row);
        const identity = `${parsed.queueId}\u0000${parsed.eventName}`;
        if (!selected.has(parsed.queueId) || seenCounts.has(identity)) {
          throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
        }
        seenCounts.add(identity);
        applyQueuePerformanceCount(
          accumulators.get(parsed.queueId)!,
          parsed.eventName,
          parsed.count,
        );
        chunkEvents.add(parsed.eventName);
      }

      for (const eventName of QUEUE_PERFORMANCE_WAIT_EVENTS) {
        if (!chunkEvents.has(eventName)) continue;
        const request = queuePerformanceTimingQuery(
          inspection.config.dialect,
          table,
          chunk,
          validatedQueueIds,
          eventName,
          inclusiveEnd,
        );
        if (!request) continue;
        const timing = await this.options.transport.query(
          pbxInstanceId,
          request,
          historyLimits(validatedQueueIds.length),
        );
        const seenQueues = new Set<string>();
        for (const row of timing.rows) {
          const parsed = parseQueuePerformanceTimingRow(row);
          if (!selected.has(parsed.queueId) || seenQueues.has(parsed.queueId)) {
            throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
          }
          seenQueues.add(parsed.queueId);
          applyQueuePerformanceTiming(
            accumulators.get(parsed.queueId)!,
            eventName,
            parsed.sumSeconds,
            parsed.samples,
          );
        }
      }
    }

    const callerHashKey = randomBytes(32);
    const callerCountsByQueue = new Map<string, CallerCountMap>(
      validatedQueueIds.map((queueId) => [queueId, new Map<string, number>()]),
    );
    const totalCallerCounts: CallerCountMap = new Map();
    try {
      for (const [index, chunk] of chunks.entries()) {
        await queryAdaptiveGroupedConsume(
          this.options.transport,
          pbxInstanceId,
          chunk,
          index === chunks.length - 1,
          (callerWindow, inclusiveEnd) =>
            queueCallerEntryCountQuery(
              inspection.config.dialect,
              table,
              callerWindow,
              validatedQueueIds,
              inclusiveEnd,
            ),
          (callerWindow, inclusiveEnd) =>
            queueCallerEntryRowsQuery(
              inspection.config.dialect,
              table,
              callerWindow,
              validatedQueueIds,
              inclusiveEnd,
            ),
          (rows) => {
            for (const row of rows) {
              const queueId = boundedText(row.queue_id, 128)!;
              if (!selected.has(queueId))
                throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
              const callerId = boundedText(row.caller_id, 128, false);
              if (!callerId) continue;
              const callerCalls = aggregateInteger(row.caller_calls);
              if (callerCalls < 1) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
              const digest = callerDigest(callerHashKey, callerId);
              incrementCallerCount(callerCountsByQueue.get(queueId)!, digest, callerCalls);
              incrementCallerCount(totalCallerCounts, digest, callerCalls);
            }
          },
        );
      }
    } finally {
      callerHashKey.fill(0);
    }

    const orderedAccumulators = validatedQueueIds.map((queueId) => accumulators.get(queueId)!);
    const totalAccumulator = sumQueuePerformanceAccumulators(orderedAccumulators);
    const queues: HistoricalQueuePerformanceRow[] = orderedAccumulators.map((value) => ({
      queueId: value.queueId,
      ...queuePerformanceMetrics(
        value,
        totalAccumulator.enteredCalls,
        callerCountsByQueue.get(value.queueId)!,
      ),
    }));
    return {
      instanceId: pbxInstanceId,
      source: 'DATABASE',
      from: window.from,
      to: window.to,
      queueIds: validatedQueueIds,
      aggregationMode: 'SOURCE_AGGREGATE_CHUNKED',
      chunkCount: chunks.length,
      queues,
      total: queuePerformanceMetrics(
        totalAccumulator,
        totalAccumulator.enteredCalls,
        totalCallerCounts,
      ),
    };
  }

  async queuePerformanceDetailChunk(
    pbxInstanceId: PbxInstanceId,
    queueIds: readonly string[],
    from: string,
    to: string,
    reportTo: string,
  ): Promise<HistoricalQueueCallDetailChunk> {
    const validatedQueueIds = validateQueueIds(queueIds);
    const entryWindow = validateReportWindow(from, to);
    const normalizedReportTo = normalizeSourceLocalDateTime(reportTo);
    const entryFromMs = sourceLocalMillis(entryWindow.from);
    const entryToMs = sourceLocalMillis(entryWindow.to);
    const reportToMs = sourceLocalMillis(normalizedReportTo);
    if (
      entryToMs > reportToMs ||
      entryToMs - entryFromMs > QUEUE_DETAIL_CHUNK_MAX_MS ||
      reportToMs - entryFromMs > MAX_QUEUE_REPORT_DAYS * 24 * 60 * 60 * 1000
    ) {
      throw new HistoricalSourceSchemaError('INVALID_RANGE');
    }
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.queuePerformance);
    const selected = new Set(validatedQueueIds);
    const inclusiveEntryEnd = entryWindow.to === normalizedReportTo;
    const entryRows = await queryAdaptiveRows(
      this.options.transport,
      pbxInstanceId,
      entryWindow,
      inclusiveEntryEnd,
      (queryWindow, inclusiveEnd) =>
        queueDetailEntryCountQuery(
          inspection.config.dialect,
          table,
          queryWindow,
          validatedQueueIds,
          inclusiveEnd,
        ),
      (queryWindow, inclusiveEnd) =>
        queueDetailEntryQuery(
          inspection.config.dialect,
          table,
          queryWindow,
          validatedQueueIds,
          inclusiveEnd,
        ),
    );
    if (entryRows.length > MAX_QUEUE_DETAIL_ITEMS_PER_CHUNK) {
      throw new HistoricalSourceSchemaError('EXPORT_TOO_LARGE');
    }

    const details = new Map<string, HistoricalQueueCallDetail>();
    for (const row of entryRows) {
      const queueId = boundedText(row.queue_id, 128)!;
      if (!selected.has(queueId)) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
      const callId = boundedText(row.call_id, 128)!;
      const key = queueDetailKey(queueId, callId);
      if (details.has(key)) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
      const callerNumber = boundedText(row.caller_number, 128, false);
      const initialPosition = optionalNonNegativeInteger(row.initial_position);
      details.set(key, {
        queueId,
        callId,
        ...(callerNumber ? { callerNumber } : {}),
        enteredAt: boundedText(row.entered_at, 64)!,
        ...(initialPosition === undefined ? {} : { initialPosition }),
        outcome: 'UNRESOLVED',
      });
    }

    if (details.size > 0) {
      const outcomeToMs = Math.min(reportToMs, entryToMs + QUEUE_DETAIL_OUTCOME_LOOKAHEAD_MS);
      const outcomeWindow = reportWindowFromMillis(entryFromMs, outcomeToMs);
      await queryAdaptiveConsume(
        this.options.transport,
        pbxInstanceId,
        outcomeWindow,
        outcomeToMs === reportToMs,
        (queryWindow, inclusiveEnd) =>
          queueDetailOutcomeCountQuery(
            inspection.config.dialect,
            table,
            queryWindow,
            validatedQueueIds,
            inclusiveEnd,
          ),
        (queryWindow, inclusiveEnd) =>
          queueDetailOutcomeQuery(
            inspection.config.dialect,
            table,
            queryWindow,
            validatedQueueIds,
            inclusiveEnd,
          ),
        (rows) => {
          for (const row of rows) {
            const queueId = boundedText(row.queue_id, 128)!;
            if (!selected.has(queueId)) throw new HistoricalSourceSchemaError('INVALID_SOURCE_ROW');
            const callId = boundedText(row.call_id, 128)!;
            const detail = details.get(queueDetailKey(queueId, callId));
            if (detail) applyDetailOutcome(detail, row);
          }
        },
      );
    }

    const items = [...details.values()].sort(
      (left, right) =>
        left.enteredAt.localeCompare(right.enteredAt) ||
        left.queueId.localeCompare(right.queueId) ||
        left.callId.localeCompare(right.callId),
    );
    return {
      instanceId: pbxInstanceId,
      source: 'DATABASE',
      from: entryWindow.from,
      to: entryWindow.to,
      reportTo: normalizedReportTo,
      queueIds: validatedQueueIds,
      items,
    };
  }

  async listRecentCalls(
    pbxInstanceId: PbxInstanceId,
    limit = 100,
  ): Promise<readonly HistoricalCallRecord[]> {
    const validatedLimit = validateLimit(limit);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.calls);
    const result = await this.options.transport.query(
      pbxInstanceId,
      callQuery(inspection.config.dialect, table),
      historyLimits(validatedLimit),
    );
    return result.rows.map((row) => parseCall(pbxInstanceId, row));
  }

  async listRecentCallEvents(
    pbxInstanceId: PbxInstanceId,
    limit = 100,
  ): Promise<readonly HistoricalCallEventRecord[]> {
    const validatedLimit = validateLimit(limit);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.callEvents);
    const result = await this.options.transport.query(
      pbxInstanceId,
      callEventQuery(inspection.config.dialect, table),
      historyLimits(validatedLimit),
    );
    return result.rows.map((row) => parseCallEvent(pbxInstanceId, row));
  }

  async listRecentQueueEvents(
    pbxInstanceId: PbxInstanceId,
    limit = 100,
  ): Promise<readonly HistoricalQueueEventRecord[]> {
    const validatedLimit = validateLimit(limit);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.queueEvents);
    const result = await this.options.transport.query(
      pbxInstanceId,
      queueEventQuery(inspection.config.dialect, table),
      historyLimits(validatedLimit),
    );
    return result.rows.map((row) => parseQueueEvent(pbxInstanceId, row));
  }

  private async inspectInternal(pbxInstanceId: PbxInstanceId): Promise<Inspection> {
    const config = this.options.configuration.get(pbxInstanceId);
    if (!config) throw new HistoricalSourceSchemaError('NOT_CONFIGURED');
    const result = await this.options.transport.query(
      pbxInstanceId,
      schemaInspectionQuery(config.dialect, config.databaseName, config.databaseScopes),
      historyLimits(500),
    );
    const tables = tableGroups(result.rows);
    return {
      config,
      calls: inspectDataset(tables, DATASETS.calls),
      callEvents: inspectDataset(tables, DATASETS.callEvents),
      queueEvents: inspectDataset(tables, DATASETS.queueEvents),
      queueAbandonment: inspectDataset(tables, DATASETS.queueAbandonment),
      queuePerformance: inspectDataset(tables, DATASETS.queuePerformance),
    };
  }

  private requireDataset(dataset: InspectedDataset): SourceTable {
    if (dataset.availability !== 'SUPPORTED' || !dataset.table) {
      throw new HistoricalSourceSchemaError('DATASET_UNAVAILABLE');
    }
    return dataset.table;
  }
}
