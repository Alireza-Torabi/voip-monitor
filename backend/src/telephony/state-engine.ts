import type {
  CapabilityState,
  EndpointReachability,
  EndpointRegistrationState,
  PbxConnectionState,
  ProviderChannelSnapshot,
  ProviderEndpointSnapshot,
  ProviderEvent,
  ProviderEventListener,
  ProviderStateSnapshot,
  ProviderStateSnapshotListener,
  ProviderTrunkSnapshot,
  TrunkKind,
  TrunkRegistrationState,
} from '@voip-monitor/shared';

export type TelephonySynchronization = 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE';

export interface TelephonyChannelState {
  channelId: string;
  channelName?: string;
  linkedId?: string;
  state?: string;
  bridgeId?: string;
  updatedAt: string;
}

export interface TelephonyEndpointState {
  endpointId: string;
  registrationState: EndpointRegistrationState;
  reachability: EndpointReachability;
  updatedAt: string;
}

export interface TelephonyTrunkState {
  trunkId: string;
  kind: TrunkKind;
  registrationState: TrunkRegistrationState;
  updatedAt: string;
}

export interface TelephonyCallState {
  callId: string;
  linkedId?: string;
  channelIds: string[];
  bridgeIds: string[];
  updatedAt: string;
}

export interface TelephonyInstanceState {
  instanceId: string;
  revision: number;
  synchronization: TelephonySynchronization;
  lastSnapshotAt: string;
  lastEventAt?: string;
  channels: TelephonyChannelState[];
  calls: TelephonyCallState[];
  endpointCapability: CapabilityState;
  endpointSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  endpoints: TelephonyEndpointState[];
  trunkCapability: CapabilityState;
  trunkSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  trunks: TelephonyTrunkState[];
}

export type TelephonyStateListener = (state: TelephonyInstanceState) => void;

export interface TelephonyStateSource {
  subscribeEvents(listener: ProviderEventListener): () => void;
  subscribeSnapshots(listener: ProviderStateSnapshotListener): () => void;
  subscribeConnectionStates?(
    listener: (instanceId: string, state: PbxConnectionState) => void,
  ): () => void;
  subscribeInstanceResets?(listener: (instanceId: string) => void): () => void;
}

export interface TelephonyStateEngineOptions {
  maxBufferedEvents?: number;
}

interface ChannelOrder {
  streamGeneration?: number;
  streamSequence?: number;
  observedAt: string;
}

interface MutableChannel extends TelephonyChannelState {
  order: ChannelOrder;
}

interface MutableEndpoint extends TelephonyEndpointState {
  order: ChannelOrder;
}

interface MutableTrunk extends TelephonyTrunkState {
  order: ChannelOrder;
}

interface JournalEvent {
  arrival: number;
  event: ProviderEvent;
}

interface EngineEntry {
  instanceId: string;
  initialized: boolean;
  revision: number;
  synchronization: TelephonySynchronization;
  streamGeneration?: number;
  channels: Map<string, MutableChannel>;
  endpoints: Map<string, MutableEndpoint>;
  endpointCapability: CapabilityState;
  endpointSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  trunks: Map<string, MutableTrunk>;
  trunkCapability: CapabilityState;
  trunkSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  journal: JournalEvent[];
  droppedUntil?: ChannelOrder;
  lastSnapshotAt?: string;
  lastEventAt?: string;
}

function cloneEvent(event: ProviderEvent): ProviderEvent {
  return structuredClone(event);
}

function orderFromEvent(event: ProviderEvent): ChannelOrder {
  return {
    ...(event.streamGeneration === undefined ? {} : { streamGeneration: event.streamGeneration }),
    ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
    observedAt: event.observedAt,
  };
}

function compareOrder(candidate: ChannelOrder, current: ChannelOrder): number {
  if (
    candidate.streamGeneration !== undefined &&
    current.streamGeneration !== undefined &&
    candidate.streamGeneration !== current.streamGeneration
  ) {
    return candidate.streamGeneration > current.streamGeneration ? 1 : -1;
  }
  if (
    candidate.streamSequence !== undefined &&
    current.streamSequence !== undefined &&
    candidate.streamGeneration === current.streamGeneration &&
    candidate.streamSequence !== current.streamSequence
  ) {
    return candidate.streamSequence > current.streamSequence ? 1 : -1;
  }
  if (candidate.observedAt === current.observedAt) return 0;
  return candidate.observedAt > current.observedAt ? 1 : -1;
}

