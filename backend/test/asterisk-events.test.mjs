import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AsteriskProvider,
  MockAmiTransport,
  normalizeAmiEvent,
} from '../dist/providers/asterisk/index.js';

const observedAt = '2026-09-25T00:00:00.000Z';

test('AMI normalizer maps core channel, dial, bridge, and peer events without raw payloads', () => {
  const cases = [
    [
      'Newchannel',
      {
        Uniqueid: 'chan-1',
        Channel: 'SIP/100-00000001',
        Linkedid: 'call-1',
        ChannelStateDesc: 'Ring',
        CallerIDNum: 'synthetic-caller',
      },
      {
        type: 'CHANNEL_CREATED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        channelId: 'chan-1',
        channelName: 'SIP/100-00000001',
        linkedId: 'call-1',
        state: 'Ring',
      },
    ],
    [
      'Newstate',
      {
        Uniqueid: 'chan-1',
        Channel: 'SIP/100-00000001',
        Linkedid: 'call-1',
        ChannelStateDesc: 'Up',
      },
      {
        type: 'CHANNEL_STATE_CHANGED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        channelId: 'chan-1',
        channelName: 'SIP/100-00000001',
        linkedId: 'call-1',
        state: 'Up',
      },
    ],
    [
      'Hangup',
      {
        Uniqueid: 'chan-1',
        Channel: 'SIP/100-00000001',
        Linkedid: 'call-1',
        Cause: '16',
        'Cause-txt': 'Normal Clearing',
      },
      {
        type: 'CHANNEL_DESTROYED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        channelId: 'chan-1',
        channelName: 'SIP/100-00000001',
        linkedId: 'call-1',
        cause: '16',
        causeText: 'Normal Clearing',
      },
    ],
    [
      'DialBegin',
      {
        Uniqueid: 'chan-1',
        DestUniqueid: 'chan-2',
        Linkedid: 'call-1',
        DialString: 'SIP/200',
      },
      {
        type: 'DIAL_STARTED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        sourceChannelId: 'chan-1',
        destinationChannelId: 'chan-2',
        linkedId: 'call-1',
        dialString: 'SIP/200',
      },
    ],
    [
      'DialEnd',
      {
        Uniqueid: 'chan-1',
        DestUniqueid: 'chan-2',
        Linkedid: 'call-1',
        DialStatus: 'ANSWER',
      },
      {
        type: 'DIAL_ENDED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        sourceChannelId: 'chan-1',
        destinationChannelId: 'chan-2',
        linkedId: 'call-1',
        dialStatus: 'ANSWER',
      },
    ],
    [
      'BridgeEnter',
      {
        Uniqueid: 'chan-1',
        Channel: 'SIP/100-00000001',
        Linkedid: 'call-1',
        BridgeUniqueid: 'bridge-1',
      },
      {
        type: 'BRIDGE_ENTERED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        bridgeId: 'bridge-1',
        channelId: 'chan-1',
        channelName: 'SIP/100-00000001',
        linkedId: 'call-1',
      },
    ],
    [
      'BridgeLeave',
      {
        Uniqueid: 'chan-1',
        Channel: 'SIP/100-00000001',
        Linkedid: 'call-1',
        BridgeUniqueid: 'bridge-1',
      },
      {
        type: 'BRIDGE_LEFT',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        bridgeId: 'bridge-1',
        channelId: 'chan-1',
        channelName: 'SIP/100-00000001',
        linkedId: 'call-1',
      },
    ],
    [
      'Registry',
      {
        ChannelType: 'SIP',
        Username: 'synthetic-user',
        Domain: 'sip.example.test',
        Status: 'Registered',
        Cause: 'synthetic-private-detail',
      },
      {
        type: 'TRUNK_REGISTRATION_CHANGED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        trunkId: 'SIP/synthetic-user@sip.example.test',
        kind: 'OUTBOUND_REGISTRATION',
        registrationState: 'REGISTERED',
      },
    ],
    [
      'QueueMemberStatus',
      {
        Queue: 'support',
        MemberName: 'Synthetic Agent',
        Interface: 'SIP/100',
        Status: '2',
        Paused: '1',
        InCall: '1',
        PausedReason: 'private-reason',
      },
      {
        type: 'QUEUE_MEMBER_CHANGED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
        availability: 'IN_USE',
        paused: true,
        inCall: true,
      },
    ],
    [
      'QueueMemberRemoved',
      { Queue: 'support', Interface: 'SIP/100', MemberName: 'Synthetic Agent' },
      {
        type: 'QUEUE_MEMBER_REMOVED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        memberId: 'SIP/100',
      },
    ],
    [
      'QueueCallerJoin',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Position: '2',
        CallerIDNum: 'synthetic-private-caller',
      },
      {
        type: 'QUEUE_CALLER_JOINED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        position: 2,
      },
    ],
    [
      'QueueCallerAbandon',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Position: '2',
        CallerIDName: 'synthetic-private-name',
      },
      {
        type: 'QUEUE_CALLER_LEFT',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        disposition: 'ABANDONED',
      },
    ],
    [
      'AgentCalled',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Channel: 'SIP/private-caller-channel',
        CallerIDNum: 'synthetic-private-caller',
        Interface: 'SIP/100',
        MemberName: 'Synthetic Agent',
        DestUniqueid: 'agent-channel-1',
        DestChannel: 'SIP/private-agent-channel',
      },
      {
        type: 'AGENT_CALLED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
      },
    ],
    [
      'AgentRingNoAnswer',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Interface: 'SIP/100',
        MemberName: 'Synthetic Agent',
        RingTime: '1250',
        CallerIDName: 'synthetic-private-name',
      },
      {
        type: 'AGENT_RING_NO_ANSWER',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
      },
    ],
    [
      'AgentConnect',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Interface: 'SIP/100',
        MemberName: 'Synthetic Agent',
        HoldTime: '7',
        RingTime: '2',
        DestUniqueid: 'agent-channel-1',
      },
      {
        type: 'AGENT_CONNECTED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
      },
    ],
    [
      'AgentDump',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Interface: 'SIP/100',
        MemberName: 'Synthetic Agent',
        DestChannel: 'SIP/private-agent-channel',
      },
      {
        type: 'AGENT_DUMPED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
      },
    ],
    [
      'AgentComplete',
      {
        Queue: 'support',
        Uniqueid: 'caller-1',
        Interface: 'SIP/100',
        MemberName: 'Synthetic Agent',
        HoldTime: '7',
        TalkTime: '30',
        Reason: 'transfer',
        DestChannel: 'SIP/private-agent-channel',
      },
      {
        type: 'AGENT_COMPLETED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        queueId: 'support',
        callerId: 'caller-1',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
        reason: 'TRANSFER',
      },
    ],
    [
      'PeerStatus',
      { Peer: 'SIP/100', PeerStatus: 'Registered', Address: '192.0.2.40' },
      {
        type: 'ENDPOINT_STATUS_CHANGED',
        instanceId: 'pbx-1',
        source: 'AMI',
        observedAt,
        endpointId: 'SIP/100',
        registrationState: 'REGISTERED',
        reachability: 'UNKNOWN',
      },
    ],
  ];

  for (const [event, fields, expected] of cases) {
    const normalized = normalizeAmiEvent('pbx-1', { event, fields }, observedAt);
    assert.deepEqual(normalized, expected);
    assert.ok(!JSON.stringify(normalized).includes('synthetic-caller'));
    assert.ok(!JSON.stringify(normalized).includes('192.0.2.40'));
    assert.ok(!JSON.stringify(normalized).includes('synthetic-private-detail'));
    assert.ok(!JSON.stringify(normalized).includes('synthetic-private-caller'));
    assert.ok(!JSON.stringify(normalized).includes('synthetic-private-name'));
    assert.ok(!JSON.stringify(normalized).includes('private-reason'));
    assert.ok(!JSON.stringify(normalized).includes('private-caller-channel'));
    assert.ok(!JSON.stringify(normalized).includes('private-agent-channel'));
    assert.ok(!JSON.stringify(normalized).includes('agent-channel-1'));
  }
});

