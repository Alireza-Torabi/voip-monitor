import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadOnlyDatabaseSourceVerifier } from '../dist/database/verification.js';
import { DatabaseSourceConfigurationError } from '../dist/database/configuration.js';

const PBX_ID = 'synthetic-pbx';

function candidate(overrides = {}) {
  return {
    dialect: 'MYSQL_MARIADB',
    host: 'db.example.test',
    port: 3306,
    databaseName: 'pbx_reporting',
    username: 'readonly_monitor',
    credential: 'synthetic-value',
    accessMode: 'READ_ONLY',
    tlsMode: 'REQUIRED',
    ...overrides,
  };
}

test('database verifier uses submitted candidate and bounded read-only query', async () => {
  const calls = [];
  const adapter = {
    async execute(target, credential, query) {
      calls.push({
        target,
        credential: credential.toString(),
        statement: query.statement,
        limits: query.limits,
      });
      return [{ verification_value: 1 }];
    },
  };
  const verifier = new ReadOnlyDatabaseSourceVerifier(
    { resolve: async () => ['203.0.113.10'] },
    undefined,
    { MYSQL_MARIADB: adapter },
  );

  await verifier.verify(PBX_ID, candidate());

  assert.equal(calls.length, 1);
  assert.equal(calls[0].target.host, 'db.example.test');
  assert.equal(calls[0].target.address, '203.0.113.10');
  assert.equal(calls[0].target.databaseName, 'pbx_reporting');
  assert.equal(calls[0].target.username, 'readonly_monitor');
  assert.equal(calls[0].target.tlsMode, 'REQUIRED');
  assert.equal(calls[0].credential, 'synthetic-value');
  assert.match(calls[0].statement, /^SELECT 1 AS verification_value LIMIT \?/u);
  assert.deepEqual(calls[0].limits, { timeoutMs: 5000, maxRows: 1, maxOutputBytes: 1024 });
});

test('database verifier rejects malformed candidate before resolver or driver work', async () => {
  let resolved = false;
  const verifier = new ReadOnlyDatabaseSourceVerifier({
    resolve: async () => {
      resolved = true;
      return ['203.0.113.10'];
    },
  });

  await assert.rejects(
    verifier.verify(PBX_ID, candidate({ databaseName: '' })),
    (error) => error instanceof DatabaseSourceConfigurationError && error.code === 'INVALID_INPUT',
  );
  assert.equal(resolved, false);
});
