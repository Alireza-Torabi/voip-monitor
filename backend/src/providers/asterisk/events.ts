import type { ProviderEvent } from '@voip-monitor/shared';
import { amiField, type AmiEvent } from './transport.js';

function required(fields: Readonly<Record<string, string>>, name: string): string | undefined {
  const value = amiField(fields, name)?.trim();
  return value ? value : undefined;
}

function optional(fields: Readonly<Record<string, string>>, name: string): string | undefined {
  const value = amiField(fields, name)?.trim();
  return value ? value : undefined;
}

export function normalizeEndpointStatus(status: string): {
  registrationState: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
  reachability: 'REACHABLE' | 'UNREACHABLE' | 'UNKNOWN';
} {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'registered') {
    return { registrationState: 'REGISTERED', reachability: 'UNKNOWN' };
  }
  if (normalized === 'unregistered') {
    return { registrationState: 'UNREGISTERED', reachability: 'UNKNOWN' };
  }
  if (normalized === 'reachable' || normalized.startsWith('ok')) {
    return { registrationState: 'UNKNOWN', reachability: 'REACHABLE' };
  }
  if (normalized === 'unreachable' || normalized === 'lagged') {
    return { registrationState: 'UNKNOWN', reachability: 'UNREACHABLE' };
  }
  return { registrationState: 'UNKNOWN', reachability: 'UNKNOWN' };
}

export function normalizeTrunkRegistrationState(
  status: string,
): 'REGISTERED' | 'UNREGISTERED' | 'REGISTERING' | 'REJECTED' | 'FAILED' | 'UNKNOWN' {
  switch (status.trim().toLowerCase()) {
    case 'registered':
      return 'REGISTERED';
    case 'unregistered':
      return 'UNREGISTERED';
    case 'request sent':
    case 'auth. sent':
      return 'REGISTERING';
    case 'rejected':
      return 'REJECTED';
    case 'failed':
    case 'no authentication':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

export function normalizeQueueMemberAvailability(
  status: string,
):
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'IN_USE'
  | 'BUSY'
  | 'INVALID'
  | 'UNAVAILABLE'
  | 'RINGING'
  | 'RINGING_IN_USE'
  | 'ON_HOLD' {
  switch (status.trim()) {
    case '1':
      return 'AVAILABLE';
    case '2':
      return 'IN_USE';
    case '3':
      return 'BUSY';
    case '4':
      return 'INVALID';
    case '5':
      return 'UNAVAILABLE';
    case '6':
      return 'RINGING';
    case '7':
      return 'RINGING_IN_USE';
    case '8':
      return 'ON_HOLD';
    default:
      return 'UNKNOWN';
  }
}

function amiBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'yes' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'no' || normalized === 'false') return false;
  return undefined;
}

