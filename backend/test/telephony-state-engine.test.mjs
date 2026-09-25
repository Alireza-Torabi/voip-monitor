import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelephonyStateEngine } from '../dist/telephony/state-engine.js';

class FakeStateSource {
  eventListeners = new Set();
  snapshotListeners = new Set();
  connectionListeners = new Set();
  resetListeners = new Set();

  subscribeEvents(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeSnapshots(listener) {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  subscribeConnectionStates(listener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  connection(instanceId, state) {
    for (const listener of this.connectionListeners) listener(instanceId, state);
  }

  subscribeInstanceResets(listener) {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  reset(instanceId) {
    for (const listener of this.resetListeners) listener(instanceId);
  }

  event(event) {
    for (const listener of this.eventListeners) listener({ ...event });
  }

  snapshot(snapshot) {
    const copy = { ...snapshot, channels: snapshot.channels.map((channel) => ({ ...channel })) };
    for (const listener of this.snapshotListeners) listener(copy);
  }
}

function baseEvent(type, overrides = {}) {
  return {
    type,
    instanceId: 'pbx-1',
    source: 'AMI',
    observedAt: '2026-09-25T12:00:00.000Z',
    streamGeneration: 1,
    streamSequence: 1,
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    instanceId: 'pbx-1',
    source: 'AMI',
    startedAt: '2026-09-25T12:00:00.000Z',
    observedAt: '2026-09-25T12:00:01.000Z',
    streamGeneration: 1,
    streamStartedSequence: 2,
    channels: [],
    ...overrides,
  };
}

test('first snapshot ignores older per-channel events and replays events after the snapshot boundary', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source);
  engine.start();

  source.event(
    baseEvent('CHANNEL_STATE_CHANGED', {
      channelId: 'channel-1',
      linkedId: 'call-1',
      state: 'Ring',
      streamSequence: 3,
    }),
  );
  source.event(
    baseEvent('CHANNEL_CREATED', {
      channelId: 'channel-2',
      linkedId: 'call-1',
      state: 'Ring',
      streamSequence: 6,
      observedAt: '2026-09-25T12:00:00.600Z',
    }),
  );

  assert.equal(engine.current('pbx-1'), undefined);

  source.snapshot(
    snapshot({
      channels: [
        {
          channelId: 'channel-1',
          linkedId: 'call-1',
          state: 'Up',
          streamSequence: 4,
        },
      ],
    }),
  );

  const current = engine.current('pbx-1');
  assert.ok(current);
  assert.equal(current.revision, 1);
  assert.equal(current.synchronization, 'CURRENT');
  assert.deepEqual(
    current.channels.map(({ channelId, state }) => ({ channelId, state })),
    [
      { channelId: 'channel-1', state: 'Up' },
      { channelId: 'channel-2', state: 'Ring' },
    ],
  );
  assert.deepEqual(current.calls, [
    {
      callId: 'call-1',
      linkedId: 'call-1',
      channelIds: ['channel-1', 'channel-2'],
      bridgeIds: [],
      updatedAt: '2026-09-25T12:00:01.000Z',
    },
  ]);

  source.event(
    baseEvent('BRIDGE_ENTERED', {
      channelId: 'channel-2',
      linkedId: 'call-1',
      bridgeId: 'bridge-1',
      streamSequence: 7,
      observedAt: '2026-09-25T12:00:02.000Z',
    }),
  );
  const bridged = engine.current('pbx-1');
  assert.equal(bridged.revision, 2);
  assert.deepEqual(bridged.calls[0].bridgeIds, ['bridge-1']);

  source.event(
    baseEvent('BRIDGE_ENTERED', {
      channelId: 'channel-2',
      linkedId: 'call-1',
      bridgeId: 'bridge-1',
      streamSequence: 7,
      observedAt: '2026-09-25T12:00:02.000Z',
    }),
  );
  assert.equal(engine.current('pbx-1').revision, 2);

  source.event(
    baseEvent('BRIDGE_LEFT', {
      channelId: 'channel-2',
      linkedId: 'call-1',
      bridgeId: 'older-bridge',
      streamSequence: 8,
      observedAt: '2026-09-25T12:00:02.100Z',
    }),
  );
  assert.equal(
    engine.current('pbx-1').channels.find((channel) => channel.channelId === 'channel-2').bridgeId,
    'bridge-1',
  );
  assert.equal(engine.current('pbx-1').revision, 2);

  source.event(
    baseEvent('CHANNEL_STATE_CHANGED', {
      channelId: 'channel-2',
      linkedId: 'call-1',
      state: 'Down',
      streamSequence: 5,
      observedAt: '2026-09-25T12:00:00.500Z',
    }),
  );
  assert.equal(
    engine.current('pbx-1').channels.find((channel) => channel.channelId === 'channel-2').state,
    'Ring',
  );

  engine.stop();
});

test('reconciliation snapshot repairs drift but preserves events received after each channel snapshot item', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source);
  engine.start();

  source.snapshot(
    snapshot({
      streamStartedSequence: 0,
      channels: [
        {
          channelId: 'channel-1',
          linkedId: 'call-1',
          state: 'Ring',
          streamSequence: 2,
        },
      ],
    }),
  );

  source.event(
    baseEvent('CHANNEL_STATE_CHANGED', {
      channelId: 'channel-1',
      linkedId: 'call-1',
      state: 'Up',
      streamSequence: 4,
      observedAt: '2026-09-25T12:00:02.000Z',
    }),
  );
  source.event(
    baseEvent('BRIDGE_ENTERED', {
      channelId: 'channel-1',
      linkedId: 'call-1',
      bridgeId: 'bridge-1',
      streamSequence: 6,
      observedAt: '2026-09-25T12:00:03.000Z',
    }),
  );

  source.snapshot(
    snapshot({
      startedAt: '2026-09-25T12:00:01.500Z',
      observedAt: '2026-09-25T12:00:04.000Z',
      streamStartedSequence: 3,
      channels: [
        {
          channelId: 'channel-1',
          linkedId: 'call-1',
          state: 'Ring',
          streamSequence: 5,
        },
      ],
    }),
  );

  const current = engine.current('pbx-1');
  assert.equal(current.channels[0].state, 'Ring');
  assert.equal(current.channels[0].bridgeId, 'bridge-1');
  assert.deepEqual(current.calls[0].bridgeIds, ['bridge-1']);
  assert.equal(current.revision, 4);

  engine.stop();
});