function affectedChannelIds(event: ProviderEvent): string[] {
  switch (event.type) {
    case 'CHANNEL_CREATED':
    case 'CHANNEL_STATE_CHANGED':
    case 'CHANNEL_DESTROYED':
    case 'BRIDGE_ENTERED':
    case 'BRIDGE_LEFT':
      return [event.channelId];
    case 'DIAL_STARTED':
    case 'DIAL_ENDED':
      return [
        event.sourceChannelId,
        ...(event.destinationChannelId ? [event.destinationChannelId] : []),
      ];
    case 'ENDPOINT_STATUS_CHANGED':
    case 'TRUNK_REGISTRATION_CHANGED':
      return [];
  }
}

function callStates(channels: Iterable<MutableChannel>): TelephonyCallState[] {
  const groups = new Map<
    string,
    { linkedId?: string; channelIds: string[]; bridgeIds: Set<string>; updatedAt: string }
  >();

  for (const channel of channels) {
    const callId = channel.linkedId ?? channel.channelId;
    const current = groups.get(callId) ?? {
      ...(channel.linkedId ? { linkedId: channel.linkedId } : {}),
      channelIds: [],
      bridgeIds: new Set<string>(),
      updatedAt: channel.updatedAt,
    };
    current.channelIds.push(channel.channelId);
    if (channel.bridgeId) current.bridgeIds.add(channel.bridgeId);
    if (channel.updatedAt > current.updatedAt) current.updatedAt = channel.updatedAt;
    groups.set(callId, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([callId, value]) => ({
      callId,
      ...(value.linkedId ? { linkedId: value.linkedId } : {}),
      channelIds: value.channelIds.sort((left, right) => left.localeCompare(right)),
      bridgeIds: [...value.bridgeIds].sort((left, right) => left.localeCompare(right)),
      updatedAt: value.updatedAt,
    }));
}

function publicState(entry: EngineEntry): TelephonyInstanceState | undefined {
  if (!entry.initialized || !entry.lastSnapshotAt) return undefined;
  const channels = [...entry.channels.values()]
    .sort((left, right) => left.channelId.localeCompare(right.channelId))
    .map((channel) => ({
      channelId: channel.channelId,
      ...(channel.channelName ? { channelName: channel.channelName } : {}),
      ...(channel.linkedId ? { linkedId: channel.linkedId } : {}),
      ...(channel.state ? { state: channel.state } : {}),
      ...(channel.bridgeId ? { bridgeId: channel.bridgeId } : {}),
      updatedAt: channel.updatedAt,
    }));
  const endpoints = [...entry.endpoints.values()]
    .sort((left, right) => left.endpointId.localeCompare(right.endpointId))
    .map((endpoint) => ({
      endpointId: endpoint.endpointId,
      registrationState: endpoint.registrationState,
      reachability: endpoint.reachability,
      updatedAt: endpoint.updatedAt,
    }));
  const trunks = [...entry.trunks.values()]
    .sort((left, right) => left.trunkId.localeCompare(right.trunkId))
    .map((trunk) => ({
      trunkId: trunk.trunkId,
      kind: trunk.kind,
      registrationState: trunk.registrationState,
      updatedAt: trunk.updatedAt,
    }));
  return {
    instanceId: entry.instanceId,
    revision: entry.revision,
    synchronization: entry.synchronization,
    lastSnapshotAt: entry.lastSnapshotAt,
    ...(entry.lastEventAt ? { lastEventAt: entry.lastEventAt } : {}),
    channels,
    calls: callStates(entry.channels.values()),
    endpointCapability: entry.endpointCapability,
    endpointSynchronization: entry.endpointSynchronization,
    endpoints,
    trunkCapability: entry.trunkCapability,
    trunkSynchronization: entry.trunkSynchronization,
    trunks,
  };
}
function snapshotChannelOrder(
  snapshot: ProviderStateSnapshot,
  channel: ProviderChannelSnapshot,
): ChannelOrder {
  return {
    ...(snapshot.streamGeneration === undefined
      ? {}
      : { streamGeneration: snapshot.streamGeneration }),
    ...(channel.streamSequence === undefined ? {} : { streamSequence: channel.streamSequence }),
    observedAt: snapshot.observedAt,
  };
}

function eventIsAfterSnapshotChannel(
  event: ProviderEvent,
  snapshot: ProviderStateSnapshot,
  channelId: string,
): boolean {
  if (
    event.streamGeneration !== undefined &&
    snapshot.streamGeneration !== undefined &&
    event.streamGeneration !== snapshot.streamGeneration
  ) {
    return event.streamGeneration > snapshot.streamGeneration;
  }

  const snapshotChannel = snapshot.channels.find((channel) => channel.channelId === channelId);
  const boundarySequence = snapshotChannel?.streamSequence ?? snapshot.streamStartedSequence;
  if (
    event.streamSequence !== undefined &&
    boundarySequence !== undefined &&
    (event.streamGeneration === undefined ||
      snapshot.streamGeneration === undefined ||
      event.streamGeneration === snapshot.streamGeneration)
  ) {
    return event.streamSequence > boundarySequence;
  }

  const boundaryTime = snapshot.startedAt ?? snapshot.observedAt;
  return event.observedAt >= boundaryTime;
}

function endpointSnapshotOrder(
  snapshot: ProviderStateSnapshot,
  endpoint: ProviderEndpointSnapshot,
): ChannelOrder {
  const state = snapshot.endpointState;
  if (!state) {
    return { observedAt: snapshot.observedAt };
  }
  return {
    ...(state.streamGeneration === undefined ? {} : { streamGeneration: state.streamGeneration }),
    ...(endpoint.streamSequence === undefined ? {} : { streamSequence: endpoint.streamSequence }),
    observedAt: state.observedAt,
  };
}

function eventIsAfterEndpointSnapshot(
  event: ProviderEvent,
  snapshot: ProviderStateSnapshot,
): boolean {
  const state = snapshot.endpointState;
  if (!state || state.capability !== 'SUPPORTED') return false;
  if (
    event.streamGeneration !== undefined &&
    state.streamGeneration !== undefined &&
    event.streamGeneration !== state.streamGeneration
  ) {
    return event.streamGeneration > state.streamGeneration;
  }
  const endpoint =
    event.type === 'ENDPOINT_STATUS_CHANGED'
      ? state.endpoints.find((item) => item.endpointId === event.endpointId)
      : undefined;
  const boundarySequence = endpoint?.streamSequence ?? state.streamStartedSequence;
  if (
    event.streamSequence !== undefined &&
    boundarySequence !== undefined &&
    (event.streamGeneration === undefined ||
      state.streamGeneration === undefined ||
      event.streamGeneration === state.streamGeneration)
  ) {
    return event.streamSequence > boundarySequence;
  }
  return event.observedAt >= (state.startedAt ?? state.observedAt);
}

function trunkSnapshotOrder(
  snapshot: ProviderStateSnapshot,
  trunk: ProviderTrunkSnapshot,
): ChannelOrder {
  const state = snapshot.trunkState;
  if (!state) return { observedAt: snapshot.observedAt };
  return {
    ...(state.streamGeneration === undefined ? {} : { streamGeneration: state.streamGeneration }),
    ...(trunk.streamSequence === undefined ? {} : { streamSequence: trunk.streamSequence }),
    observedAt: state.observedAt,
  };
}

function eventIsAfterTrunkSnapshot(event: ProviderEvent, snapshot: ProviderStateSnapshot): boolean {
  const state = snapshot.trunkState;
  if (!state || state.capability !== 'SUPPORTED') return false;
  if (
    event.streamGeneration !== undefined &&
    state.streamGeneration !== undefined &&
    event.streamGeneration !== state.streamGeneration
  ) {
    return event.streamGeneration > state.streamGeneration;
  }
  const trunk =
    event.type === 'TRUNK_REGISTRATION_CHANGED'
      ? state.trunks.find((item) => item.trunkId === event.trunkId)
      : undefined;
  const boundarySequence = trunk?.streamSequence ?? state.streamStartedSequence;
  if (
    event.streamSequence !== undefined &&
    boundarySequence !== undefined &&
    (event.streamGeneration === undefined ||
      state.streamGeneration === undefined ||
      event.streamGeneration === state.streamGeneration)
  ) {
    return event.streamSequence > boundarySequence;
  }
  return event.observedAt >= (state.startedAt ?? state.observedAt);
}

function boundaryCanRecoverDroppedJournal(
  streamGeneration: number | undefined,
  streamStartedSequence: number | undefined,
  startedAt: string | undefined,
  observedAt: string,
  droppedUntil: ChannelOrder,
): boolean {
  if (
    streamGeneration !== undefined &&
    droppedUntil.streamGeneration !== undefined &&
    streamGeneration !== droppedUntil.streamGeneration
  ) {
    return streamGeneration > droppedUntil.streamGeneration;
  }
  if (
    streamStartedSequence !== undefined &&
    droppedUntil.streamSequence !== undefined &&
    (streamGeneration === undefined ||
      droppedUntil.streamGeneration === undefined ||
      streamGeneration === droppedUntil.streamGeneration)
  ) {
    return streamStartedSequence >= droppedUntil.streamSequence;
  }
  return (startedAt ?? observedAt) >= droppedUntil.observedAt;
}

function snapshotCanRecoverDroppedJournal(
  snapshot: ProviderStateSnapshot,
  droppedUntil: ChannelOrder | undefined,
): boolean {
  if (!droppedUntil) return true;
  if (
    !boundaryCanRecoverDroppedJournal(
      snapshot.streamGeneration,
      snapshot.streamStartedSequence,
      snapshot.startedAt,
      snapshot.observedAt,
      droppedUntil,
    )
  ) {
    return false;
  }
  for (const state of [snapshot.endpointState, snapshot.trunkState]) {
    if (
      state?.capability === 'SUPPORTED' &&
      !boundaryCanRecoverDroppedJournal(
        state.streamGeneration,
        state.streamStartedSequence,
        state.startedAt,
        state.observedAt,
        droppedUntil,
      )
    ) {
      return false;
    }
  }
  return true;
}

function mergeChannel(
  entry: EngineEntry,
  channelId: string,
  event: ProviderEvent,
  patch: Partial<Omit<MutableChannel, 'channelId' | 'updatedAt' | 'order'>>,
  createIfMissing: boolean,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterSnapshotChannel(event, replaySnapshot, channelId))
    return false;

  const order = orderFromEvent(event);
  const existing = entry.channels.get(channelId);
  if (!replaySnapshot && existing && compareOrder(order, existing.order) < 0) return false;
  if (!existing && !createIfMissing) return false;

  const next: MutableChannel = {
    channelId,
    ...(existing?.channelName ? { channelName: existing.channelName } : {}),
    ...(existing?.linkedId ? { linkedId: existing.linkedId } : {}),
    ...(existing?.state ? { state: existing.state } : {}),
    ...(existing?.bridgeId ? { bridgeId: existing.bridgeId } : {}),
    ...patch,
    updatedAt: event.observedAt,
    order,
  };

  const changed =
    !existing ||
    existing.channelName !== next.channelName ||
    existing.linkedId !== next.linkedId ||
    existing.state !== next.state ||
    existing.bridgeId !== next.bridgeId;

  entry.channels.set(channelId, next);
  return changed;
}

