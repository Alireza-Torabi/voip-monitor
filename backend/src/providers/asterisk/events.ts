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
      status,
    };
  }

  return undefined;
}
