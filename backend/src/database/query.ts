import { Buffer } from 'node:buffer';
import type { DatabaseDialect } from '../storage/index.js';

export type DatabaseParameter = string | number | boolean | null;

export interface ReadOnlyDatabaseQuery {
  sql: string;
  parameters?: readonly DatabaseParameter[];
}

export interface DatabaseQueryLimits {
  timeoutMs: number;
  maxRows: number;
  maxOutputBytes: number;
}

export const DEFAULT_DATABASE_QUERY_LIMITS: Readonly<DatabaseQueryLimits> = Object.freeze({
  timeoutMs: 5_000,
  maxRows: 200,
  maxOutputBytes: 512 * 1024,
});

const MAX_QUERY_BYTES = 64 * 1024;
const MAX_PARAMETERS = 256;
const MAX_PARAMETER_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 30_000;
const MAX_ROWS = 1_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export type DatabaseQueryErrorCode =
  | 'INVALID_QUERY'
  | 'NOT_CONFIGURED'
  | 'PERMISSION_DENIED'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'ROW_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'UNSUPPORTED_VALUE'
  | 'QUERY_FAILED';

export class DatabaseQueryError extends Error {
  constructor(readonly code: DatabaseQueryErrorCode) {
    super(`Database query ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'DatabaseQueryError';
  }
}

export interface PreparedReadOnlyQuery {
  statement: string;
  parameters: readonly DatabaseParameter[];
  limits: DatabaseQueryLimits;
}

function invalidQuery(): never {
  throw new DatabaseQueryError('INVALID_QUERY');
}

function validateLimits(limits: DatabaseQueryLimits): DatabaseQueryLimits {
  if (
    !Number.isSafeInteger(limits.timeoutMs) ||
    limits.timeoutMs <= 0 ||
    limits.timeoutMs > MAX_TIMEOUT_MS ||
    !Number.isSafeInteger(limits.maxRows) ||
    limits.maxRows <= 0 ||
    limits.maxRows > MAX_ROWS ||
    !Number.isSafeInteger(limits.maxOutputBytes) ||
    limits.maxOutputBytes <= 0 ||
    limits.maxOutputBytes > MAX_OUTPUT_BYTES
  ) {
    invalidQuery();
  }
  return { ...limits };
}

function validateParameter(value: DatabaseParameter): void {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) invalidQuery();
    return;
  }
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_PARAMETER_BYTES) invalidQuery();
    return;
  }
  invalidQuery();
}

interface SqlScan {
  code: string;
  placeholderCount: number;
}

function scanSql(sql: string): SqlScan {
  if (!sql.trim() || Buffer.byteLength(sql, 'utf8') > MAX_QUERY_BYTES) invalidQuery();

  let state: 'CODE' | 'SINGLE' | 'DOUBLE' | 'BACKTICK' = 'CODE';
  let code = '';
  let placeholderCount = 0;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];

    if (state === 'CODE') {
      if (character === ';') invalidQuery();
      if (character === '-' && next === '-') invalidQuery();
      if (character === '/' && next === '*') invalidQuery();
      if (character === '#') invalidQuery();

      if (character === "'") {
        state = 'SINGLE';
        code += ' ';
        continue;
      }
      if (character === '"') {
        state = 'DOUBLE';
        code += ' ';
        continue;
      }
      if (character === '`') {
        state = 'BACKTICK';
        code += ' ';
        continue;
      }
      if (character === '?') placeholderCount += 1;
      code += character;
      continue;
    }

    const quote = state === 'SINGLE' ? "'" : state === 'DOUBLE' ? '"' : '`';
    if (character !== quote) {
      code += ' ';
      continue;
    }
    if (next === quote) {
      code += '  ';
      index += 1;
      continue;
    }
    state = 'CODE';
    code += ' ';
  }

  if (state !== 'CODE') invalidQuery();
  return { code, placeholderCount };
}

function assertSelectOnly(sql: string): number {
  const scan = scanSql(sql);
  const code = scan.code.trim();
  if (!/^SELECT(?:\s|$)/iu.test(code)) invalidQuery();

  const forbidden =
    /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE|MERGE|REPLACE|LOAD|LOCK|UNLOCK|SET|RESET|INTO|PROCEDURE)\b/iu;
  if (forbidden.test(code)) invalidQuery();
  if (/\bFOR\s+(?:UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b/iu.test(code)) invalidQuery();
  if (/\bLOCK\s+IN\s+SHARE\s+MODE\b/iu.test(code)) invalidQuery();

  return scan.placeholderCount;
}

function postgresPlaceholders(sql: string): string {
  let state: 'CODE' | 'SINGLE' | 'DOUBLE' | 'BACKTICK' = 'CODE';
  let nextPlaceholder = 1;
  let output = '';

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];

    if (state === 'CODE') {
      if (character === "'") state = 'SINGLE';
      else if (character === '"') state = 'DOUBLE';
      else if (character === '`') state = 'BACKTICK';
      if (character === '?') output += `$${nextPlaceholder++}`;
      else output += character;
      continue;
    }

    output += character;
    const quote = state === 'SINGLE' ? "'" : state === 'DOUBLE' ? '"' : '`';
    if (character === quote) {
      if (next === quote) {
        output += next;
        index += 1;
      } else {
        state = 'CODE';
      }
    }
  }
  return output;
}

export function prepareReadOnlyQuery(
  dialect: DatabaseDialect,
  query: ReadOnlyDatabaseQuery,
  limits: DatabaseQueryLimits = DEFAULT_DATABASE_QUERY_LIMITS,
): PreparedReadOnlyQuery {
  const validatedLimits = validateLimits(limits);
  const parameters = [...(query.parameters ?? [])];
  if (parameters.length > MAX_PARAMETERS) invalidQuery();
  parameters.forEach(validateParameter);

  const placeholders = assertSelectOnly(query.sql);
  if (placeholders !== parameters.length) invalidQuery();

  const boundedSql = `SELECT * FROM (${query.sql.trim()}) AS vm_source_query LIMIT ?`;
  const boundedParameters = [...parameters, validatedLimits.maxRows + 1];

  return {
    statement: dialect === 'POSTGRESQL' ? postgresPlaceholders(boundedSql) : boundedSql,
    parameters: boundedParameters,
    limits: validatedLimits,
  };
}

export type DatabaseResultValue = string | number | boolean | null;
export type DatabaseResultRow = Readonly<Record<string, DatabaseResultValue>>;

function normalizeValue(value: unknown): DatabaseResultValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new DatabaseQueryError('UNSUPPORTED_VALUE');
}

export function normalizeDatabaseRows(
  rows: readonly Record<string, unknown>[],
  limits: DatabaseQueryLimits,
): DatabaseResultRow[] {
  if (rows.length > limits.maxRows) throw new DatabaseQueryError('ROW_LIMIT');

  const normalized: DatabaseResultRow[] = [];
  let totalBytes = 2;

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new DatabaseQueryError('UNSUPPORTED_VALUE');
    }
    const next: Record<string, DatabaseResultValue> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key || key.length > 256) throw new DatabaseQueryError('UNSUPPORTED_VALUE');
      next[key] = normalizeValue(value);
    }

    const encoded = JSON.stringify(next);
    totalBytes += Buffer.byteLength(encoded, 'utf8') + 1;
    if (totalBytes > limits.maxOutputBytes) throw new DatabaseQueryError('OUTPUT_LIMIT');
    normalized.push(Object.freeze(next));
  }

  return normalized;
}
