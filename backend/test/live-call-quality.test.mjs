import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LiveQualityStore } from '../dist/providers/runtime/live-quality.js';

function rtcp(leg, jitter = '20') {
  return {
    event: 'RTCPReceived',
    fields: {
      Uniqueid: leg,
      Linkedid: 'call-a',
      ReportCount: '1',
      Report0SourceSSRC: '44',
      Report0IAJitter: jitter,
    },
  };
}
test('live quality accepts only active legs and does not invent missing values', () => {
  let now = Date.parse('2026-10-09T10:00:00Z');
  const store = new LiveQualityStore(() => now);
  store.observe('pbx-a', rtcp('leg-1'));
  assert.equal(store.current('pbx-a', new Set(['leg-1'])).length, 1);
  assert.equal(store.current('pbx-b', new Set(['leg-1'])).length, 0);
  assert.equal(store.current('pbx-a', new Set(['unrelated'])).length, 0);
  assert.equal(
    store.current('pbx-a', new Set(['leg-1']))[0].packetLossPercent.availability,
    'UNKNOWN',
  );
  now += 120_001;
  assert.equal(store.current('pbx-a', new Set(['leg-1'])).length, 0);
});
test('live quality bounds report storage and clears by PBX', () => {
  let now = Date.parse('2026-10-09T10:00:00Z');
  const store = new LiveQualityStore(() => now);
  for (let i = 0; i < 300; i++) store.observe('pbx-a', rtcp('leg-' + i));
  assert.equal(
    store.current('pbx-a', new Set(Array.from({ length: 300 }, (_, i) => 'leg-' + i))).length,
    256,
  );
  store.clear('pbx-a');
  assert.equal(store.current('pbx-a', new Set(['leg-299'])).length, 0);
});
