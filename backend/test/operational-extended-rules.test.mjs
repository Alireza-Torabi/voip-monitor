import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExtendedOperationalRules } from '../dist/operational-rules.js';
const at = '2026-10-10T12:00:00.000Z';
const date = (s) => new Date(Date.parse(at) - s * 1000).toISOString();
const state = (x = {}) => ({
  instanceId: 'pbx',
  synchronization: 'CURRENT',
  endpointCapability: 'SUPPORTED',
  endpointSynchronization: 'CURRENT',
  endpoints: [],
  queueCapability: 'SUPPORTED',
  queueSynchronization: 'CURRENT',
  queues: [],
  channels: [],
  ...x,
});
const metric = (value, unit) => ({ availability: 'AVAILABLE', value, unit });
const quality = (time, loss, rtt) => ({
  instanceId: 'pbx',
  direction: 'RECEIVED',
  legId: 'legA',
  observedAt: date(time),
  packetLossPercent: metric(loss, 'PERCENT'),
  rtt: metric(rtt, 'MILLISECONDS'),
});
test('endpoint flapping requires three recent known-state transitions', () => {
  const transitions = [60, 120, 180].map((s, i) => ({
    observedAt: date(s),
    from: i % 2 ? 'OFFLINE' : 'ONLINE',
    to: i % 2 ? 'ONLINE' : 'OFFLINE',
  }));
  const t = state({
    endpoints: [{ endpointId: 'PJSIP/100', reliability: { recentTransitions: transitions } }],
  });
  assert.equal(evaluateExtendedOperationalRules('pbx', at, t, [])[0].ruleId, 'ENDPOINT_FLAPPING');
  assert.equal(
    evaluateExtendedOperationalRules(
      'pbx',
      at,
      state({
        endpoints: [
          { endpointId: 'PJSIP/100', reliability: { recentTransitions: transitions.slice(0, 2) } },
        ],
      }),
      [],
    ).length,
    0,
  );
});
test('queue thresholds 5 warning 15 critical, no fabricated alert for four', () => {
  const alerts = evaluateExtendedOperationalRules(
    'pbx',
    at,
    state({
      queues: [
        { queueId: 'q1', waitingCount: 4 },
        { queueId: 'q2', waitingCount: 5 },
        { queueId: 'q3', waitingCount: 20 },
      ],
    }),
    [],
  );
  assert.deepEqual(
    alerts.map((a) => a.ruleId),
    ['QUEUE_PRESSURE_HIGH', 'QUEUE_PRESSURE_CRITICAL'],
  );
});
test('quality needs distinct recent reports with validated metrics', () => {
  const alerts = evaluateExtendedOperationalRules('pbx', at, state(), [
    quality(10, 12, 350),
    quality(30, 11, 320),
  ]);
  assert.deepEqual(
    alerts.map((a) => a.ruleId),
    ['CALL_PACKET_LOSS_HIGH', 'CALL_RTT_HIGH'],
  );
  assert.deepEqual(
    evaluateExtendedOperationalRules('pbx', at, state(), [quality(10, 12, 350)]),
    [],
  );
  assert.deepEqual(
    evaluateExtendedOperationalRules('pbx', at, state(), [
      quality(10, 12, 350),
      quality(10, 12, 350),
    ]),
    [],
  );
});
test('stale telephony or unsupported source suppresses derived alerts', () => {
  const t = state({ synchronization: 'STALE', queues: [{ queueId: 'q', waitingCount: 50 }] });
  assert.deepEqual(
    evaluateExtendedOperationalRules('pbx', at, t, [quality(10, 20, 600), quality(20, 20, 600)]),
    [],
  );
});