function mergeEndpoint(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'ENDPOINT_STATUS_CHANGED' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterEndpointSnapshot(event, replaySnapshot)) return false;
  const order = orderFromEvent(event);
  const existing = entry.endpoints.get(event.endpointId);
  if (!replaySnapshot && existing && compareOrder(order, existing.order) < 0) return false;
  const next: MutableEndpoint = {
    endpointId: event.endpointId,
    registrationState:
      event.registrationState === 'UNKNOWN'
        ? (existing?.registrationState ?? 'UNKNOWN')
        : event.registrationState,
    reachability:
      event.reachability === 'UNKNOWN' ? (existing?.reachability ?? 'UNKNOWN') : event.reachability,
    updatedAt: event.observedAt,
    order,
  };
  const changed =
    !existing ||
    existing.registrationState !== next.registrationState ||
    existing.reachability !== next.reachability;
  entry.endpoints.set(event.endpointId, next);
  return changed;
}

function mergeTrunk(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'TRUNK_REGISTRATION_CHANGED' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterTrunkSnapshot(event, replaySnapshot)) return false;
  const order = orderFromEvent(event);
  const existing = entry.trunks.get(event.trunkId);
  if (!replaySnapshot && existing && compareOrder(order, existing.order) < 0) return false;
  const next: MutableTrunk = {
    trunkId: event.trunkId,
    kind: event.kind,
    registrationState:
      event.registrationState === 'UNKNOWN'
        ? (existing?.registrationState ?? 'UNKNOWN')
        : event.registrationState,
    updatedAt: event.observedAt,
    order,
  };
  const changed =
    !existing ||
    existing.kind !== next.kind ||
    existing.registrationState !== next.registrationState;
  entry.trunks.set(event.trunkId, next);
  return changed;
}

