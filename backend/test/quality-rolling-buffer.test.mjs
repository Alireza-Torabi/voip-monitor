import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveQualityStore } from '../dist/providers/runtime/live-quality.js';
test('quality keeps only previous and current same-stream samples in temporary memory', () => {
  let now = Date.parse('2026-10-10T12:00:00.000Z');
  const store = new LiveQualityStore(() => now);
  store.setSourceVersion('pbx', '13.20.0');
  const ev = (n) => ({
    event: 'RTCPReceived',
    fields: {
      Uniqueid: 'leg',
      ReportCount: '1',
      SSRC: '0x1234',
      Report0SourceSSRC: '0x55',
      Report0FractionLost: String(n),
      RTT: '0.35',
    },
  });
  store.observe('pbx', ev(30));
  now += 1000;
  store.observe('pbx', ev(40));
  let reports = store.recent('pbx', new Set(['leg']));
  assert.equal(reports.length, 2);
  assert.equal(store.current('pbx', new Set(['leg'])).length, 1);
  now += 1000;
  store.observe('pbx', ev(50));
  reports = store.recent('pbx', new Set(['leg']));
  assert.equal(reports.length, 2);
  assert.equal(reports[0].packetLossPercent.value, (50 * 100) / 256);
  assert.equal(reports[1].packetLossPercent.value, (40 * 100) / 256);
  store.clear('pbx');
  assert.equal(store.recent('pbx', new Set(['leg'])).length, 0);
});
