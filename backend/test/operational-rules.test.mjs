import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCoreOperationalRules } from '../dist/operational-rules.js';
const dimensions = [
  'PROVIDER',
  'TELEPHONY',
  'TRUNKS',
  'ENDPOINTS',
  'QUEUES',
  'SYSTEM',
  'SECURITY',
  'CALL_QUALITY',
];
const healthy = (dimension) => ({ dimension, state: 'HEALTHY', reasons: [] });
const snapshot = (overrides = {}) => ({
  instanceId: 'pbx-01',
  overall: 'CRITICAL',
  components: Object.fromEntries(dimensions.map((d) => [d, overrides[d] ?? healthy(d)])),
});
const at = '2026-10-10T11:00:00.000Z';
test('critical provider disconnect emits a scoped safe observation', () => {
  const h = snapshot({
    PROVIDER: {
      dimension: 'PROVIDER',
      state: 'CRITICAL',
      reasons: [{ code: 'PROVIDER_DISCONNECTED' }],
    },
  });
  const a = evaluateCoreOperationalRules(h, at);
  assert.equal(a.length, 1);
  assert.equal(a[0].ruleId, 'PBX_DISCONNECTED');
  assert.equal(a[0].severity, 'CRITICAL');
  assert.equal(a[0].entity.id, 'pbx-01');
});
test('high CPU and waiting queue emit verified aggregate rule observations', () => {
  const h = snapshot({
    SYSTEM: {
      dimension: 'SYSTEM',
      state: 'DEGRADED',
      reasons: [{ code: 'SYSTEM_CPU_HIGH', value: 87 }],
    },
    QUEUES: {
      dimension: 'QUEUES',
      state: 'DEGRADED',
      reasons: [{ code: 'QUEUE_WAITING', count: 2 }],
    },
  });
  const a = evaluateCoreOperationalRules(h, at);
  assert.deepEqual(a.map((i) => i.ruleId).sort(), ['CPU_HIGH', 'QUEUE_WAITING']);
  assert.equal(a.find((i) => i.ruleId === 'CPU_HIGH').evidence.value, 87);
});
test('unknown stale and unrecognized evidence never produces a false alert', () => {
  const h = snapshot({
    SYSTEM: {
      dimension: 'SYSTEM',
      state: 'STALE',
      reasons: [{ code: 'SYSTEM_CPU_CRITICAL', value: 100 }],
    },
    TRUNKS: {
      dimension: 'TRUNKS',
      state: 'UNKNOWN',
      reasons: [{ code: 'TRUNK_FAILED', count: 10 }],
    },
    CALL_QUALITY: {
      dimension: 'CALL_QUALITY',
      state: 'CRITICAL',
      reasons: [{ code: 'CALL_QUALITY_UNAVAILABLE' }],
    },
  });
  assert.deepEqual(evaluateCoreOperationalRules(h, at), []);
});
test('rejects non finite or negative measurements rather than emitting alerts', () => {
  const h = snapshot({
    SYSTEM: {
      dimension: 'SYSTEM',
      state: 'CRITICAL',
      reasons: [
        { code: 'SYSTEM_CPU_CRITICAL', value: NaN },
        { code: 'SYSTEM_MEMORY_CRITICAL', value: -1 },
      ],
    },
  });
  assert.deepEqual(evaluateCoreOperationalRules(h, at), []);
});