function applyEvent(
  entry: EngineEntry,
  event: ProviderEvent,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  switch (event.type) {
    case 'CHANNEL_CREATED':
      return mergeChannel(
        entry,
        event.channelId,
        event,
        {
          ...(event.channelName ? { channelName: event.channelName } : {}),
          ...(event.linkedId ? { linkedId: event.linkedId } : {}),
          ...(event.state ? { state: event.state } : {}),
        },
        true,
        replaySnapshot,
      );

    case 'CHANNEL_STATE_CHANGED':
      return mergeChannel(
        entry,
        event.channelId,
        event,
        {
          ...(event.channelName ? { channelName: event.channelName } : {}),
          ...(event.linkedId ? { linkedId: event.linkedId } : {}),
          state: event.state,
        },
        true,
        replaySnapshot,
      );

    case 'CHANNEL_DESTROYED': {
      if (replaySnapshot && !eventIsAfterSnapshotChannel(event, replaySnapshot, event.channelId)) {
        return false;
      }
      const existing = entry.channels.get(event.channelId);
      if (!existing) return false;
      if (!replaySnapshot && compareOrder(orderFromEvent(event), existing.order) < 0) return false;
      entry.channels.delete(event.channelId);
      return true;
    }

    case 'BRIDGE_ENTERED':
      return mergeChannel(
        entry,
        event.channelId,
        event,
        {
          ...(event.channelName ? { channelName: event.channelName } : {}),
          ...(event.linkedId ? { linkedId: event.linkedId } : {}),
          bridgeId: event.bridgeId,
        },
        true,
        replaySnapshot,
      );

    case 'BRIDGE_LEFT': {
      if (replaySnapshot && !eventIsAfterSnapshotChannel(event, replaySnapshot, event.channelId)) {
        return false;
      }
      const existing = entry.channels.get(event.channelId);
      if (!existing) return false;
      if (!replaySnapshot && compareOrder(orderFromEvent(event), existing.order) < 0) return false;
      if (existing.bridgeId !== event.bridgeId) {
        return mergeChannel(
          entry,
          event.channelId,
          event,
          {
            ...(event.channelName ? { channelName: event.channelName } : {}),
            ...(event.linkedId ? { linkedId: event.linkedId } : {}),
          },
          false,
          replaySnapshot,
        );
      }
      entry.channels.set(event.channelId, {
        channelId: existing.channelId,
        ...((event.channelName ?? existing.channelName)
          ? { channelName: event.channelName ?? existing.channelName }
          : {}),
        ...((event.linkedId ?? existing.linkedId)
          ? { linkedId: event.linkedId ?? existing.linkedId }
          : {}),
        ...(existing.state ? { state: existing.state } : {}),
        updatedAt: event.observedAt,
        order: orderFromEvent(event),
      });
      return true;
    }
    case 'DIAL_STARTED':
    case 'DIAL_ENDED': {
      if (!event.linkedId) return false;
      let changed = false;
      for (const channelId of affectedChannelIds(event)) {
        changed =
          mergeChannel(
            entry,
            channelId,
            event,
            { linkedId: event.linkedId },
            false,
            replaySnapshot,
          ) || changed;
      }
      return changed;
    }

    case 'ENDPOINT_STATUS_CHANGED':
      return mergeEndpoint(entry, event, replaySnapshot);

    case 'TRUNK_REGISTRATION_CHANGED':
      return mergeTrunk(entry, event, replaySnapshot);
  }
}

