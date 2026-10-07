import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import {
  DatabaseQueryError,
  normalizeDatabaseRows,
  prepareReadOnlyQuery,
} from '../dist/database/query.js';

const limits = { timeoutMs: 1000, maxRows: 2, maxOutputBytes: 1024 };

test('read-only query preparation accepts one bounded SELECT and converts PostgreSQL placeholders', () => {
  const query = {
    sql: 'SELECT linkedid, disposition FROM cdr WHERE calldate >= ? AND calldate < ? ORDER BY calldate DESC',
    parameters: ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'],
  };

  const mysql = prepareReadOnlyQuery('MYSQL_MARIADB', query, limits);
  assert.equal(
    mysql.statement,
    'SELECT linkedid, disposition FROM cdr WHERE calldate >= ? AND calldate < ? ORDER BY calldate DESC LIMIT ?',
  );
  assert.deepEqual(mysql.parameters, ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', 3]);

  const postgres = prepareReadOnlyQuery('POSTGRESQL', query, limits);
  assert.equal(
    postgres.statement,
    'SELECT linkedid, disposition FROM cdr WHERE calldate >= $1 AND calldate < $2 ORDER BY calldate DESC LIMIT $3',
  );
  assert.deepEqual(postgres.parameters, mysql.parameters);
});

test('read-only query preparation rejects mutation, multi-statement, comments, locking and SELECT INTO', () => {
  const rejected = [
    'UPDATE cdr SET disposition = ?',
    'DELETE FROM cdr',
    'WITH changed AS (DELETE FROM cdr RETURNING *) SELECT * FROM changed',
    'SELECT * FROM cdr; DELETE FROM cdr',
    'SELECT * FROM cdr -- trailing comment',
    'SELECT * FROM cdr /* comment */',
    'SELECT * INTO cdr_copy FROM cdr',
    'SELECT * FROM cdr FOR UPDATE',
    'SELECT * FROM cdr LOCK IN SHARE MODE',
  ];

  for (const sql of rejected) {
    assert.throws(
      () => prepareReadOnlyQuery('MYSQL_MARIADB', { sql }, limits),
      (error) => error instanceof DatabaseQueryError && error.code === 'INVALID_QUERY',
      sql,
    );
  }
});

test('read-only query preparation treats quoted text as data and validates parameters and limits', () => {
  const prepared = prepareReadOnlyQuery(
    'POSTGRESQL',
    { sql: "SELECT 'DROP TABLE x; -- still data' AS label, ? AS value", parameters: ['ok'] },
    limits,
  );
  assert.match(prepared.statement, /DROP TABLE x; -- still data/u);

  assert.throws(
    () =>
      prepareReadOnlyQuery(
        'POSTGRESQL',
        { sql: 'SELECT ? AS a, ? AS b', parameters: ['only-one'] },
        limits,
      ),
    (error) => error instanceof DatabaseQueryError && error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () =>
      prepareReadOnlyQuery(
        'POSTGRESQL',
        { sql: 'SELECT ? AS unsafe', parameters: [Number.MAX_VALUE] },
        limits,
      ),
    (error) => error instanceof DatabaseQueryError && error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () =>
      prepareReadOnlyQuery(
        'POSTGRESQL',
        { sql: 'SELECT 1 AS value' },
        { timeoutMs: 0, maxRows: 2, maxOutputBytes: 1024 },
      ),
    (error) => error instanceof DatabaseQueryError && error.code === 'INVALID_QUERY',
  );
});

test('normalized rows enforce row, output and JSON-safe value bounds', () => {
  assert.deepEqual(
    normalizeDatabaseRows(
      [
        { id: '1', duration: 10, answered: true, optional: null },
        { id: '2', duration: 20, answered: false, optional: null },
      ],
      limits,
    ),
    [
      { id: '1', duration: 10, answered: true, optional: null },
      { id: '2', duration: 20, answered: false, optional: null },
    ],
  );

  assert.throws(
    () => normalizeDatabaseRows([{ id: 1 }, { id: 2 }, { id: 3 }], limits),
    (error) => error instanceof DatabaseQueryError && error.code === 'ROW_LIMIT',
  );
  assert.throws(
    () =>
      normalizeDatabaseRows([{ large: 'x'.repeat(1024) }], {
        timeoutMs: 1000,
        maxRows: 2,
        maxOutputBytes: 100,
      }),
    (error) => error instanceof DatabaseQueryError && error.code === 'OUTPUT_LIMIT',
  );
  assert.throws(
    () => normalizeDatabaseRows([{ binary: Buffer.from('not-json-safe') }], limits),
    (error) => error instanceof DatabaseQueryError && error.code === 'UNSUPPORTED_VALUE',
  );
});