test('a newer connection generation is buffered until its authoritative snapshot arrives', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source);
  engine.start();

  source.snapshot(
    snapshot({
      streamStartedSequence: 0,
      channels: [{ channelId: 'old-channel', state: 'Up', streamSequence: 2 }],
    }),
  );

  source.event(
    baseEvent('CHANNEL_CREATED', {
      channelId: 'new-channel',
      linkedId: 'new-call',
      state: 'Ring',
      streamGeneration: 2,
      streamSequence: 1,
      observedAt: '2026-09-25T12:01:00.100Z',
    }),
  );

  let current = engine.current('pbx-1');
  assert.equal(current.synchronization, 'AWAITING_SNAPSHOT');
  assert.deepEqual(
    current.channels.map((channel) => channel.channelId),
    ['old-channel'],
  );

  source.event(
    baseEvent('CHANNEL_STATE_CHANGED', {
      channelId: 'new-channel',
      linkedId: 'new-call',
      state: 'Up',
      streamGeneration: 2,
      streamSequence: 3,
      observedAt: '2026-09-25T12:01:00.300Z',
    }),
  );

  source.snapshot(
    snapshot({
      startedAt: '2026-09-25T12:01:00.000Z',
      observedAt: '2026-09-25T12:01:01.000Z',
      streamGeneration: 2,
      streamStartedSequence: 0,
      channels: [
        {
          channelId: 'new-channel',
          linkedId: 'new-call',
          state: 'Ring',
          streamSequence: 2,
        },
      ],
    }),
  );

  current = engine.current('pbx-1');
  assert.equal(current.synchronization, 'CURRENT');
  assert.deepEqual(
    current.channels.map((channel) => channel.channelId),
    ['new-channel'],
  );
  assert.equal(current.channels[0].state, 'Up');

  engine.stop();
});