export class TelephonyStateEngine {
  private readonly entries = new Map<string, EngineEntry>();
  private readonly listeners = new Set<TelephonyStateListener>();
  private readonly maxBufferedEvents: number;
  private arrivalCounter = 0;
  private unsubscribeEvents: (() => void) | undefined;
  private unsubscribeSnapshots: (() => void) | undefined;
  private unsubscribeConnectionStates: (() => void) | undefined;
  private unsubscribeInstanceResets: (() => void) | undefined;

  constructor(
    private readonly source: TelephonyStateSource,
    options: TelephonyStateEngineOptions = {},
  ) {
    this.maxBufferedEvents = options.maxBufferedEvents ?? 10_000;
    if (!Number.isInteger(this.maxBufferedEvents) || this.maxBufferedEvents < 1) {
      throw new Error('Telephony state engine maxBufferedEvents must be a positive integer');
    }
  }

  start(): void {
    if (this.unsubscribeEvents || this.unsubscribeSnapshots) return;
    this.unsubscribeEvents = this.source.subscribeEvents((event) => this.handleEvent(event));
    this.unsubscribeSnapshots = this.source.subscribeSnapshots((snapshot) =>
      this.handleSnapshot(snapshot),
    );
    this.unsubscribeConnectionStates = this.source.subscribeConnectionStates?.(
      (instanceId, state) => this.handleConnectionState(instanceId, state),
    );
    this.unsubscribeInstanceResets = this.source.subscribeInstanceResets?.((instanceId) =>
      this.remove(instanceId),
    );
  }

