import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAmiRtcpSample } from '../dist/providers/asterisk/call-quality.js';

const observedAt = '2026-10-09T07:00:00.000Z';
const event = (name, fields) => ({ event: name, fields });

test('quality contract keeps unverified metrics unknown and jitter in RTP ticks', () => {
  const samples = normalizeAmiRtcpSample(
    'pbx-test',
    event('RTCPReceived', {
      Uniqueid: 'leg-1',
      Linkedid: 'linked-1',
      ReportCount: '1',
      SSRC: '42',
      Report0SourceSSRC: '43',
      Report0IAJitter: '160',
      Report0CumulativeLost: '4',
      Report0FractionLost: '20',
      RTT: '0.04',
    }),
    observedAt,
  );
  assert.equal(samples.length, 1);
  assert.equal(samples[0].direction, 'RECEIVED');
  assert.equal(samples[0].reportSourceSsrc, '43');
  assert.deepEqual(samples[0].jitter, { availability: 'AVAILABLE', value: 160, unit: 'RTP_TICKS' });
  assert.deepEqual(samples[0].cumulativeLostPackets, {
    availability: 'AVAILABLE',
    value: 4,
    unit: 'COUNT',
  });
  assert.equal(samples[0].packetLossPercent.availability, 'UNKNOWN');
  assert.equal(samples[0].rtt.availability, 'UNKNOWN');
  assert.equal(samples[0].mos.availability, 'UNKNOWN');
  assert.equal(samples[0].codec.availability, 'UNKNOWN');
});

test('quality reports do not fabricate blocks or zeroes', () => {
  assert.deepEqual(
    normalizeAmiRtcpSample(
      'pbx-test',
      event('RTCPSent', { Uniqueid: 'leg', ReportCount: '0' }),
      observedAt,
    ),
    [],
  );
  assert.deepEqual(
    normalizeAmiRtcpSample('pbx-test', event('RTCPSent', { ReportCount: '1' }), observedAt),
    [],
  );
  assert.deepEqual(
    normalizeAmiRtcpSample(
      'pbx-test',
      event('RTCPSent', { Uniqueid: 'leg', ReportCount: '100000' }),
      observedAt,
    ),
    [],
  );
  const [sample] = normalizeAmiRtcpSample(
    'pbx-test',
    event('RTCPSent', { Uniqueid: 'leg', ReportCount: '1' }),
    observedAt,
  );
  assert.equal(sample.direction, 'SENT');
  assert.equal(sample.jitter.availability, 'UNKNOWN');
  assert.equal(sample.cumulativeLostPackets.availability, 'UNKNOWN');
});

test('quality normalization isolates multiple report blocks and ignores unrelated events', () => {
  const result = normalizeAmiRtcpSample(
    'pbx-test',
    event('RTCPSent', {
      Uniqueid: 'leg',
      ReportCount: '2',
      Report0SourceSSRC: '1',
      Report1SourceSSRC: '2',
      Report0IAJitter: '30',
      Report1IAJitter: '10',
    }),
    observedAt,
  );
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((x) => x.reportSourceSsrc),
    ['1', '2'],
  );
  assert.deepEqual(normalizeAmiRtcpSample('pbx-test', event('Newchannel', {}), observedAt), []);
});