test('buffer overflow fails closed until a snapshot starts after the discarded event boundary', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source, { maxBufferedEvents: 2 });
  engine.start();

  for (let sequence = 1; sequence <= 3; sequence += 1) {
    source.event(
      baseEvent('CHANNEL_CREATED', {
        channelId: `channel-${sequence}`,
        streamSequence: sequence,
        observedAt: `2026-09-25T12:00:00.00${sequence}Z`,
      }),
    );
  }

  source.snapshot(
    snapshot({
      streamStartedSequence: 0,
      channels: [{ channelId: 'channel-3', streamSequence: 3 }],
    }),
  );
  assert.equal(engine.current('pbx-1'), undefined);

  source.snapshot(
    snapshot({
      startedAt: '2026-09-25T12:00:02.000Z',
      observedAt: '2026-09-25T12:00:03.000Z',
      streamStartedSequence: 3,
      channels: [{ channelId: 'channel-3', state: 'Up', streamSequence: 4 }],
    }),
  );
  assert.equal(engine.current('pbx-1').channels[0].state, 'Up');

  engine.stop();
});

test('connection health marks initialized state stale until a fresh snapshot restores current state', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source);
  engine.start();

  source.snapshot(
    snapshot({
      streamStartedSequence: 0,
      channels: [{ channelId: 'channel-1', state: 'Up', streamSequence: 1 }],
    }),
  );
  assert.equal(engine.current('pbx-1').synchronization, 'CURRENT');

  source.connection('pbx-1', 'ERROR');
  let current = engine.current('pbx-1');
  assert.equal(current.synchronization, 'STALE');

  source.event(
    baseEvent('CHANNEL_STATE_CHANGED', {
      channelId: 'channel-1',
      state: 'Ring',
      streamSequence: 2,
      observedAt: '2026-09-25T12:00:02.000Z',
    }),
  );
  current = engine.current('pbx-1');
  assert.equal(current.synchronization, 'STALE');
  assert.equal(current.channels[0].state, 'Ring');

  source.connection('pbx-1', 'CONNECTED');
  assert.equal(engine.current('pbx-1').synchronization, 'AWAITING_SNAPSHOT');

  source.snapshot(
    snapshot({
      startedAt: '2026-09-25T12:00:02.500Z',
      observedAt: '2026-09-25T12:00:03.000Z',
      streamStartedSequence: 2,
      channels: [{ channelId: 'channel-1', state: 'Up', streamSequence: 3 }],
    }),
  );
  current = engine.current('pbx-1');
  assert.equal(current.synchronization, 'CURRENT');
  assert.equal(current.channels[0].state, 'Up');

  engine.stop();
});

test('state listeners are isolated and stop unsubscribes from the runtime source', () => {
  const source = new FakeStateSource();
  const engine = new TelephonyStateEngine(source);
  const received = [];
  engine.start();
  engine.subscribe(() => {
    throw new Error('synthetic listener failure');
  });
  engine.subscribe((state) => received.push(state));

  source.snapshot(
    snapshot({
      streamStartedSequence: 0,
      channels: [{ channelId: 'channel-1', state: 'Up', streamSequence: 1 }],
    }),
  );
  assert.equal(received.length, 1);

  source.reset('pbx-1');
  assert.equal(engine.current('pbx-1'), undefined);

  engine.stop();
  source.event(
    baseEvent('CHANNEL_CREATED', {
      channelId: 'channel-2',
      streamSequence: 2,
    }),
  );
  assert.equal(engine.current('pbx-1'), undefined);
});
