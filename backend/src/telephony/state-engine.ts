import type {
  AgentInteractionPhase,
  CapabilityState,
  EndpointReachability,
  EndpointRegistrationState,
  PbxConnectionState,
  ProviderChannelSnapshot,
  ProviderEndpointSnapshot,
  ProviderEvent,
  ProviderEventListener,
  ProviderQueueCallerSnapshot,
  ProviderQueueMemberSnapshot,
  ProviderQueueSnapshot,
  ProviderStateSnapshot,
  ProviderStateSnapshotListener,
  ProviderTrunkSnapshot,
  QueueMemberAvailability,
  TrunkKind,
  TrunkRegistrationState,
} from '@voip-monitor/shared';

export type TelephonySynchronization = 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE';
export type AgentInteractionSynchronization = 'LIVE_ONLY' | 'STALE';

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

export interface TelephonyQueueState {
  queueId: string;
  strategy?: string;
  waitingCount: number;
  updatedAt: string;
}

export interface TelephonyQueueMemberState {
  queueId: string;
  memberId: string;
  memberName?: string;
  availability: QueueMemberAvailability;
  paused: boolean;
  inCall: boolean;
  updatedAt: string;
}

export interface TelephonyQueueCallerState {
  queueId: string;
  callerId: string;
  position?: number;
  waitSeconds?: number;
  updatedAt: string;
}

