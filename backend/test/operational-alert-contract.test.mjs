import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionableOperationalAlert,
  operationalAlertFingerprint,
  validateOperationalAlertObservation,
} from '../../shared/dist/index.js';

const base = {
  schemaVersion: 1,
  instanceId: 'pbx-01',
  ruleId: 'PBX_DISCONNECTED',
  dimension: 'PROVIDER',
  severity: 'CRITICAL',
  entity: { kind: 'PBX', id: 'pbx-01' },
  reasonCode: 'PBX_DISCONNECTED',
  observedAt: '2026-10-10T10:00:00.000Z',
  evidence: { availability: 'AVAILABLE' },
};

test('verified source-neutral alert observation is actionable without persistence', () => {
  assert.equal(validateOperationalAlertObservation(base), true);
  assert.deepEqual(actionableOperationalAlert(base), base);
});

test('missing unsupported and stale evidence cannot become active alerts', () => {
  for (const availability of ['UNKNOWN', 'UNSUPPORTED', 'STALE']) {
    const observation = { ...base, evidence: { availability, reason: 'NO_METRIC' } };
    assert.equal(validateOperationalAlertObservation(observation), true);
    assert.equal(actionableOperationalAlert(observation), undefined);
  }
});

test('reject non-finite values and unbounded or unsafe machine fields', () => {
  for (const bad of [
    { ...base, evidence: { availability: 'AVAILABLE', value: NaN } },
    { ...base, evidence: { availability: 'AVAILABLE', value: Infinity } },
    { ...base, ruleId: 'password=secret and newline\n' },
    { ...base, reasonCode: 'raw caller +1234' },
    { ...base, entity: { kind: 'PBX', id: 'x'.repeat(256) } },
    { ...base, observedAt: 'yesterday' },
  ]) {
    assert.equal(validateOperationalAlertObservation(bad), false);
    assert.equal(actionableOperationalAlert(bad), undefined);
  }
});

test('fingerprint separates PBXs, entities and rules without using severity', () => {
  const id = operationalAlertFingerprint(base);
  assert.equal(id, operationalAlertFingerprint({ ...base, severity: 'INFO' }));
  assert.notEqual(id, operationalAlertFingerprint({ ...base, instanceId: 'pbx-02' }));
  assert.notEqual(id, operationalAlertFingerprint({ ...base, ruleId: 'SOME_OTHER_RULE' }));
  assert.notEqual(
    id,
    operationalAlertFingerprint({ ...base, entity: { kind: 'TRUNK', id: 't1' } }),
  );
});