test('AMI normalizer ignores unknown or identity-incomplete events', () => {
  assert.equal(
    normalizeAmiEvent(
      'pbx-1',
      { event: 'FullyBooted', fields: { Status: 'Fully Booted' } },
      observedAt,
    ),
    undefined,
  );
  assert.equal(
    normalizeAmiEvent(
      'pbx-1',
      { event: 'Newchannel', fields: { Channel: 'SIP/100-00000001' } },
      observedAt,
    ),
    undefined,
  );
  assert.equal(
    normalizeAmiEvent('pbx-1', { event: 'Newstate', fields: { Uniqueid: 'chan-1' } }, observedAt),
    undefined,
  );
  assert.equal(
    normalizeAmiEvent(
      'pbx-1',
      { event: 'AgentCalled', fields: { Queue: 'support', Uniqueid: 'caller-1' } },
      observedAt,
    ),
    undefined,
  );
});

test('provider publishes normalized events, isolates listeners, and updates AMI freshness', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  let clock = 0;
  const provider = new AsteriskProvider({
    instanceId: 'pbx-1',
    displayName: 'Synthetic PBX',
    host: '192.0.2.20',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
    now: () => new Date(observedAt.replace('00:00:00', `00:00:0${clock++}`)),
  });

  const events = [];
  provider.subscribeEvents(() => {
    throw new Error('synthetic consumer failure');
  });
  const unsubscribe = provider.subscribeEvents((event) => events.push(event));

  await provider.connect();
  assert.equal(transport.actions[0].fields?.Events, 'on');

  transport.emitEvent('Newchannel', {
    Uniqueid: 'chan-1',
    Channel: 'SIP/100-00000001',
    ChannelStateDesc: 'Ring',
  });
  transport.emitEvent('UnknownSyntheticEvent', { Secret: 'must-not-propagate' });
  transport.emitEvent('AgentCalled', {
    Queue: 'support',
    Uniqueid: 'caller-1',
    Interface: 'SIP/100',
    MemberName: 'Synthetic Agent',
    CallerIDNum: 'must-not-propagate-agent-pii',
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'CHANNEL_CREATED');
  assert.equal(events[0].channelId, 'chan-1');
  assert.equal(events[1].type, 'AGENT_CALLED');
  assert.ok(!JSON.stringify(events).includes('must-not-propagate'));
  assert.ok(!JSON.stringify(events).includes('must-not-propagate-agent-pii'));
  assert.equal((await provider.getCapabilities()).telephony.agents, 'SUPPORTED');

  const health = await provider.getHealth();
  assert.equal(health.sources.AMI.freshness, 'CURRENT');
  assert.equal(health.sources.AMI.lastUpdate, events[1].observedAt);

  unsubscribe();
  transport.emitEvent('Hangup', { Uniqueid: 'chan-1' });
  assert.equal(events.length, 2);
  await provider.disconnect();
});
