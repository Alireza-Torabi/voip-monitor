import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OperationalAlertLifecycle } from '../dist/operational-alert-lifecycle.js';
const observation = {
  schemaVersion: 1,
  instanceId: 'pbx',
  ruleId: 'CPU_HIGH',
  dimension: 'SYSTEM',
  severity: 'WARNING',
  entity: { kind: 'HOST', id: 'pbx' },
  reasonCode: 'SYSTEM_CPU_HIGH',
  observedAt: '2026-10-10T10:00:00.000Z',
  evidence: { availability: 'AVAILABLE', value: 88, unit: 'PERCENT' },
};
test('deduplicates observations and supports ACK and silence expiry', () => {
  let at = Date.parse('2026-10-10T10:00:00.000Z');
  const l = new OperationalAlertLifecycle(() => at);
  let [alert] = l.reconcile('pbx', [observation]);
  assert.equal(alert.state, 'ACTIVE');
  assert.equal(l.update('pbx', alert.fingerprint, 'ACKNOWLEDGE'), true);
  at += 1000;
  [alert] = l.reconcile('pbx', [observation]);
  assert.equal(alert.state, 'ACKNOWLEDGED');
  assert.equal(alert.occurrences, 2);
  assert.equal(l.update('pbx', alert.fingerprint, 'SILENCE', 1), true);
  at += 61000;
  [alert] = l.reconcile('pbx', [observation]);
  assert.equal(alert.state, 'ACTIVE');
});
test('stale absence auto-resolves after delay and refuses cross-PBX update', () => {
  let at = Date.parse('2026-10-10T10:00:00.000Z');
  const l = new OperationalAlertLifecycle(() => at);
  const [alert] = l.reconcile('pbx', [observation]);
  assert.equal(l.update('other', alert.fingerprint, 'ACKNOWLEDGE'), false);
  at += 61000;
  assert.equal(l.reconcile('pbx', [])[0].state, 'RESOLVED');
  assert.equal(l.update('pbx', alert.fingerprint, 'ACKNOWLEDGE'), false);
});
test('rejects unbounded silence and suppresses unrelated missing evidence', () => {
  const l = new OperationalAlertLifecycle();
  const [alert] = l.reconcile('pbx', [observation]);
  assert.equal(l.update('pbx', alert.fingerprint, 'SILENCE', 999999), false);
  const unknown = { ...observation, evidence: { availability: 'UNKNOWN', reason: 'MISSING' } };
  assert.equal(l.reconcile('pbx', [unknown])[0].occurrences, 1);
});
