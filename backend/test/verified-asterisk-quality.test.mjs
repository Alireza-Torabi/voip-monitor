import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAmiRtcpSample } from '../dist/providers/asterisk/call-quality.js';
import { LiveQualityStore } from '../dist/providers/runtime/live-quality.js';
const event = {
  event: 'RTCPReceived',
  fields: {
    Uniqueid: 'leg',
    ReportCount: '1',
    Report0FractionLost: '128',
    RTT: '0.0125',
    Report0IAJitter: '80',
  },
};
test('only exactly verified Asterisk 13.20.0 has numeric loss and RTT', () => {
  const time = '2026-10-09T10:00:00Z';
  for (const v of [undefined, '13.19.0', '20.0.0', '13.20.0-custom']) {
    const [sample] = normalizeAmiRtcpSample('pbx', event, time, v);
    assert.equal(sample.packetLossPercent.availability, 'UNKNOWN');
    assert.equal(sample.rtt.availability, 'UNKNOWN');
  }
  const [sample] = normalizeAmiRtcpSample('pbx', event, time, '13.20.0');
  assert.deepEqual(sample.packetLossPercent, {
    availability: 'AVAILABLE',
    value: 50,
    unit: 'PERCENT',
  });
  assert.deepEqual(sample.rtt, { availability: 'AVAILABLE', value: 12.5, unit: 'MILLISECONDS' });
  assert.equal(sample.codec.availability, 'UNKNOWN');
  assert.equal(sample.mos.availability, 'UNKNOWN');
  assert.equal(sample.jitter.unit, 'RTP_TICKS');
});
test('source version changes clear cached reports and observations', () => {
  let now = Date.parse('2026-10-09T10:00:00Z');
  const store = new LiveQualityStore(() => now);
  store.setSourceVersion('pbx', '13.20.0');
  store.observe('pbx', event);
  assert.equal(store.current('pbx', new Set(['leg']))[0].rtt.availability, 'AVAILABLE');
  store.setSourceVersion('pbx', '13.19.0');
  assert.equal(store.current('pbx', new Set(['leg'])).length, 0);
  store.observe('pbx', event);
  assert.equal(store.current('pbx', new Set(['leg']))[0].rtt.availability, 'UNKNOWN');
});