function nonNegativeInteger(value: string | undefined): number | undefined {
  if (!value || !/^[0-9]+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function normalizeAgentCompletionReason(
  reason: string | undefined,
): 'CALLER' | 'AGENT' | 'TRANSFER' | 'UNKNOWN' {
  switch (reason?.trim().toLowerCase()) {
    case 'caller':
      return 'CALLER';
    case 'agent':
      return 'AGENT';
    case 'transfer':
      return 'TRANSFER';
    default:
      return 'UNKNOWN';
  }
}

function agentInteractionIdentity(fields: Readonly<Record<string, string>>):
  | {
      queueId: string;
      callerId: string;
      memberId: string;
      memberName?: string;
    }
  | undefined {
  const queueId = required(fields, 'Queue');
  const callerId = required(fields, 'Uniqueid');
  const memberId = required(fields, 'Interface');
  if (!queueId || !callerId || !memberId) return undefined;
  const memberName = optional(fields, 'MemberName');
  return {
    queueId,
    callerId,
    memberId,
    ...(memberName ? { memberName } : {}),
  };
}

function streamOrder(event: AmiEvent): { streamGeneration?: number; streamSequence?: number } {
  return {
    ...(event.streamGeneration === undefined ? {} : { streamGeneration: event.streamGeneration }),
    ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
  };
}

function channelBase(
  instanceId: string,
  observedAt: string,
  event: AmiEvent,
):
  | {
      instanceId: string;
      source: 'AMI';
      observedAt: string;
      streamGeneration?: number;
      streamSequence?: number;
      channelId: string;
      channelName?: string;
      linkedId?: string;
    }
  | undefined {
  const fields = event.fields;
  const channelId = required(fields, 'Uniqueid');
  if (!channelId) return undefined;
  const channelName = optional(fields, 'Channel');
  const linkedId = optional(fields, 'Linkedid');
  return {
    instanceId,
    source: 'AMI',
    observedAt,
    ...streamOrder(event),
    channelId,
    ...(channelName ? { channelName } : {}),
    ...(linkedId ? { linkedId } : {}),
  };
}

/**
 * Convert selected AMI event frames into provider-neutral events.
 *
 * Unknown or incomplete events are ignored instead of forwarding raw AMI
 * payloads into the rest of the application. The state engine will grow this
 * mapping deliberately as compatibility is verified.
 */
export function normalizeAmiEvent(
  instanceId: string,
  event: AmiEvent,
  observedAt: string,
): ProviderEvent | undefined {
  const name = event.event.toLowerCase();
  const fields = event.fields;

  if (name === 'newchannel') {
    const base = channelBase(instanceId, observedAt, event);
    if (!base) return undefined;
    const state = optional(fields, 'ChannelStateDesc') ?? optional(fields, 'ChannelState');
    return {
      type: 'CHANNEL_CREATED',
      ...base,
      ...(state ? { state } : {}),
    };
  }

  if (name === 'newstate') {
    const base = channelBase(instanceId, observedAt, event);
    if (!base) return undefined;
    const state = optional(fields, 'ChannelStateDesc') ?? optional(fields, 'ChannelState');
    if (!state) return undefined;
    return {
      type: 'CHANNEL_STATE_CHANGED',
      ...base,
      state,
    };
  }

  if (name === 'hangup') {
    const base = channelBase(instanceId, observedAt, event);
    if (!base) return undefined;
    const cause = optional(fields, 'Cause');
    const causeText = optional(fields, 'Cause-txt');
    return {
      type: 'CHANNEL_DESTROYED',
      ...base,
      ...(cause ? { cause } : {}),
      ...(causeText ? { causeText } : {}),
    };
  }

  if (name === 'dialbegin') {
    const sourceChannelId = required(fields, 'Uniqueid');
    if (!sourceChannelId) return undefined;
    const destinationChannelId = optional(fields, 'DestUniqueid');
    const linkedId = optional(fields, 'Linkedid');
    const dialString = optional(fields, 'DialString');
    return {
      type: 'DIAL_STARTED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      sourceChannelId,
      ...(destinationChannelId ? { destinationChannelId } : {}),
      ...(linkedId ? { linkedId } : {}),
      ...(dialString ? { dialString } : {}),
    };
  }

  if (name === 'dialend') {
    const sourceChannelId = required(fields, 'Uniqueid');
    if (!sourceChannelId) return undefined;
    const destinationChannelId = optional(fields, 'DestUniqueid');
    const linkedId = optional(fields, 'Linkedid');
    const dialStatus = optional(fields, 'DialStatus');
    return {
      type: 'DIAL_ENDED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      sourceChannelId,
      ...(destinationChannelId ? { destinationChannelId } : {}),
      ...(linkedId ? { linkedId } : {}),
      ...(dialStatus ? { dialStatus } : {}),
    };
  }

  if (name === 'bridgeenter' || name === 'bridgeleave') {
    const channelId = required(fields, 'Uniqueid');
    const bridgeId = required(fields, 'BridgeUniqueid');
    if (!channelId || !bridgeId) return undefined;
    const channelName = optional(fields, 'Channel');
    const linkedId = optional(fields, 'Linkedid');
    return {
      type: name === 'bridgeenter' ? 'BRIDGE_ENTERED' : 'BRIDGE_LEFT',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      bridgeId,
      channelId,
      ...(channelName ? { channelName } : {}),
      ...(linkedId ? { linkedId } : {}),
    };
  }

  if (name === 'peerstatus') {
    const endpointId = required(fields, 'Peer');
    const status = required(fields, 'PeerStatus');
    if (!endpointId || !status) return undefined;
    return {
      type: 'ENDPOINT_STATUS_CHANGED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      endpointId,
      ...normalizeEndpointStatus(status),
    };
  }

  if (name === 'registry') {
    const channelType = required(fields, 'ChannelType');
    const username = required(fields, 'Username');
    const domain = required(fields, 'Domain');
    const status = required(fields, 'Status');
    if (!channelType || !username || !domain || !status) return undefined;
    return {
      type: 'TRUNK_REGISTRATION_CHANGED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      trunkId: `${channelType}/${username}@${domain}`,
      kind: 'OUTBOUND_REGISTRATION',
      registrationState: normalizeTrunkRegistrationState(status),
    };
  }

  if (
    name === 'queuememberstatus' ||
    name === 'queuememberadded' ||
    name === 'queuememberpause' ||
    name === 'queuememberpenalty' ||
    name === 'queuememberringinuse'
  ) {
    const queueId = required(fields, 'Queue');
    const memberId = required(fields, 'Interface');
    const status = required(fields, 'Status');
    const paused = amiBoolean(optional(fields, 'Paused'));
    const inCall = amiBoolean(optional(fields, 'InCall'));
    if (!queueId || !memberId || !status || paused === undefined || inCall === undefined) {
      return undefined;
    }
    const memberName = optional(fields, 'MemberName') ?? optional(fields, 'Name');
    return {
      type: 'QUEUE_MEMBER_CHANGED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      queueId,
      memberId,
      ...(memberName ? { memberName } : {}),
      availability: normalizeQueueMemberAvailability(status),
      paused,
      inCall,
    };
  }

  if (name === 'queuememberremoved') {
    const queueId = required(fields, 'Queue');
    const memberId = required(fields, 'Interface');
    if (!queueId || !memberId) return undefined;
    return {
      type: 'QUEUE_MEMBER_REMOVED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      queueId,
      memberId,
    };
  }

  if (name === 'queuecallerjoin') {
    const queueId = required(fields, 'Queue');
    const callerId = required(fields, 'Uniqueid');
    if (!queueId || !callerId) return undefined;
    const position = nonNegativeInteger(optional(fields, 'Position'));
    return {
      type: 'QUEUE_CALLER_JOINED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      queueId,
      callerId,
      ...(position === undefined ? {} : { position }),
    };
  }

  if (name === 'queuecallerleave' || name === 'queuecallerabandon') {
    const queueId = required(fields, 'Queue');
    const callerId = required(fields, 'Uniqueid');
    if (!queueId || !callerId) return undefined;
    return {
      type: 'QUEUE_CALLER_LEFT',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      queueId,
      callerId,
      disposition: name === 'queuecallerabandon' ? 'ABANDONED' : 'LEFT',
    };
  }
  if (name === 'agentcalled') {
    const identity = agentInteractionIdentity(fields);
    if (!identity) return undefined;
    return {
      type: 'AGENT_CALLED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      ...identity,
    };
  }

  if (name === 'agentringnoanswer') {
    const identity = agentInteractionIdentity(fields);
    if (!identity) return undefined;
    return {
      type: 'AGENT_RING_NO_ANSWER',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      ...identity,
    };
  }

  if (name === 'agentconnect') {
    const identity = agentInteractionIdentity(fields);
    if (!identity) return undefined;
    return {
      type: 'AGENT_CONNECTED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      ...identity,
    };
  }

  if (name === 'agentdump') {
    const identity = agentInteractionIdentity(fields);
    if (!identity) return undefined;
    return {
      type: 'AGENT_DUMPED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      ...identity,
    };
  }

  if (name === 'agentcomplete') {
    const identity = agentInteractionIdentity(fields);
    if (!identity) return undefined;
    return {
      type: 'AGENT_COMPLETED',
      instanceId,
      source: 'AMI',
      observedAt,
      ...streamOrder(event),
      ...identity,
      reason: normalizeAgentCompletionReason(optional(fields, 'Reason')),
    };
  }

  return undefined;
}
