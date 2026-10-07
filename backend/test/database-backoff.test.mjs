import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseConnectionBackoff } from '../dist/database/backoff.js';
import { DatabaseQueryError } from '../dist/database/query.js';

const PBX_ID = 'synthetic-pbx';

test('database connection backoff escalates bounded delays and resets after success', () => {
  let now = 1_000;
  const backoff = new DatabaseConnectionBackoff(() => now);

  backoff.assertAllowed(PBX_ID);
  backoff.recordFailure(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 30_000);
  assert.throws(
    () => backoff.assertAllowed(PBX_ID),
    (error) => error instanceof DatabaseQueryError && error.code === 'BACKOFF',
  );

  now += 30_000;
  backoff.assertAllowed(PBX_ID);
  backoff.recordFailure(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 60_000);

  now += 60_000;
  backoff.recordFailure(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 120_000);
  now += 120_000;
  backoff.recordFailure(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 300_000);
  now += 300_000;
  backoff.recordFailure(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 300_000);

  backoff.recordSuccess(PBX_ID);
  assert.equal(backoff.remainingMs(PBX_ID), 0);
  backoff.assertAllowed(PBX_ID);
});
