import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AsteriskAmiSecurityEventSource,
  SecurityEventCollectorError,
  validateSecurityEvent,
} from '../dist/collectors/security/index.js';
import {
  AsteriskProvider,
  MockAmiTransport,
  normalizeAmiSecurityEvent,
} from '../dist/providers/asterisk/index.js';

const observedAt = '2026-09-26T00:00:00.000Z';

function providerFixture() {
  const transport = new MockAmiTransport();
  transport.on('Login', () => ({ response: 'Success', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'pbx-1',
    displayName: 'Synthetic PBX',
    host: 'pbx.example.test',
    port: 5038,
    amiUsername: 'monitor',
    readAmiPassword: () => Buffer.from('synthetic'),
    resolver: { resolve: async () => ['192.0.2.10'] },
    transport,
    now: () => new Date(observedAt),
  });
  return { provider, transport };
}

test('Asterisk SecurityEvent normalizer exposes only bounded authentication outcomes', () => {
  assert.deepEqual(
    normalizeAmiSecurityEvent(
      'pbx-1',
      {
        event: 'SecurityEvent',
        fields: {
          EventName: 'InvalidPassword',
          AccountID: 'secret-user',
          RemoteAddress: '10.0.0.8',
          RequestParams: 'hidden',
        },
        streamGeneration: 4,
        streamSequence: 9,
      },
      observedAt,
    ),
    {
      instanceId: 'pbx-1',
      source: 'AMI',
      observedAt,
      streamGeneration: 4,
      streamSequence: 9,
      type: 'AUTHENTICATION_FAILURE',
      reason: 'INVALID_PASSWORD',
    },
  );
  assert.deepEqual(
    normalizeAmiSecurityEvent(
      'pbx-1',
      {
        event: 'SecurityEvent',
        fields: { EventName: 'SuccessfulAuth' },
      },
      observedAt,
    ),
    { instanceId: 'pbx-1', source: 'AMI', observedAt, type: 'AUTHENTICATION_SUCCESS' },
  );
  assert.equal(
    normalizeAmiSecurityEvent(
      'pbx-1',
      {
        event: 'SecurityEvent',
        fields: { EventName: 'UnknownSecurityEvent' },
      },
      observedAt,
    ),
    undefined,
  );
});

test('security source validates provider-neutral events and enables AMI event delivery', async () => {
  const { provider, transport } = providerFixture();
  const source = new AsteriskAmiSecurityEventSource(provider, 'pbx-1');
  const received = [];
  const unsubscribe = source.subscribeEvents((event) => received.push(event));

  await provider.connect();
  assert.equal(transport.actions[0].fields.Events, 'on');
  transport.emitEvent('SecurityEvent', { EventName: 'SuccessfulAuth' });
  transport.emitEvent('SecurityEvent', { EventName: 'FailedACL' });
  transport.emitEvent('SecurityEvent', { EventName: 'InvalidPassword', AccountID: 'hidden' });
  transport.emitEvent('SecurityEvent', { EventName: 'UnrelatedEvent' });

  assert.deepEqual(
    received.map(({ type, reason }) => ({ type, reason })),
    [
      { type: 'AUTHENTICATION_SUCCESS', reason: undefined },
      { type: 'AUTHENTICATION_FAILURE', reason: 'ACL_FAILURE' },
      { type: 'AUTHENTICATION_FAILURE', reason: 'INVALID_PASSWORD' },
    ],
  );
  assert.deepEqual(await provider.getCapabilities(), {
    telephony: {
      channels: 'UNKNOWN',
      calls: 'UNKNOWN',
      endpoints: 'UNKNOWN',
      trunks: 'UNKNOWN',
      queues: 'UNKNOWN',
      agents: 'UNKNOWN',
    },
    system: {
      cpu: 'UNKNOWN',
      memory: 'UNKNOWN',
      filesystems: 'UNKNOWN',
      uptime: 'UNKNOWN',
      services: 'UNKNOWN',
    },
    security: { authenticationEvents: 'SUPPORTED' },
  });

  unsubscribe();
  await provider.disconnect();
});

test('security validation rejects wrong source or malformed timestamps without raw data', () => {
  assert.throws(
    () =>
      validateSecurityEvent('pbx-1', 'AMI', {
        instanceId: 'pbx-2',
        source: 'AMI',
        observedAt,
        type: 'AUTHENTICATION_SUCCESS',
      }),
    (error) => error instanceof SecurityEventCollectorError && error.code === 'INVALID_EVENT',
  );
  assert.throws(
    () =>
      validateSecurityEvent('pbx-1', 'AMI', {
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt: 'not-a-date',
        type: 'AUTHENTICATION_SUCCESS',
      }),
    (error) => error instanceof SecurityEventCollectorError && error.code === 'INVALID_EVENT',
  );
});