  stop(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeSnapshots?.();
    this.unsubscribeConnectionStates?.();
    this.unsubscribeInstanceResets?.();
    this.unsubscribeEvents = undefined;
    this.unsubscribeSnapshots = undefined;
    this.unsubscribeConnectionStates = undefined;
    this.unsubscribeInstanceResets = undefined;
  }

  current(instanceId: string): TelephonyInstanceState | undefined {
    const entry = this.entries.get(instanceId);
    const state = entry ? publicState(entry) : undefined;
    return state ? structuredClone(state) : undefined;
  }

  subscribe(listener: TelephonyStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  remove(instanceId: string): void {
    this.entries.delete(instanceId);
  }

  private entry(instanceId: string): EngineEntry {
    const current = this.entries.get(instanceId);
    if (current) return current;
    const created: EngineEntry = {
      instanceId,
      initialized: false,
      revision: 0,
      synchronization: 'AWAITING_SNAPSHOT',
      channels: new Map(),
      endpoints: new Map(),
      endpointCapability: 'UNKNOWN',
      endpointSynchronization: 'AWAITING_SNAPSHOT',
      trunks: new Map(),
      trunkCapability: 'UNKNOWN',
      trunkSynchronization: 'AWAITING_SNAPSHOT',
      journal: [],
    };
    this.entries.set(instanceId, created);
    return created;
  }

  private handleConnectionState(instanceId: string, state: PbxConnectionState): void {
    const entry = this.entries.get(instanceId);
    if (!entry?.initialized) return;
    const next: TelephonySynchronization =
      state === 'CONNECTED'
        ? entry.synchronization === 'STALE'
          ? 'AWAITING_SNAPSHOT'
          : entry.synchronization
        : 'STALE';
    const endpointNext =
      entry.endpointSynchronization === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : state === 'CONNECTED'
          ? entry.endpointSynchronization === 'STALE'
            ? 'AWAITING_SNAPSHOT'
            : entry.endpointSynchronization
          : 'STALE';
    const trunkNext =
      entry.trunkSynchronization === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : state === 'CONNECTED'
          ? entry.trunkSynchronization === 'STALE'
            ? 'AWAITING_SNAPSHOT'
            : entry.trunkSynchronization
          : 'STALE';
    if (
      next === entry.synchronization &&
      endpointNext === entry.endpointSynchronization &&
      trunkNext === entry.trunkSynchronization
    ) {
      return;
    }
    entry.synchronization = next;
    entry.endpointSynchronization = endpointNext;
    entry.trunkSynchronization = trunkNext;
    entry.revision += 1;
    this.emit(entry);
  }

  private handleEvent(incoming: ProviderEvent): void {
    const event = cloneEvent(incoming);
    const entry = this.entry(event.instanceId);

    if (
      entry.streamGeneration !== undefined &&
      event.streamGeneration !== undefined &&
      event.streamGeneration > entry.streamGeneration
    ) {
      entry.journal = entry.journal.filter(
        ({ event: buffered }) =>
          buffered.streamGeneration === undefined ||
          buffered.streamGeneration >= event.streamGeneration!,
      );
      delete entry.droppedUntil;
      if (
        entry.initialized &&
        (entry.synchronization !== 'AWAITING_SNAPSHOT' ||
          (entry.endpointSynchronization !== 'UNAVAILABLE' &&
            entry.endpointSynchronization !== 'AWAITING_SNAPSHOT') ||
          (entry.trunkSynchronization !== 'UNAVAILABLE' &&
            entry.trunkSynchronization !== 'AWAITING_SNAPSHOT'))
      ) {
        entry.synchronization = 'AWAITING_SNAPSHOT';
        if (entry.endpointSynchronization !== 'UNAVAILABLE') {
          entry.endpointSynchronization = 'AWAITING_SNAPSHOT';
        }
        if (entry.trunkSynchronization !== 'UNAVAILABLE') {
          entry.trunkSynchronization = 'AWAITING_SNAPSHOT';
        }
        entry.revision += 1;
        this.emit(entry);
      }
    }

    this.appendJournal(entry, event);

    if (!entry.initialized) return;
    if (event.type === 'ENDPOINT_STATUS_CHANGED' && entry.endpointSynchronization !== 'CURRENT') {
      return;
    }
    if (event.type === 'TRUNK_REGISTRATION_CHANGED' && entry.trunkSynchronization !== 'CURRENT') {
      return;
    }
    if (
      entry.streamGeneration !== undefined &&
      event.streamGeneration !== undefined &&
      event.streamGeneration !== entry.streamGeneration
    ) {
      return;
    }

    const changed = applyEvent(entry, event);
    if (event.observedAt > (entry.lastEventAt ?? '')) entry.lastEventAt = event.observedAt;
    if (!changed) return;
    entry.revision += 1;
    this.emit(entry);
  }

  private handleSnapshot(snapshotInput: ProviderStateSnapshot): void {
    const snapshot = structuredClone(snapshotInput);
    const entry = this.entry(snapshot.instanceId);

    if (
      entry.streamGeneration !== undefined &&
      snapshot.streamGeneration !== undefined &&
      snapshot.streamGeneration < entry.streamGeneration
    ) {
      return;
    }

    if (!snapshotCanRecoverDroppedJournal(snapshot, entry.droppedUntil)) {
      if (entry.initialized && entry.synchronization !== 'AWAITING_SNAPSHOT') {
        entry.synchronization = 'AWAITING_SNAPSHOT';
        entry.revision += 1;
        this.emit(entry);
      }
      return;
    }

    const channels = new Map<string, MutableChannel>();
    for (const channel of snapshot.channels) {
      channels.set(channel.channelId, {
        channelId: channel.channelId,
        ...(channel.channelName ? { channelName: channel.channelName } : {}),
        ...(channel.linkedId ? { linkedId: channel.linkedId } : {}),
        ...(channel.state ? { state: channel.state } : {}),
        ...(channel.bridgeId ? { bridgeId: channel.bridgeId } : {}),
        updatedAt: snapshot.observedAt,
        order: snapshotChannelOrder(snapshot, channel),
      });
    }

    entry.channels = channels;
    const endpointState = snapshot.endpointState;
    if (endpointState?.capability === 'SUPPORTED') {
      const endpoints = new Map<string, MutableEndpoint>();
      for (const endpoint of endpointState.endpoints) {
        endpoints.set(endpoint.endpointId, {
          endpointId: endpoint.endpointId,
          registrationState: endpoint.registrationState,
          reachability: endpoint.reachability,
          updatedAt: endpointState.observedAt,
          order: endpointSnapshotOrder(snapshot, endpoint),
        });
      }
      entry.endpoints = endpoints;
      entry.endpointCapability = 'SUPPORTED';
      entry.endpointSynchronization = 'CURRENT';
    } else if (endpointState) {
      entry.endpoints = new Map();
      entry.endpointCapability = endpointState.capability;
      entry.endpointSynchronization = 'UNAVAILABLE';
    } else {
      entry.endpoints = new Map();
      entry.endpointCapability = 'UNKNOWN';
      entry.endpointSynchronization = 'AWAITING_SNAPSHOT';
    }
    const trunkState = snapshot.trunkState;
    if (trunkState?.capability === 'SUPPORTED') {
      const trunks = new Map<string, MutableTrunk>();
      for (const trunk of trunkState.trunks) {
        trunks.set(trunk.trunkId, {
          trunkId: trunk.trunkId,
          kind: trunk.kind,
          registrationState: trunk.registrationState,
          updatedAt: trunkState.observedAt,
          order: trunkSnapshotOrder(snapshot, trunk),
        });
      }
      entry.trunks = trunks;
      entry.trunkCapability = 'SUPPORTED';
      entry.trunkSynchronization = 'CURRENT';
    } else if (trunkState) {
      entry.trunks = new Map();
      entry.trunkCapability = trunkState.capability;
      entry.trunkSynchronization = 'UNAVAILABLE';
    } else {
      entry.trunks = new Map();
      entry.trunkCapability = 'UNKNOWN';
      entry.trunkSynchronization = 'AWAITING_SNAPSHOT';
    }
    if (snapshot.streamGeneration === undefined) delete entry.streamGeneration;
    else entry.streamGeneration = snapshot.streamGeneration;
    entry.lastSnapshotAt = snapshot.observedAt;
    entry.synchronization = 'CURRENT';

    const retained: JournalEvent[] = [];
    let replayedLastEventAt: string | undefined;
    for (const buffered of entry.journal.sort((left, right) => left.arrival - right.arrival)) {
      const event = buffered.event;
      if (
        snapshot.streamGeneration !== undefined &&
        event.streamGeneration !== undefined &&
        event.streamGeneration > snapshot.streamGeneration
      ) {
        retained.push(buffered);
        continue;
      }
      if (
        snapshot.streamGeneration !== undefined &&
        event.streamGeneration !== undefined &&
        event.streamGeneration < snapshot.streamGeneration
      ) {
        continue;
      }

      const relevant =
        event.type === 'ENDPOINT_STATUS_CHANGED'
          ? eventIsAfterEndpointSnapshot(event, snapshot)
          : event.type === 'TRUNK_REGISTRATION_CHANGED'
            ? eventIsAfterTrunkSnapshot(event, snapshot)
            : affectedChannelIds(event).some((channelId) =>
                eventIsAfterSnapshotChannel(event, snapshot, channelId),
              );
      if (!relevant) continue;
      applyEvent(entry, event, snapshot);
      if (event.observedAt > (replayedLastEventAt ?? '')) replayedLastEventAt = event.observedAt;
    }

    entry.journal = retained;
    delete entry.droppedUntil;
    entry.initialized = true;
    entry.revision += 1;
    if (replayedLastEventAt && replayedLastEventAt > (entry.lastEventAt ?? '')) {
      entry.lastEventAt = replayedLastEventAt;
    }
    this.emit(entry);
  }

  private appendJournal(entry: EngineEntry, event: ProviderEvent): void {
    entry.journal.push({ arrival: ++this.arrivalCounter, event });
    if (entry.journal.length <= this.maxBufferedEvents) return;
    const dropped = entry.journal.shift();
    if (dropped) entry.droppedUntil = orderFromEvent(dropped.event);
  }

  private emit(entry: EngineEntry): void {
    const state = publicState(entry);
    if (!state) return;
    for (const listener of this.listeners) {
      try {
        listener(structuredClone(state));
      } catch {
        // State consumers are isolated from provider/runtime processing.
      }
    }
  }
}
