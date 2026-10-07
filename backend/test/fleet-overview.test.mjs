import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFleetOverviewSnapshot } from '../dist/fleet-overview.js';

const profiles = [
  {
    id: 'a',
    displayName: 'Alpha',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'a.test',
    amiPort: 5038,
    amiUsername: 'u',
    hasAmiPassword: true,
    connectionStatus: 'CONNECTED',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'b',
    displayName: 'Bravo',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'b.test',
    amiPort: 5038,
    amiUsername: 'u',
    hasAmiPassword: true,
    connectionStatus: 'DISCONNECTED',
    createdAt: '',
    updatedAt: '',
  },
];

const telephony = new Map([
  [
    'a',
    {
      instanceId: 'a',
      revision: 1,
      synchronization: 'CURRENT',
      lastSnapshotAt: '2026-10-07T00:00:00Z',
      channels: [],
      calls: [{ callId: 'c1', channelIds: [], bridgeIds: [] }],
      endpointCapability: 'SUPPORTED',
      endpointSynchronization: 'CURRENT',
      endpoints: [
        {
          endpointId: '100',
          registrationState: 'REGISTERED',
          reachability: 'UNREACHABLE',
          updatedAt: '',
        },
      ],
      trunkCapability: 'SUPPORTED',
      trunkSynchronization: 'CURRENT',
      trunks: [
        {
          trunkId: 't1',
          kind: 'PEER',
          technology: 'PJSIP',
          confidence: 'CONFIRMED',
          registrationState: 'FAILED',
          updatedAt: '',
        },
      ],
      queueCapability: 'SUPPORTED',
      queueSynchronization: 'CURRENT',
      queues: [{ queueId: 'q1', waitingCount: 2, updatedAt: '' }],
      queueMembers: [],
      queueCallers: [],
      agentCapability: 'UNKNOWN',
      agentSynchronization: 'LIVE_ONLY',
      agentInteractions: [],
    },
  ],
]);

const storage = {
  systemMetrics: { getCurrent: () => undefined },
  securityAlerts: {
    listCurrent: (id) =>
      id === 'b'
        ? [
            {
              instanceId: 'b',
              ruleId: 'AUTHENTICATION_FAILURE_ANY',
              observedAt: '',
              matchedEventCount: 1,
            },
          ]
        : [],
  },
};

test('fleet overview aggregates current PBX state and sorts by severity', () => {
  const result = buildFleetOverviewSnapshot({
    profiles,
    runtime: { connectionState: (id) => (id === 'b' ? 'DISCONNECTED' : 'CONNECTED') },
    telephonyState: { current: (id) => telephony.get(id) },
    storage,
    now: () => '2026-10-07T01:00:00.000Z',
  });
  assert.equal(result.totalPbx, 2);
  assert.equal(result.activeCalls, 1);
  assert.equal(result.trunkFailures, 1);
  assert.equal(result.endpointFailures, 1);
  assert.equal(result.waitingCallers, 2);
  assert.equal(result.criticalAlerts, 1);
  assert.equal(result.healthCounts.CRITICAL, 2);
  assert.equal(result.items[0].health.overall, 'CRITICAL');
  assert.equal(result.observedAt, '2026-10-07T01:00:00.000Z');
  assert.ok(!JSON.stringify(result).includes('a.test'));
});
