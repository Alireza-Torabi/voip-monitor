import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import {
  AmiTransportError,
  AsteriskProvider,
  MockAmiTransport,
  TcpAmiTransport,
} from '../dist/providers/asterisk/index.js';

function parseHeaders(raw) {
  return Object.fromEntries(
    raw.split('\r\n').map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator), line.slice(separator + 1).trimStart()];
    }),
  );
}

async function syntheticAmi(handler, run) {
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('Asterisk Call Manager/2.10.4\r\n');
    let buffer = '';
    socket.on('data', async (chunk) => {
      buffer += chunk;
      while (true) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 4);
        await handler(parseHeaders(raw), socket);
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(address.port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('TCP AMI transport publishes events and still correlates a synthetic response', async () => {
  await syntheticAmi(
    async (action, socket) => {
      assert.equal(action.Action, 'Ping');
      assert.match(action.ActionID, /^vm-[0-9]+$/);
      socket.write(
        'Event: FullyBooted\r\nStatus: Fully Booted\r\n\r\n' +
          `Response: Success\r\nActionID: ${action.ActionID}\r\nPing: Pong\r\n\r\n`,
      );
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      const events = [];
      transport.subscribeEvents(() => {
        throw new Error('synthetic raw-event consumer failure');
      });
      const unsubscribe = transport.subscribeEvents((event) => events.push(event));
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      assert.equal(transport.banner, 'Asterisk Call Manager/2.10.4');
      const response = await transport.request({ action: 'Ping' });
      assert.equal(response.response, 'Success');
      assert.equal(response.fields.Ping, 'Pong');
      assert.equal(events.length, 1);
      assert.equal(events[0].event, 'FullyBooted');
      assert.deepEqual(events[0].fields, { Status: 'Fully Booted' });
      assert.ok(Number.isInteger(events[0].streamGeneration));
      assert.equal(events[0].streamSequence, 1);
      unsubscribe();
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport correlates an event-list action while forwarding interleaved live events', async () => {
  await syntheticAmi(
    async (action, socket) => {
      assert.equal(action.Action, 'CoreShowChannels');
      assert.match(action.ActionID, /^vm-[0-9]+$/);
      socket.write(
        `Response: Success\r\nActionID: ${action.ActionID}\r\nEventList: start\r\n\r\n` +
          'Event: Newchannel\r\nUniqueid: live-1\r\nChannel: SIP/200-00000002\r\n\r\n' +
          `Event: CoreShowChannel\r\nActionID: ${action.ActionID}\r\nUniqueid: snapshot-1\r\nChannel: SIP/100-00000001\r\nChannelStateDesc: Up\r\nLinkedid: call-1\r\n\r\n` +
          `Event: CoreShowChannelsComplete\r\nActionID: ${action.ActionID}\r\nEventList: Complete\r\nListItems: 1\r\n\r\n`,
      );
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      const liveEvents = [];
      transport.subscribeEvents((event) => liveEvents.push(event));
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      const result = await transport.requestEventList(
        { action: 'CoreShowChannels' },
        { itemEvent: 'CoreShowChannel', completeEvent: 'CoreShowChannelsComplete' },
      );
      assert.equal(result.response.response, 'Success');
      assert.ok(Number.isInteger(result.streamGeneration));
      const generation = result.streamGeneration;
      assert.equal(result.streamStartedSequence, 0);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].event, 'CoreShowChannel');
      assert.equal(result.events[0].fields.Uniqueid, 'snapshot-1');
      assert.equal(result.events[0].streamGeneration, generation);
      assert.equal(result.events[0].streamSequence, 3);
      assert.equal(result.completion.fields.ListItems, '1');
      assert.equal(result.completion.streamSequence, 4);
      assert.deepEqual(liveEvents, [
        {
          event: 'Newchannel',
          fields: { Uniqueid: 'live-1', Channel: 'SIP/200-00000002' },
          streamGeneration: generation,
          streamSequence: 2,
        },
      ]);
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport correlates a mixed-item event-list action', async () => {
  await syntheticAmi(
    async (action, socket) => {
      assert.equal(action.Action, 'QueueStatus');
      socket.write(
        `Response: Success\r\nActionID: ${action.ActionID}\r\nEventList: start\r\n\r\n` +
          `Event: QueueParams\r\nActionID: ${action.ActionID}\r\nQueue: support\r\nStrategy: ringall\r\n\r\n` +
          `Event: QueueMember\r\nActionID: ${action.ActionID}\r\nQueue: support\r\nLocation: SIP/100\r\nStatus: 1\r\nPaused: 0\r\nInCall: 0\r\n\r\n` +
          `Event: QueueEntry\r\nActionID: ${action.ActionID}\r\nQueue: support\r\nUniqueid: caller-1\r\nPosition: 1\r\nWait: 5\r\n\r\n` +
          `Event: QueueStatusComplete\r\nActionID: ${action.ActionID}\r\nEventList: Complete\r\nListItems: 3\r\n\r\n`,
      );
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      const result = await transport.requestEventList(
        { action: 'QueueStatus' },
        {
          itemEvents: ['QueueParams', 'QueueMember', 'QueueEntry'],
          completeEvent: 'QueueStatusComplete',
        },
      );
      assert.deepEqual(
        result.events.map((event) => event.event),
        ['QueueParams', 'QueueMember', 'QueueEntry'],
      );
      assert.equal(result.completion.fields.ListItems, '3');
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport rejects a cancelled event-list instead of returning a partial snapshot', async () => {
  await syntheticAmi(
    async (action, socket) => {
      socket.write(
        `Response: Success\r\nActionID: ${action.ActionID}\r\nEventList: start\r\n\r\n` +
          `Event: CoreShowChannel\r\nActionID: ${action.ActionID}\r\nUniqueid: partial-1\r\n\r\n` +
          `Event: CoreShowChannelsComplete\r\nActionID: ${action.ActionID}\r\nEventList: cancelled\r\nListItems: 1\r\n\r\n`,
      );
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      await assert.rejects(
        transport.requestEventList(
          { action: 'CoreShowChannels' },
          { itemEvent: 'CoreShowChannel', completeEvent: 'CoreShowChannelsComplete' },
        ),
        (error) => error instanceof AmiTransportError && error.code === 'PROTOCOL_ERROR',
      );
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport rejects header injection before sending an action', async () => {
  let received = 0;
  await syntheticAmi(
    async () => {
      received += 1;
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      await assert.rejects(
        transport.request({
          action: 'Login',
          fields: { Username: 'admin\r\nAction: Logoff' },
        }),
        (error) => error instanceof AmiTransportError && error.code === 'INVALID_ACTION',
      );
      assert.equal(received, 0);
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport times out a synthetic action without leaking protocol details', async () => {
  await syntheticAmi(
    async () => undefined,
    async (port) => {
      const transport = new TcpAmiTransport(40);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      await assert.rejects(
        transport.request({ action: 'Ping' }),
        (error) => error instanceof AmiTransportError && error.code === 'TIMEOUT',
      );
      await transport.disconnect();
    },
  );
});

test('Asterisk provider logs in, discovers version, reconciles, and wipes password buffer', async () => {
  const transport = new MockAmiTransport();
  let suppliedPassword;
  transport
    .on('Login', (action) => {
      assert.equal(action.fields?.Username, 'synthetic-admin');
      assert.equal(action.fields?.Secret, 'synthetic-ami-secret');
      assert.equal(action.fields?.Events, 'off');
      return { response: 'Success', message: 'Authentication accepted', fields: {} };
    })
    .on('CoreSettings', () => ({
      response: 'Success',
      fields: { AsteriskVersion: '13.20.0', AMIversion: '2.10.4' },
    }))
    .onEventList('CoreShowChannels', (_action, spec) => {
      assert.deepEqual(spec, {
        itemEvent: 'CoreShowChannel',
        completeEvent: 'CoreShowChannelsComplete',
      });
      return {
        response: { response: 'Success', fields: { EventList: 'start' } },
        events: [
          {
            event: 'CoreShowChannel',
            fields: {
              Uniqueid: 'snapshot-1',
              Channel: 'SIP/100-00000001',
              Linkedid: 'call-1',
              ChannelStateDesc: 'Up',
              BridgeId: 'bridge-1',
            },
          },
        ],
        completion: {
          event: 'CoreShowChannelsComplete',
          fields: { EventList: 'Complete', ListItems: '1' },
        },
      };
    })
    .onEventList('SIPpeers', (_action, spec) => {
      assert.deepEqual(spec, {
        itemEvent: 'PeerEntry',
        completeEvent: 'PeerlistComplete',
      });
      return {
        response: { response: 'Success', fields: { EventList: 'start' } },
        events: [
          {
            event: 'PeerEntry',
            fields: {
              Channeltype: 'SIP',
              ObjectName: '100',
              Dynamic: 'yes',
              IPaddress: '192.0.2.100',
              Status: 'OK (12 ms)',
            },
          },
          {
            event: 'PeerEntry',
            fields: {
              Channeltype: 'SIP',
              ObjectName: '200',
              Dynamic: 'yes',
              IPaddress: '-none-',
              Status: 'UNKNOWN',
            },
          },
        ],
        completion: {
          event: 'PeerlistComplete',
          fields: { EventList: 'Complete', ListItems: '2' },
        },
      };
    })
    .onEventList('SIPshowregistry', (_action, spec) => {
      assert.deepEqual(spec, {
        itemEvent: 'RegistryEntry',
        completeEvent: 'RegistrationsComplete',
      });
      return {
        response: { response: 'Success', fields: { EventList: 'start' } },
        events: [
          {
            event: 'RegistryEntry',
            fields: {
              Username: 'synthetic-user',
              Domain: 'sip.example.test',
              State: 'Registered',
              Host: '192.0.2.200',
            },
          },
        ],
        completion: {
          event: 'RegistrationsComplete',
          fields: { EventList: 'Complete', ListItems: '1' },
        },
      };
    })
    .onEventList('QueueStatus', (_action, spec) => {
      assert.deepEqual(spec, {
        itemEvents: ['QueueParams', 'QueueMember', 'QueueEntry'],
        completeEvent: 'QueueStatusComplete',
      });
      return {
        response: { response: 'Success', fields: { EventList: 'start' } },
        events: [
          {
            event: 'QueueParams',
            fields: {
              Queue: 'support',
              Strategy: 'ringall',
              Calls: '1',
              SecretMetadata: 'must-not-propagate',
            },
          },
          {
            event: 'QueueMember',
            fields: {
              Queue: 'support',
              Name: 'Synthetic Agent',
              Location: 'SIP/100',
              Status: '1',
              Paused: '0',
              InCall: '0',
              StateInterface: 'hint:100@example',
            },
          },
          {
            event: 'QueueEntry',
            fields: {
              Queue: 'support',
              Uniqueid: 'caller-1',
              Position: '1',
              Wait: '12',
              CallerIDNum: 'synthetic-private-caller',
              Channel: 'SIP/private-channel',
            },
          },
        ],
        completion: {
          event: 'QueueStatusComplete',
          fields: { EventList: 'Complete', ListItems: '3' },
        },
      };
    })
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));

  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: 'pbx.example.test',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => {
      suppliedPassword = Buffer.from('synthetic-ami-secret');
      return suppliedPassword;
    },
    resolver: {
      async resolve() {
        return ['192.0.2.20'];
      },
    },
    transport,
  });

  await provider.connect();
  assert.ok(suppliedPassword.every((byte) => byte === 0));
  assert.equal(transport.actions[0].fields?.Secret, '<redacted>');
  assert.equal((await provider.getHealth()).connection.state, 'CONNECTED');

  const discovery = await provider.discover();
  assert.deepEqual(discovery.metadata, {
    id: 'synthetic-pbx',
    providerType: 'ASTERISK',
    displayName: 'Synthetic PBX',
    product: 'Asterisk',
    version: '13.20.0',
  });
  assert.equal(discovery.capabilities.telephony.channels, 'UNKNOWN');

  const snapshot = await provider.reconcile();
  assert.deepEqual(snapshot.channels, [
    {
      channelId: 'snapshot-1',
      channelName: 'SIP/100-00000001',
      linkedId: 'call-1',
      state: 'Up',
      bridgeId: 'bridge-1',
    },
  ]);
  assert.deepEqual(snapshot.endpointState, {
    capability: 'SUPPORTED',
    startedAt: snapshot.endpointState.startedAt,
    observedAt: snapshot.endpointState.observedAt,
    endpoints: [
      {
        endpointId: 'SIP/100',
        registrationState: 'REGISTERED',
        reachability: 'REACHABLE',
      },
      {
        endpointId: 'SIP/200',
        registrationState: 'UNREGISTERED',
        reachability: 'UNKNOWN',
      },
    ],
  });
  assert.deepEqual(snapshot.trunkState, {
    capability: 'SUPPORTED',
    startedAt: snapshot.trunkState.startedAt,
    observedAt: snapshot.trunkState.observedAt,
    trunks: [
      {
        trunkId: 'SIP/synthetic-user@sip.example.test',
        kind: 'OUTBOUND_REGISTRATION',
        registrationState: 'REGISTERED',
      },
    ],
  });
  assert.ok(!JSON.stringify(snapshot.trunkState).includes('192.0.2.200'));
  assert.deepEqual(snapshot.queueState, {
    capability: 'SUPPORTED',
    startedAt: snapshot.queueState.startedAt,
    observedAt: snapshot.queueState.observedAt,
    queues: [{ queueId: 'support', strategy: 'ringall' }],
    members: [
      {
        queueId: 'support',
        memberId: 'SIP/100',
        memberName: 'Synthetic Agent',
        availability: 'AVAILABLE',
        paused: false,
        inCall: false,
      },
    ],
    callers: [
      {
        queueId: 'support',
        callerId: 'caller-1',
        position: 1,
        waitSeconds: 12,
      },
    ],
  });
  assert.ok(!JSON.stringify(snapshot.queueState).includes('synthetic-private-caller'));
  assert.ok(!JSON.stringify(snapshot.queueState).includes('SIP/private-channel'));
  assert.ok(!JSON.stringify(snapshot.queueState).includes('must-not-propagate'));
  const capabilities = await provider.getCapabilities();
  assert.equal(capabilities.telephony.channels, 'SUPPORTED');
  assert.equal(capabilities.telephony.endpoints, 'SUPPORTED');
  assert.equal(capabilities.telephony.trunks, 'SUPPORTED');
  assert.equal(capabilities.telephony.queues, 'SUPPORTED');
  assert.equal((await provider.getHealth()).sources.AMI.freshness, 'CURRENT');
  await provider.disconnect();
  const disconnected = await provider.getHealth();
  assert.equal(disconnected.connection.state, 'DISCONNECTED');
  assert.equal(disconnected.sources.AMI.freshness, 'UNAVAILABLE');
});

test('Asterisk provider keeps channel snapshots usable when SIP peer listing is denied', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .onEventList('CoreShowChannels', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: {
        event: 'CoreShowChannelsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('SIPpeers', () => ({
      response: { response: 'Error', message: 'Permission denied', fields: {} },
      events: [],
      completion: { event: 'PeerlistComplete', fields: { EventList: 'Complete', ListItems: '0' } },
    }))
    .onEventList('SIPshowregistry', () => ({
      response: { response: 'Error', message: 'Permission denied', fields: {} },
      events: [],
      completion: {
        event: 'RegistrationsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('QueueStatus', () => ({
      response: { response: 'Error', message: 'Permission denied', fields: {} },
      events: [],
      completion: {
        event: 'QueueStatusComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await provider.connect();
  const state = await provider.getCurrentState();
  assert.deepEqual(state.channels, []);
  assert.equal(state.endpointState.capability, 'PERMISSION_DENIED');
  assert.deepEqual(state.endpointState.endpoints, []);
  assert.equal(state.trunkState.capability, 'PERMISSION_DENIED');
  assert.deepEqual(state.trunkState.trunks, []);
  assert.equal(state.queueState.capability, 'PERMISSION_DENIED');
  assert.deepEqual(state.queueState.queues, []);
  assert.equal((await provider.getCapabilities()).telephony.endpoints, 'PERMISSION_DENIED');
  assert.equal((await provider.getHealth()).connection.state, 'CONNECTED');
  await provider.disconnect();
});

test('Asterisk provider keeps channel and endpoint snapshots usable when SIP registry is denied', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .onEventList('CoreShowChannels', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: {
        event: 'CoreShowChannelsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('SIPpeers', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: { event: 'PeerlistComplete', fields: { EventList: 'Complete', ListItems: '0' } },
    }))
    .onEventList('SIPshowregistry', () => ({
      response: { response: 'Error', message: 'Permission denied', fields: {} },
      events: [],
      completion: {
        event: 'RegistrationsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('QueueStatus', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: {
        event: 'QueueStatusComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await provider.connect();
  const state = await provider.getCurrentState();
  assert.equal(state.endpointState.capability, 'SUPPORTED');
  assert.equal(state.trunkState.capability, 'PERMISSION_DENIED');
  assert.deepEqual(state.trunkState.trunks, []);
  const capabilities = await provider.getCapabilities();
  assert.equal(capabilities.telephony.endpoints, 'SUPPORTED');
  assert.equal(capabilities.telephony.trunks, 'PERMISSION_DENIED');
  assert.equal(capabilities.telephony.queues, 'SUPPORTED');
  assert.equal((await provider.getHealth()).connection.state, 'CONNECTED');
  await provider.disconnect();
});

test('Asterisk provider keeps channel, endpoint, and trunk snapshots usable when QueueStatus is denied', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .onEventList('CoreShowChannels', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: {
        event: 'CoreShowChannelsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('SIPpeers', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: { event: 'PeerlistComplete', fields: { EventList: 'Complete', ListItems: '0' } },
    }))
    .onEventList('SIPshowregistry', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [],
      completion: {
        event: 'RegistrationsComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .onEventList('QueueStatus', () => ({
      response: { response: 'Error', message: 'Permission denied', fields: {} },
      events: [],
      completion: {
        event: 'QueueStatusComplete',
        fields: { EventList: 'Complete', ListItems: '0' },
      },
    }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await provider.connect();
  const state = await provider.getCurrentState();
  assert.equal(state.endpointState.capability, 'SUPPORTED');
  assert.equal(state.trunkState.capability, 'SUPPORTED');
  assert.equal(state.queueState.capability, 'PERMISSION_DENIED');
  assert.deepEqual(state.queueState.queues, []);
  assert.deepEqual(state.queueState.members, []);
  assert.deepEqual(state.queueState.callers, []);
  assert.equal((await provider.getCapabilities()).telephony.queues, 'PERMISSION_DENIED');
  assert.equal((await provider.getHealth()).connection.state, 'CONNECTED');
  await provider.disconnect();
});

test('Asterisk provider rejects an inconsistent channel-list count as degraded state', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .onEventList('CoreShowChannels', () => ({
      response: { response: 'Success', fields: { EventList: 'start' } },
      events: [
        {
          event: 'CoreShowChannel',
          fields: { Uniqueid: 'snapshot-1', Channel: 'SIP/100-00000001' },
        },
      ],
      completion: {
        event: 'CoreShowChannelsComplete',
        fields: { EventList: 'Complete', ListItems: '2' },
      },
    }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await provider.connect();
  await assert.rejects(provider.getCurrentState(), (error) => error.code === 'UNKNOWN');
  assert.equal((await provider.getHealth()).connection.state, 'DEGRADED');
  await provider.disconnect();
});

test('Asterisk provider maps a blocked network target to safe connection failure', async () => {
  const transport = new MockAmiTransport();
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '127.0.0.1',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await assert.rejects(provider.connect(), (error) => error.code === 'CONNECTION_FAILED');
  assert.equal((await provider.getHealth()).sources.AMI.error.code, 'CONNECTION_FAILED');
  assert.equal(transport.connections.length, 0);
});

test('Asterisk provider maps denied discovery action to safe permission failure', async () => {
  const transport = new MockAmiTransport()
    .on('Login', () => ({ response: 'Success', fields: {} }))
    .on('CoreSettings', () => ({
      response: 'Error',
      message: 'Permission denied',
      fields: {},
    }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-secret'),
    resolver: {
      async resolve() {
        return [];
      },
    },
    transport,
  });

  await provider.connect();
  await assert.rejects(provider.discover(), (error) => error.code === 'PERMISSION_DENIED');
  assert.equal((await provider.getHealth()).sources.AMI.error.code, 'PERMISSION_DENIED');
  await provider.disconnect();
});

test('Asterisk provider maps rejected login to safe authentication failure health', async () => {
  const transport = new MockAmiTransport().on('Login', () => ({
    response: 'Error',
    message: 'Authentication failed',
    fields: {},
  }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-wrong-secret'),
    resolver: {
      async resolve() {
        throw new Error('resolver must not run for an IP literal');
      },
    },
    transport,
  });

  await assert.rejects(provider.connect(), (error) => error.code === 'AUTHENTICATION_FAILED');
  const health = await provider.getHealth();
  assert.equal(health.connection.state, 'ERROR');
  assert.equal(health.sources.AMI.freshness, 'ERROR');
  assert.equal(health.sources.AMI.error.code, 'AUTHENTICATION_FAILED');
  assert.equal(transport.connected, false);
});
