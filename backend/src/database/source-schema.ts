import type {
  HistoricalCallDisposition,
  HistoricalCallOutcomeAnalytics,
  HistoricalCallOutcomeRange,
  HistoricalCallEventRecord,
  HistoricalCallEventType,
  HistoricalCallRecord,
  HistoricalDatasetAvailability,
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
const CALL_OUTCOME_RANGES: readonly HistoricalCallOutcomeRange[] = ['1H', '24H', '7D', '30D'];

const DATASETS = {
  calls: {
    table: 'cdr',
    required: ['calldate', 'src', 'dst', 'duration', 'billsec', 'disposition', 'uniqueid'],
    optional: ['linkedid'],
  },
  callEvents: {
    table: 'cel',
    required: ['eventtime', 'eventtype', 'uniqueid'],
    optional: ['linkedid', 'exten', 'cid_num'],
  },
  queueEvents: {
    table: 'queue_log',
    required: ['time', 'callid', 'queuename', 'agent', 'event'],
    optional: [],
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
}

export type HistoricalSourceSchemaErrorCode =
  | 'NOT_CONFIGURED'
  | 'DATASET_UNAVAILABLE'
  | 'INVALID_SOURCE_ROW'
  | 'INVALID_LIMIT'
  | 'INVALID_RANGE';

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

function validateCallOutcomeRange(range: string): HistoricalCallOutcomeRange {
  if (!CALL_OUTCOME_RANGES.includes(range as HistoricalCallOutcomeRange)) {
    throw new HistoricalSourceSchemaError('INVALID_RANGE');
  }
  return range as HistoricalCallOutcomeRange;
}

function validateLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_HISTORY_ROWS) {
    throw new HistoricalSourceSchemaError('INVALID_LIMIT');
  }
  return limit;
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
): ReadOnlyDatabaseQuery {
  const tableNames = [DATASETS.calls.table, DATASETS.callEvents.table, DATASETS.queueEvents.table];
  if (dialect === 'MYSQL_MARIADB') {
    return {
      sql: `SELECT table_schema, table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = ?
              AND table_name IN (?, ?, ?)
            ORDER BY table_name, ordinal_position`,
      parameters: [databaseName, ...tableNames],
    };
  }
  return {
    sql: `SELECT table_schema, table_name, column_name
          FROM information_schema.columns
          WHERE table_catalog = ?
            AND table_name IN (?, ?, ?)
            AND table_schema <> ?
            AND table_schema <> ?
          ORDER BY table_schema, table_name, ordinal_position`,
    parameters: [databaseName, ...tableNames, 'pg_catalog', 'information_schema'],
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
  const candidates = tables.filter((table) => table.table.toLowerCase() === dataset.table);
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
          ORDER BY ${calldate} DESC, ${uniqueid} DESC`,
  };
}

function callOutcomeRangeStart(
  dialect: DatabaseDialect,
  range: HistoricalCallOutcomeRange,
): string {
  const mysql = { '1H': '1 HOUR', '24H': '24 HOUR', '7D': '7 DAY', '30D': '30 DAY' } as const;
  const postgres = {
    '1H': "INTERVAL '1 hour'",
    '24H': "INTERVAL '24 hours'",
    '7D': "INTERVAL '7 days'",
    '30D': "INTERVAL '30 days'",
  } as const;
  return dialect === 'MYSQL_MARIADB'
    ? `CURRENT_TIMESTAMP - INTERVAL ${mysql[range]}`
    : `CURRENT_TIMESTAMP - ${postgres[range]}`;
}

function callOutcomeQuery(
  dialect: DatabaseDialect,
  table: SourceTable,
  range: HistoricalCallOutcomeRange,
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
          WHERE ${calldate} >= ${callOutcomeRangeStart(dialect, range)}`,
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
  range: HistoricalCallOutcomeRange,
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
    range,
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
    };
  }

  async callOutcomeAnalytics(
    pbxInstanceId: PbxInstanceId,
    range: string,
  ): Promise<HistoricalCallOutcomeAnalytics> {
    const validatedRange = validateCallOutcomeRange(range);
    const inspection = await this.inspectInternal(pbxInstanceId);
    const table = this.requireDataset(inspection.calls);
    const result = await this.options.transport.query(
      pbxInstanceId,
      callOutcomeQuery(inspection.config.dialect, table, validatedRange),
      historyLimits(1),
    );
    return parseCallOutcomeAnalytics(pbxInstanceId, validatedRange, result.rows[0]);
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
      schemaInspectionQuery(config.dialect, config.databaseName),
      historyLimits(200),
    );
    const tables = tableGroups(result.rows);
    return {
      config,
      calls: inspectDataset(tables, DATASETS.calls),
      callEvents: inspectDataset(tables, DATASETS.callEvents),
      queueEvents: inspectDataset(tables, DATASETS.queueEvents),
    };
  }

  private requireDataset(dataset: InspectedDataset): SourceTable {
    if (dataset.availability !== 'SUPPORTED' || !dataset.table) {
      throw new HistoricalSourceSchemaError('DATASET_UNAVAILABLE');
    }
    return dataset.table;
  }
}