export interface TelephonyAgentInteractionState {
  queueId: string;
  callerId: string;
  memberId: string;
  memberName?: string;
  phase: AgentInteractionPhase;
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
  queueCapability: CapabilityState;
  queueSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  queues: TelephonyQueueState[];
  queueMembers: TelephonyQueueMemberState[];
  queueCallers: TelephonyQueueCallerState[];
  agentCapability: CapabilityState;
  agentSynchronization: AgentInteractionSynchronization;
  agentInteractions: TelephonyAgentInteractionState[];
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

interface MutableQueue extends Omit<TelephonyQueueState, 'waitingCount'> {
  order: ChannelOrder;
}

interface MutableQueueMember extends TelephonyQueueMemberState {
  order: ChannelOrder;
}

interface MutableQueueCaller extends TelephonyQueueCallerState {
  order: ChannelOrder;
}

interface MutableAgentInteraction extends TelephonyAgentInteractionState {
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
  queues: Map<string, MutableQueue>;
  queueMembers: Map<string, MutableQueueMember>;
  queueCallers: Map<string, MutableQueueCaller>;
  queueCapability: CapabilityState;
  queueSynchronization: TelephonySynchronization | 'UNAVAILABLE';
  agentInteractions: Map<string, MutableAgentInteraction>;
  agentCapability: CapabilityState;
  agentSynchronization: AgentInteractionSynchronization;
  journal: JournalEvent[];
  droppedUntil?: ChannelOrder;
  lastSnapshotAt?: string;
  lastEventAt?: string;
}

function queueMemberKey(queueId: string, memberId: string): string {
  return `${queueId}\u0000${memberId}`;
}

function queueCallerKey(queueId: string, callerId: string): string {
  return `${queueId}\u0000${callerId}`;
}

function agentInteractionKey(queueId: string, callerId: string, memberId: string): string {
  return `${queueId}\u0000${callerId}\u0000${memberId}`;
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
    case 'QUEUE_MEMBER_CHANGED':
    case 'QUEUE_MEMBER_REMOVED':
    case 'QUEUE_CALLER_JOINED':
    case 'QUEUE_CALLER_LEFT':
    case 'AGENT_CALLED':
    case 'AGENT_RING_NO_ANSWER':
    case 'AGENT_CONNECTED':
    case 'AGENT_COMPLETED':
    case 'AGENT_DUMPED':
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
  const queueMembers = [...entry.queueMembers.values()]
    .sort(
      (left, right) =>
        left.queueId.localeCompare(right.queueId) || left.memberId.localeCompare(right.memberId),
    )
    .map((member) => ({
      queueId: member.queueId,
      memberId: member.memberId,
      ...(member.memberName ? { memberName: member.memberName } : {}),
      availability: member.availability,
      paused: member.paused,
      inCall: member.inCall,
      updatedAt: member.updatedAt,
    }));
  const queueCallers = [...entry.queueCallers.values()]
    .sort(
      (left, right) =>
        left.queueId.localeCompare(right.queueId) || left.callerId.localeCompare(right.callerId),
    )
    .map((caller) => ({
      queueId: caller.queueId,
      callerId: caller.callerId,
      ...(caller.position === undefined ? {} : { position: caller.position }),
      ...(caller.waitSeconds === undefined ? {} : { waitSeconds: caller.waitSeconds }),
      updatedAt: caller.updatedAt,
    }));
  const agentInteractions = [...entry.agentInteractions.values()]
    .sort(
      (left, right) =>
        left.queueId.localeCompare(right.queueId) ||
        left.callerId.localeCompare(right.callerId) ||
        left.memberId.localeCompare(right.memberId),
    )
    .map((interaction) => ({
      queueId: interaction.queueId,
      callerId: interaction.callerId,
      memberId: interaction.memberId,
      ...(interaction.memberName ? { memberName: interaction.memberName } : {}),
      phase: interaction.phase,
      updatedAt: interaction.updatedAt,
    }));
  const queues = [...entry.queues.values()]
    .sort((left, right) => left.queueId.localeCompare(right.queueId))
    .map((queue) => ({
      queueId: queue.queueId,
      ...(queue.strategy ? { strategy: queue.strategy } : {}),
      waitingCount: queueCallers.filter((caller) => caller.queueId === queue.queueId).length,
      updatedAt: queue.updatedAt,
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
    queueCapability: entry.queueCapability,
    queueSynchronization: entry.queueSynchronization,
    queues,
    queueMembers,
    queueCallers,
    agentCapability: entry.agentCapability,
    agentSynchronization: entry.agentSynchronization,
    agentInteractions,
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

function queueSnapshotOrder(
  snapshot: ProviderStateSnapshot,
  item: ProviderQueueSnapshot | ProviderQueueMemberSnapshot | ProviderQueueCallerSnapshot,
): ChannelOrder {
  const state = snapshot.queueState;
  if (!state) return { observedAt: snapshot.observedAt };
  return {
    ...(state.streamGeneration === undefined ? {} : { streamGeneration: state.streamGeneration }),
    ...(item.streamSequence === undefined ? {} : { streamSequence: item.streamSequence }),
    observedAt: state.observedAt,
  };
}

function eventIsAfterQueueSnapshot(event: ProviderEvent, snapshot: ProviderStateSnapshot): boolean {
  const state = snapshot.queueState;
  if (!state || state.capability !== 'SUPPORTED') return false;
  if (
    event.streamGeneration !== undefined &&
    state.streamGeneration !== undefined &&
    event.streamGeneration !== state.streamGeneration
  ) {
    return event.streamGeneration > state.streamGeneration;
  }

  let boundarySequence = state.streamStartedSequence;
  if (event.type === 'QUEUE_MEMBER_CHANGED' || event.type === 'QUEUE_MEMBER_REMOVED') {
    boundarySequence =
      state.members.find(
        (item) => item.queueId === event.queueId && item.memberId === event.memberId,
      )?.streamSequence ?? state.streamStartedSequence;
  } else if (event.type === 'QUEUE_CALLER_JOINED' || event.type === 'QUEUE_CALLER_LEFT') {
    boundarySequence =
      state.callers.find(
        (item) => item.queueId === event.queueId && item.callerId === event.callerId,
      )?.streamSequence ?? state.streamStartedSequence;
  }

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

function eventIsAfterAgentObservationBoundary(
  event: ProviderEvent,
  snapshot: ProviderStateSnapshot,
): boolean {
  if (
    event.streamGeneration !== undefined &&
    snapshot.streamGeneration !== undefined &&
    event.streamGeneration !== snapshot.streamGeneration
  ) {
    return event.streamGeneration > snapshot.streamGeneration;
  }
  if (
    event.streamSequence !== undefined &&
    snapshot.streamStartedSequence !== undefined &&
    (event.streamGeneration === undefined ||
      snapshot.streamGeneration === undefined ||
      event.streamGeneration === snapshot.streamGeneration)
  ) {
    return event.streamSequence > snapshot.streamStartedSequence;
  }
  return event.observedAt >= (snapshot.startedAt ?? snapshot.observedAt);
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
  for (const state of [snapshot.endpointState, snapshot.trunkState, snapshot.queueState]) {
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

function ensureQueue(entry: EngineEntry, queueId: string, event: ProviderEvent): void {
  if (entry.queues.has(queueId)) return;
  entry.queues.set(queueId, {
    queueId,
    updatedAt: event.observedAt,
    order: orderFromEvent(event),
  });
}

function mergeQueueMember(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'QUEUE_MEMBER_CHANGED' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterQueueSnapshot(event, replaySnapshot)) return false;
  const key = queueMemberKey(event.queueId, event.memberId);
  const existing = entry.queueMembers.get(key);
  const order = orderFromEvent(event);
  if (!replaySnapshot && existing && compareOrder(order, existing.order) < 0) return false;
  ensureQueue(entry, event.queueId, event);
  const next: MutableQueueMember = {
    queueId: event.queueId,
    memberId: event.memberId,
    ...(event.memberName
      ? { memberName: event.memberName }
      : existing?.memberName
        ? { memberName: existing.memberName }
        : {}),
    availability: event.availability,
    paused: event.paused,
    inCall: event.inCall,
    updatedAt: event.observedAt,
    order,
  };
  const changed =
    !existing ||
    existing.memberName !== next.memberName ||
    existing.availability !== next.availability ||
    existing.paused !== next.paused ||
    existing.inCall !== next.inCall;
  entry.queueMembers.set(key, next);
  return changed;
}

function removeQueueMember(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'QUEUE_MEMBER_REMOVED' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterQueueSnapshot(event, replaySnapshot)) return false;
  const key = queueMemberKey(event.queueId, event.memberId);
  const existing = entry.queueMembers.get(key);
  if (!existing) return false;
  if (!replaySnapshot && compareOrder(orderFromEvent(event), existing.order) < 0) return false;
  entry.queueMembers.delete(key);
  return true;
}

function mergeQueueCaller(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'QUEUE_CALLER_JOINED' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterQueueSnapshot(event, replaySnapshot)) return false;
  const key = queueCallerKey(event.queueId, event.callerId);
  const existing = entry.queueCallers.get(key);
  const order = orderFromEvent(event);
  if (!replaySnapshot && existing && compareOrder(order, existing.order) < 0) return false;
  ensureQueue(entry, event.queueId, event);
  const next: MutableQueueCaller = {
    queueId: event.queueId,
    callerId: event.callerId,
    ...(event.position === undefined
      ? existing?.position === undefined
        ? {}
        : { position: existing.position }
      : { position: event.position }),
    ...(existing?.waitSeconds === undefined ? {} : { waitSeconds: existing.waitSeconds }),
    updatedAt: event.observedAt,
    order,
  };
  const changed = !existing || existing.position !== next.position;
  entry.queueCallers.set(key, next);
  return changed;
}

function removeQueueCaller(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'QUEUE_CALLER_LEFT' }>,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterQueueSnapshot(event, replaySnapshot)) return false;
  const key = queueCallerKey(event.queueId, event.callerId);
  const existing = entry.queueCallers.get(key);
  if (!existing) return false;
  if (!replaySnapshot && compareOrder(orderFromEvent(event), existing.order) < 0) return false;
  entry.queueCallers.delete(key);
  return true;
}

function mergeAgentInteraction(
  entry: EngineEntry,
  event: Extract<ProviderEvent, { type: 'AGENT_CALLED' | 'AGENT_CONNECTED' }>,
  phase: AgentInteractionPhase,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterAgentObservationBoundary(event, replaySnapshot)) return false;
  const key = agentInteractionKey(event.queueId, event.callerId, event.memberId);
  const existing = entry.agentInteractions.get(key);
  const order = orderFromEvent(event);
  if (existing && compareOrder(order, existing.order) < 0) return false;
  const next: MutableAgentInteraction = {
    queueId: event.queueId,
    callerId: event.callerId,
    memberId: event.memberId,
    ...(event.memberName
      ? { memberName: event.memberName }
      : existing?.memberName
        ? { memberName: existing.memberName }
        : {}),
    phase,
    updatedAt: event.observedAt,
    order,
  };
  const changed =
    !existing || existing.memberName !== next.memberName || existing.phase !== next.phase;
  entry.agentInteractions.set(key, next);
  return changed;
}

function removeAgentInteraction(
  entry: EngineEntry,
  event: Extract<
    ProviderEvent,
    { type: 'AGENT_RING_NO_ANSWER' | 'AGENT_COMPLETED' | 'AGENT_DUMPED' }
  >,
  replaySnapshot?: ProviderStateSnapshot,
): boolean {
  if (replaySnapshot && !eventIsAfterAgentObservationBoundary(event, replaySnapshot)) return false;
  const key = agentInteractionKey(event.queueId, event.callerId, event.memberId);
  const existing = entry.agentInteractions.get(key);
  if (!existing) return false;
  if (compareOrder(orderFromEvent(event), existing.order) < 0) return false;
  entry.agentInteractions.delete(key);
  return true;
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

    case 'QUEUE_MEMBER_CHANGED':
      return mergeQueueMember(entry, event, replaySnapshot);

    case 'QUEUE_MEMBER_REMOVED':
      return removeQueueMember(entry, event, replaySnapshot);

    case 'QUEUE_CALLER_JOINED':
      return mergeQueueCaller(entry, event, replaySnapshot);

    case 'QUEUE_CALLER_LEFT':
      return removeQueueCaller(entry, event, replaySnapshot);

    case 'AGENT_CALLED':
      return mergeAgentInteraction(entry, event, 'RINGING', replaySnapshot);

    case 'AGENT_CONNECTED':
      return mergeAgentInteraction(entry, event, 'CONNECTED', replaySnapshot);

    case 'AGENT_RING_NO_ANSWER':
    case 'AGENT_COMPLETED':
    case 'AGENT_DUMPED':
      return removeAgentInteraction(entry, event, replaySnapshot);
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
      queues: new Map(),
      queueMembers: new Map(),
      queueCallers: new Map(),
      queueCapability: 'UNKNOWN',
      queueSynchronization: 'AWAITING_SNAPSHOT',
      agentInteractions: new Map(),
      agentCapability: 'UNKNOWN',
      agentSynchronization: 'LIVE_ONLY',
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
    const queueNext =
      entry.queueSynchronization === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : state === 'CONNECTED'
          ? entry.queueSynchronization === 'STALE'
            ? 'AWAITING_SNAPSHOT'
            : entry.queueSynchronization
          : 'STALE';
    const agentNext: AgentInteractionSynchronization =
      state === 'CONNECTED' ? entry.agentSynchronization : 'STALE';
    const clearAgentInteractions = state !== 'CONNECTED' && entry.agentInteractions.size > 0;
    if (
      next === entry.synchronization &&
      endpointNext === entry.endpointSynchronization &&
      trunkNext === entry.trunkSynchronization &&
      queueNext === entry.queueSynchronization &&
      agentNext === entry.agentSynchronization &&
      !clearAgentInteractions
    ) {
      return;
    }
    entry.synchronization = next;
    entry.endpointSynchronization = endpointNext;
    entry.trunkSynchronization = trunkNext;
    entry.queueSynchronization = queueNext;
    entry.agentSynchronization = agentNext;
    if (clearAgentInteractions) entry.agentInteractions = new Map();
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
            entry.trunkSynchronization !== 'AWAITING_SNAPSHOT') ||
          (entry.queueSynchronization !== 'UNAVAILABLE' &&
            entry.queueSynchronization !== 'AWAITING_SNAPSHOT') ||
          entry.agentSynchronization !== 'STALE' ||
          entry.agentInteractions.size > 0)
      ) {
        entry.synchronization = 'AWAITING_SNAPSHOT';
        if (entry.endpointSynchronization !== 'UNAVAILABLE') {
          entry.endpointSynchronization = 'AWAITING_SNAPSHOT';
        }
        if (entry.trunkSynchronization !== 'UNAVAILABLE') {
          entry.trunkSynchronization = 'AWAITING_SNAPSHOT';
        }
        if (entry.queueSynchronization !== 'UNAVAILABLE') {
          entry.queueSynchronization = 'AWAITING_SNAPSHOT';
        }
        entry.agentSynchronization = 'STALE';
        entry.agentInteractions = new Map();
        entry.revision += 1;
        this.emit(entry);
      }
    }

    const isAgentEvent =
      event.type === 'AGENT_CALLED' ||
      event.type === 'AGENT_RING_NO_ANSWER' ||
      event.type === 'AGENT_CONNECTED' ||
      event.type === 'AGENT_COMPLETED' ||
      event.type === 'AGENT_DUMPED';
    if (isAgentEvent) entry.agentCapability = 'SUPPORTED';

    this.appendJournal(entry, event);

    if (!entry.initialized) return;
    if (event.type === 'ENDPOINT_STATUS_CHANGED' && entry.endpointSynchronization !== 'CURRENT') {
      return;
    }
    if (event.type === 'TRUNK_REGISTRATION_CHANGED' && entry.trunkSynchronization !== 'CURRENT') {
      return;
    }
    if (
      (event.type === 'QUEUE_MEMBER_CHANGED' ||
        event.type === 'QUEUE_MEMBER_REMOVED' ||
        event.type === 'QUEUE_CALLER_JOINED' ||
        event.type === 'QUEUE_CALLER_LEFT') &&
      entry.queueSynchronization !== 'CURRENT'
    ) {
      return;
    }
    if (isAgentEvent && entry.agentSynchronization !== 'LIVE_ONLY') {
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

    const agentGenerationChanged =
      entry.streamGeneration !== undefined &&
      snapshot.streamGeneration !== undefined &&
      entry.streamGeneration !== snapshot.streamGeneration;

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
    const queueState = snapshot.queueState;
    if (queueState?.capability === 'SUPPORTED') {
      const queues = new Map<string, MutableQueue>();
      const queueMembers = new Map<string, MutableQueueMember>();
      const queueCallers = new Map<string, MutableQueueCaller>();
      for (const queue of queueState.queues) {
        queues.set(queue.queueId, {
          queueId: queue.queueId,
          ...(queue.strategy ? { strategy: queue.strategy } : {}),
          updatedAt: queueState.observedAt,
          order: queueSnapshotOrder(snapshot, queue),
        });
      }
      for (const member of queueState.members) {
        if (!queues.has(member.queueId)) {
          queues.set(member.queueId, {
            queueId: member.queueId,
            updatedAt: queueState.observedAt,
            order: queueSnapshotOrder(snapshot, member),
          });
        }
        queueMembers.set(queueMemberKey(member.queueId, member.memberId), {
          queueId: member.queueId,
          memberId: member.memberId,
          ...(member.memberName ? { memberName: member.memberName } : {}),
          availability: member.availability,
          paused: member.paused,
          inCall: member.inCall,
          updatedAt: queueState.observedAt,
          order: queueSnapshotOrder(snapshot, member),
        });
      }
      for (const caller of queueState.callers) {
        if (!queues.has(caller.queueId)) {
          queues.set(caller.queueId, {
            queueId: caller.queueId,
            updatedAt: queueState.observedAt,
            order: queueSnapshotOrder(snapshot, caller),
          });
        }
        queueCallers.set(queueCallerKey(caller.queueId, caller.callerId), {
          queueId: caller.queueId,
          callerId: caller.callerId,
          ...(caller.position === undefined ? {} : { position: caller.position }),
          ...(caller.waitSeconds === undefined ? {} : { waitSeconds: caller.waitSeconds }),
          updatedAt: queueState.observedAt,
          order: queueSnapshotOrder(snapshot, caller),
        });
      }
      entry.queues = queues;
      entry.queueMembers = queueMembers;
      entry.queueCallers = queueCallers;
      entry.queueCapability = 'SUPPORTED';
      entry.queueSynchronization = 'CURRENT';
    } else if (queueState) {
      entry.queues = new Map();
      entry.queueMembers = new Map();
      entry.queueCallers = new Map();
      entry.queueCapability = queueState.capability;
      entry.queueSynchronization = 'UNAVAILABLE';
    } else {
      entry.queues = new Map();
      entry.queueMembers = new Map();
      entry.queueCallers = new Map();
      entry.queueCapability = 'UNKNOWN';
      entry.queueSynchronization = 'AWAITING_SNAPSHOT';
    }
    if (agentGenerationChanged) entry.agentInteractions = new Map();
    entry.agentSynchronization = 'LIVE_ONLY';
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
            : event.type === 'QUEUE_MEMBER_CHANGED' ||
                event.type === 'QUEUE_MEMBER_REMOVED' ||
                event.type === 'QUEUE_CALLER_JOINED' ||
                event.type === 'QUEUE_CALLER_LEFT'
              ? eventIsAfterQueueSnapshot(event, snapshot)
              : event.type === 'AGENT_CALLED' ||
                  event.type === 'AGENT_RING_NO_ANSWER' ||
                  event.type === 'AGENT_CONNECTED' ||
                  event.type === 'AGENT_COMPLETED' ||
                  event.type === 'AGENT_DUMPED'
                ? eventIsAfterAgentObservationBoundary(event, snapshot)
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
