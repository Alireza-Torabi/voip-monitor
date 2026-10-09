import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fractionLostToPercent,
  rttToMilliseconds,
  jitterToMilliseconds,
} from '../dist/providers/asterisk/quality-conversion.js';

test('all quality conversions require positive version evidence', () => {
  assert.equal(fractionLostToPercent('0', {}).availability, 'UNKNOWN');
  assert.equal(rttToMilliseconds('0.12', {}).availability, 'UNKNOWN');
  assert.equal(jitterToMilliseconds('180', {}).availability, 'UNKNOWN');
});
test('RFC3550 fraction lost respects unsigned 8-bit fractional range', () => {
  const evidence = { fractionLostEncoding: 'RFC3550_U8' };
  assert.deepEqual(fractionLostToPercent('128', evidence), {
    availability: 'AVAILABLE',
    value: 50,
    unit: 'PERCENT',
  });
  for (const invalid of ['256', '-1', '1.2', 'Infinity', '', null])
    assert.notEqual(fractionLostToPercent(invalid, evidence).availability, 'AVAILABLE');
});
test('RTT requires seconds proof and jitter requires verified stream clock', () => {
  assert.deepEqual(rttToMilliseconds('0.125', { rttEncoding: 'SECONDS' }), {
    availability: 'AVAILABLE',
    value: 125,
    unit: 'MILLISECONDS',
  });
  assert.deepEqual(jitterToMilliseconds('160', { rtpClockHz: 8000 }), {
    availability: 'AVAILABLE',
    value: 20,
    unit: 'MILLISECONDS',
  });
  assert.equal(rttToMilliseconds('-1', { rttEncoding: 'SECONDS' }).availability, 'UNKNOWN');
  assert.equal(jitterToMilliseconds('160', { rtpClockHz: 0 }).availability, 'UNKNOWN');
});
