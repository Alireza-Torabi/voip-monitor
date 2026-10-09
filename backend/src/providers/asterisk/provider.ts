import type {
  CapabilityState,
  DataSourceHealth,
  PbxCapabilities,
  PbxConnectionState,
  PbxHealth,
  PbxProvider,
  ProviderEventListener,
  ProviderDiscoveryResult,
  ProviderEndpointStateSnapshot,
  ProviderErrorCode,
  ProviderQueueStateSnapshot,
  SecurityEventListener,
  ProviderStateSnapshot,
  ProviderTrunkStateSnapshot,
} from '@voip-monitor/shared';
import { AsteriskConnection, type AddressResolver } from './connection.js';
import {
  normalizeAmiEvent,
  normalizeEndpointStatus,
  normalizeAmiSecurityEvent,
  normalizeQueueMemberAvailability,
  normalizeTrunkRegistrationState,
} from './events.js';
import { NetworkBoundaryError } from './network-policy.js';
import {
  AmiTransportError,
  amiField,
  type AmiResponse,
  type AmiTransport,
  type AmiEvent,
} from './transport.js';

const UNKNOWN: CapabilityState = 'UNKNOWN';
const MAX_TRUNK_SOURCE_ITEMS = 4096;

function unknownCapabilities(): PbxCapabilities {
  return {
    telephony: {
      channels: UNKNOWN,
      calls: UNKNOWN,
      endpoints: UNKNOWN,
      trunks: UNKNOWN,
      queues: UNKNOWN,
      agents: UNKNOWN,
    },
    system: {
      cpu: UNKNOWN,
      memory: UNKNOWN,
      filesystems: UNKNOWN,
      uptime: UNKNOWN,
      services: UNKNOWN,
    },
    security: {
      authenticationEvents: UNKNOWN,
    },
  };
}

function cloneCapabilities(capabilities: PbxCapabilities): PbxCapabilities {
  return {
    telephony: { ...capabilities.telephony },
    system: { ...capabilities.system },
    security: { ...capabilities.security },
  };
}

function providerCode(error: unknown): ProviderErrorCode {
  if (error instanceof AsteriskProviderError) return error.code;
  if (error instanceof NetworkBoundaryError) return 'CONNECTION_FAILED';
  if (error instanceof AmiTransportError && error.code === 'TIMEOUT') return 'TIMEOUT';
  if (error instanceof AmiTransportError) return 'CONNECTION_FAILED';
  return 'UNKNOWN';
}

function requireSuccess(response: AmiResponse): void {
  if (response.response.toLowerCase() === 'success') return;
  const message = response.message?.toLowerCase() ?? '';
  if (
    message.includes('permission') ||
    message.includes('privilege') ||
    message.includes('not authorized') ||
    message.includes('not authorised')
  ) {
    throw new AsteriskProviderError('PERMISSION_DENIED');
  }
  if (
    message.includes('invalid action') ||
    message.includes('unknown action') ||
    message.includes('no such action') ||
    message.includes('not implemented')
  ) {
    throw new AsteriskProviderError('UNSUPPORTED');
  }
  throw new AsteriskProviderError('UNKNOWN');
}

function amiBooleanField(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'yes' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'no' || normalized === 'false') return false;
  return undefined;
}

function amiNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value || !/^[0-9]+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export class AsteriskProviderError extends Error {
  constructor(readonly code: ProviderErrorCode) {
    super(`Asterisk provider ${code.toLowerCase().replaceAll('_', ' ')}`);
    this.name = 'AsteriskProviderError';
  }
}

interface TrunkSourceResult {
  capability: CapabilityState;
  trunks: ProviderTrunkStateSnapshot['trunks'];
  streamGeneration?: number;
  streamStartedSequence?: number;
}

interface ChanSipInventory {
  endpointState: ProviderEndpointStateSnapshot;
  trunkSource: TrunkSourceResult;
}

export interface AsteriskProviderOptions {
  instanceId: string;
  displayName: string;
  host: string;
  port: number;
  amiUsername: string;
  readAmiPassword: () => Buffer;
  resolver: AddressResolver;
  transport: AmiTransport;
  now?: () => Date;
}

/**
 * Asterisk provider connection, discovery, reconciliation, and event normalization.
 *
 * Runtime lifecycle remains outside the provider so one provider instance is
 * owned per enabled PBX rather than per browser.
 */
export class AsteriskProvider implements PbxProvider {
  readonly instanceId: string;
  private readonly connection: AsteriskConnection;
  private readonly capabilities = unknownCapabilities();
  private connectionState: PbxConnectionState = 'DISCONNECTED';
  private lastChangedAt: string;
  private readonly eventListeners = new Set<ProviderEventListener>();
  private readonly qualityListeners = new Set<(event: AmiEvent) => void>();
  private readonly securityEventListeners = new Set<SecurityEventListener>();
  private amiHealth: DataSourceHealth = {
    source: 'AMI',
    freshness: 'NEVER_COLLECTED',
  };

  constructor(private readonly options: AsteriskProviderOptions) {
    this.instanceId = options.instanceId;
    this.connection = new AsteriskConnection(options.resolver, options.transport);
    this.lastChangedAt = this.now();
    options.transport.subscribeEvents((event) => {
      const observedAt = this.now();
      const security = normalizeAmiSecurityEvent(this.instanceId, event, observedAt);
      if (security) {
        this.capabilities.security.authenticationEvents = 'SUPPORTED';
        for (const listener of this.securityEventListeners) {
          try {
            listener(structuredClone(security));
          } catch {
            // Security consumers are isolated from provider connection processing.
          }
        }
      }
      if (
        event.event.toLowerCase() === 'rtcpreceived' ||
        event.event.toLowerCase() === 'rtcpsent'
      ) {
        for (const listener of this.qualityListeners) {
          try {
            listener(event);
          } catch {
            /* Quality consumers cannot interrupt AMI. */
          }
        }
      }
      const normalized = normalizeAmiEvent(this.instanceId, event, observedAt);
      if (!normalized) return;
      if (
        normalized.type === 'AGENT_CALLED' ||
        normalized.type === 'AGENT_RING_NO_ANSWER' ||
        normalized.type === 'AGENT_CONNECTED' ||
        normalized.type === 'AGENT_COMPLETED' ||
        normalized.type === 'AGENT_DUMPED'
      ) {
        this.capabilities.telephony.agents = 'SUPPORTED';
      }
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        ...(this.amiHealth.lastAttempt ? { lastAttempt: this.amiHealth.lastAttempt } : {}),
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      for (const listener of this.eventListeners) {
        try {
          listener(normalized);
        } catch {
          // Event consumers are isolated from provider connection processing.
        }
      }
    });
  }

  async connect(): Promise<void> {
    const attempt = this.now();
    this.setConnectionState('CONNECTING');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'NEVER_COLLECTED',
      lastAttempt: attempt,
    };

    try {
      await this.connection.connect({ host: this.options.host, port: this.options.port });
      const password = this.options.readAmiPassword();
      if (password.length === 0) throw new AsteriskProviderError('AUTHENTICATION_FAILED');
      let passwordText = '';
      try {
        passwordText = password.toString('utf8');
        if (passwordText.includes('\r') || passwordText.includes('\n')) {
          throw new AsteriskProviderError('AUTHENTICATION_FAILED');
        }
        const login = await this.options.transport.request({
          action: 'Login',
          fields: {
            Username: this.options.amiUsername,
            Secret: passwordText,
            Events:
              this.eventListeners.size > 0 || this.securityEventListeners.size > 0 ? 'on' : 'off',
          },
        });
        if (login.response.toLowerCase() !== 'success') {
          throw new AsteriskProviderError('AUTHENTICATION_FAILED');
        }
      } finally {
        password.fill(0);
        passwordText = '';
      }

      const success = this.now();
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: success,
        lastUpdate: success,
      };
    } catch (error) {
      const code = providerCode(error);
      await this.connection.disconnect().catch(() => undefined);
      this.setConnectionState('ERROR');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'ERROR',
        lastAttempt: attempt,
        error: { code },
      };
      throw new AsteriskProviderError(code);
    }
  }

  async disconnect(): Promise<void> {
    if (this.options.transport.connected) {
      try {
        await this.options.transport.request({ action: 'Logoff' });
      } catch {
        // The socket can close while Asterisk processes Logoff.
      }
    }
    await this.connection.disconnect();
    this.setConnectionState('DISCONNECTED');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'UNAVAILABLE',
      ...(this.amiHealth.lastAttempt ? { lastAttempt: this.amiHealth.lastAttempt } : {}),
      ...(this.amiHealth.lastSuccess ? { lastSuccess: this.amiHealth.lastSuccess } : {}),
      ...(this.amiHealth.lastUpdate ? { lastUpdate: this.amiHealth.lastUpdate } : {}),
    };
  }

  async discover(): Promise<ProviderDiscoveryResult> {
    this.requireConnected();
    const attempt = this.now();
    try {
      const response = await this.options.transport.request({ action: 'CoreSettings' });
      requireSuccess(response);
      const version = amiField(response.fields, 'AsteriskVersion');
      const observedAt = this.now();
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      return {
        metadata: {
          id: this.instanceId,
          providerType: 'ASTERISK',
          displayName: this.options.displayName,
          product: 'Asterisk',
          ...(version ? { version } : {}),
        },
        capabilities: cloneCapabilities(this.capabilities),
        observedAt,
      };
    } catch (error) {
      this.markOperationFailure(attempt, error);
      throw new AsteriskProviderError(providerCode(error));
    }
  }

  async getCapabilities(): Promise<PbxCapabilities> {
    return cloneCapabilities(this.capabilities);
  }

  async getCurrentState(): Promise<ProviderStateSnapshot> {
    this.requireConnected();
    const attempt = this.now();
    try {
      const result = await this.options.transport.requestEventList(
        { action: 'CoreShowChannels' },
        { itemEvent: 'CoreShowChannel', completeEvent: 'CoreShowChannelsComplete' },
      );
      requireSuccess(result.response);

      const channels = result.events.map((event) => {
        const channelId = amiField(event.fields, 'Uniqueid')?.trim();
        if (!channelId) throw new AsteriskProviderError('UNKNOWN');
        const channelName = amiField(event.fields, 'Channel')?.trim();
        const linkedId = amiField(event.fields, 'Linkedid')?.trim();
        const state =
          amiField(event.fields, 'ChannelStateDesc')?.trim() ||
          amiField(event.fields, 'ChannelState')?.trim();
        const bridgeId = amiField(event.fields, 'BridgeId')?.trim();
        return {
          channelId,
          ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          ...(channelName ? { channelName } : {}),
          ...(linkedId ? { linkedId } : {}),
          ...(state ? { state } : {}),
          ...(bridgeId ? { bridgeId } : {}),
        };
      });
      this.requireListCount(result.completion.fields, channels.length);

      this.capabilities.telephony.channels = 'SUPPORTED';
      const chanSipInventory = await this.getChanSipInventory();
      const endpointState = chanSipInventory.endpointState;
      const trunkState = await this.getTrunkState(chanSipInventory.trunkSource);
      const queueState = await this.getQueueState();
      const observedAt = this.now();
      this.setConnectionState('CONNECTED');
      this.amiHealth = {
        source: 'AMI',
        freshness: 'CURRENT',
        lastAttempt: attempt,
        lastSuccess: observedAt,
        lastUpdate: observedAt,
      };
      return {
        instanceId: this.instanceId,
        source: 'AMI',
        startedAt: attempt,
        observedAt,
        ...(result.streamGeneration === undefined
          ? {}
          : { streamGeneration: result.streamGeneration }),
        ...(result.streamStartedSequence === undefined
          ? {}
          : { streamStartedSequence: result.streamStartedSequence }),
        channels,
        endpointState,
        trunkState,
        queueState,
      };
    } catch (error) {
      this.markOperationFailure(attempt, error);
      throw new AsteriskProviderError(providerCode(error));
    }
  }

  private async getChanSipInventory(): Promise<ChanSipInventory> {
    const startedAt = this.now();
    try {
      const result = await this.options.transport.requestEventList(
        { action: 'SIPpeers' },
        { itemEvent: 'PeerEntry', completeEvent: 'PeerlistComplete' },
      );
      requireSuccess(result.response);
      if (result.events.length > MAX_TRUNK_SOURCE_ITEMS) throw new AsteriskProviderError('UNKNOWN');

      const endpoints: ProviderEndpointStateSnapshot['endpoints'] = [];
      const staticTrunks: ProviderTrunkStateSnapshot['trunks'] = [];
      for (const event of result.events) {
        const objectName = amiField(event.fields, 'ObjectName')?.trim();
        if (!objectName) throw new AsteriskProviderError('UNKNOWN');
        const channelType = amiField(event.fields, 'Channeltype')?.trim();
        const endpointId = channelType ? channelType + '/' + objectName : objectName;
        const dynamic = amiField(event.fields, 'Dynamic')?.trim().toLowerCase();
        const address = amiField(event.fields, 'IPaddress')?.trim().toLowerCase();
        const status = amiField(event.fields, 'Status')?.trim() ?? '';
        const normalized = normalizeEndpointStatus(status);
        let registrationState = normalized.registrationState;
        if (registrationState === 'UNKNOWN' && (dynamic === 'yes' || dynamic === 'true')) {
          registrationState =
            address &&
            address !== '-none-' &&
            address !== '(none)' &&
            address !== '(unavailable)' &&
            address !== '0.0.0.0'
              ? 'REGISTERED'
              : 'UNREGISTERED';
        }
        endpoints.push({
          endpointId,
          registrationState,
          reachability: normalized.reachability,
          ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
        });

        if (dynamic === 'no' || dynamic === 'false' || dynamic === '0') {
          staticTrunks.push({
            trunkId: 'SIP/' + objectName,
            kind: 'PEER',
            technology: 'CHAN_SIP',
            confidence: 'CANDIDATE',
            registrationState: 'NOT_APPLICABLE',
            reachability: normalized.reachability,
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
        }
      }

      this.requireListCount(result.completion.fields, result.events.length);
      this.capabilities.telephony.endpoints = 'SUPPORTED';
      const common = {
        startedAt,
        observedAt: this.now(),
        ...(result.streamGeneration === undefined
          ? {}
          : { streamGeneration: result.streamGeneration }),
        ...(result.streamStartedSequence === undefined
          ? {}
          : { streamStartedSequence: result.streamStartedSequence }),
      };
      return {
        endpointState: {
          capability: 'SUPPORTED',
          ...common,
          endpoints,
        },
        trunkSource: {
          capability: 'SUPPORTED',
          trunks: staticTrunks,
          ...(result.streamGeneration === undefined
            ? {}
            : { streamGeneration: result.streamGeneration }),
          ...(result.streamStartedSequence === undefined
            ? {}
            : { streamStartedSequence: result.streamStartedSequence }),
        },
      };
    } catch (error) {
      const code = providerCode(error);
      if (code !== 'PERMISSION_DENIED' && code !== 'UNSUPPORTED') throw error;
      const capability = code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'UNSUPPORTED';
      this.capabilities.telephony.endpoints = capability;
      return {
        endpointState: {
          capability,
          startedAt,
          observedAt: this.now(),
          endpoints: [],
        },
        trunkSource: {
          capability,
          trunks: [],
        },
      };
    }
  }

  private async getTrunkState(
    chanSipPeerSource: TrunkSourceResult,
  ): Promise<ProviderTrunkStateSnapshot> {
    const startedAt = this.now();

    const unavailable = (error: unknown): TrunkSourceResult => {
      const code = providerCode(error);
      if (code !== 'PERMISSION_DENIED' && code !== 'UNSUPPORTED') throw error;
      return {
        capability: code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'UNSUPPORTED',
        trunks: [],
      };
    };

    const chanSipRegistrations = async (): Promise<TrunkSourceResult> => {
      try {
        const result = await this.options.transport.requestEventList(
          { action: 'SIPshowregistry' },
          { itemEvent: 'RegistryEntry', completeEvent: 'RegistrationsComplete' },
        );
        requireSuccess(result.response);
        if (result.events.length > MAX_TRUNK_SOURCE_ITEMS)
          throw new AsteriskProviderError('UNKNOWN');
        const trunks = result.events.map((event) => {
          const username = amiField(event.fields, 'Username')?.trim();
          const domain = amiField(event.fields, 'Domain')?.trim();
          const state = amiField(event.fields, 'State')?.trim();
          if (!username || !domain || !state) throw new AsteriskProviderError('UNKNOWN');
          return {
            trunkId: 'SIP/' + username + '@' + domain,
            kind: 'OUTBOUND_REGISTRATION' as const,
            technology: 'CHAN_SIP' as const,
            confidence: 'CONFIRMED' as const,
            registrationState: normalizeTrunkRegistrationState(state),
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          };
        });
        this.requireListCount(result.completion.fields, trunks.length);
        return {
          capability: 'SUPPORTED',
          trunks,
          ...(result.streamGeneration === undefined
            ? {}
            : { streamGeneration: result.streamGeneration }),
          ...(result.streamStartedSequence === undefined
            ? {}
            : { streamStartedSequence: result.streamStartedSequence }),
        };
      } catch (error) {
        return unavailable(error);
      }
    };

    const pjsipRegistrations = async (): Promise<TrunkSourceResult> => {
      try {
        const result = await this.options.transport.requestEventList(
          { action: 'PJSIPShowRegistrationsOutbound' },
          {
            itemEvents: ['OutboundRegistrationDetail', 'AuthDetail'],
            completeEvent: 'OutboundRegistrationDetailComplete',
          },
        );
        requireSuccess(result.response);
        if (result.events.length > MAX_TRUNK_SOURCE_ITEMS)
          throw new AsteriskProviderError('UNKNOWN');
        const trunks: ProviderTrunkStateSnapshot['trunks'] = [];
        for (const event of result.events) {
          if (event.event.toLowerCase() !== 'outboundregistrationdetail') continue;
          const objectName = amiField(event.fields, 'ObjectName')?.trim();
          const status = amiField(event.fields, 'Status')?.trim();
          if (!objectName || !status) throw new AsteriskProviderError('UNKNOWN');
          const endpoint = amiField(event.fields, 'Endpoint')?.trim();
          trunks.push({
            trunkId: endpoint ? 'PJSIP/' + endpoint : 'PJSIP/registration:' + objectName,
            kind: 'OUTBOUND_REGISTRATION',
            technology: 'PJSIP',
            confidence: 'CONFIRMED',
            registrationState: normalizeTrunkRegistrationState(status),
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
        }
        return {
          capability: 'SUPPORTED',
          trunks,
          ...(result.streamGeneration === undefined
            ? {}
            : { streamGeneration: result.streamGeneration }),
          ...(result.streamStartedSequence === undefined
            ? {}
            : { streamStartedSequence: result.streamStartedSequence }),
        };
      } catch (error) {
        return unavailable(error);
      }
    };

    const pjsipOutboundAuthPeers = async (): Promise<TrunkSourceResult> => {
      try {
        const result = await this.options.transport.requestEventList(
          { action: 'PJSIPShowEndpoints' },
          { itemEvent: 'EndpointList', completeEvent: 'EndpointListComplete' },
        );
        requireSuccess(result.response);
        if (result.events.length > MAX_TRUNK_SOURCE_ITEMS)
          throw new AsteriskProviderError('UNKNOWN');
        const trunks: ProviderTrunkStateSnapshot['trunks'] = [];
        for (const event of result.events) {
          const objectName = amiField(event.fields, 'ObjectName')?.trim();
          if (!objectName) throw new AsteriskProviderError('UNKNOWN');
          const outboundAuths = amiField(event.fields, 'OutboundAuths')?.trim();
          const normalizedOutboundAuths = outboundAuths?.toLowerCase();
          if (
            !outboundAuths ||
            normalizedOutboundAuths === '[]' ||
            normalizedOutboundAuths === 'none' ||
            normalizedOutboundAuths === '<none>' ||
            normalizedOutboundAuths === '(none)'
          )
            continue;
          trunks.push({
            trunkId: 'PJSIP/' + objectName,
            kind: 'PEER',
            technology: 'PJSIP',
            confidence: 'CANDIDATE',
            registrationState: 'NOT_APPLICABLE',
            reachability: 'UNKNOWN',
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
        }
        this.requireListCount(result.completion.fields, result.events.length);
        return {
          capability: 'SUPPORTED',
          trunks,
          ...(result.streamGeneration === undefined
            ? {}
            : { streamGeneration: result.streamGeneration }),
          ...(result.streamStartedSequence === undefined
            ? {}
            : { streamStartedSequence: result.streamStartedSequence }),
        };
      } catch (error) {
        return unavailable(error);
      }
    };

    const sources: TrunkSourceResult[] = [chanSipPeerSource];
    sources.push(await chanSipRegistrations());
    sources.push(await pjsipRegistrations());
    sources.push(await pjsipOutboundAuthPeers());

    const supported = sources.filter((source) => source.capability === 'SUPPORTED');
    if (supported.length === 0) {
      const capability: CapabilityState = sources.some(
        (source) => source.capability === 'PERMISSION_DENIED',
      )
        ? 'PERMISSION_DENIED'
        : 'UNSUPPORTED';
      this.capabilities.telephony.trunks = capability;
      return {
        capability,
        startedAt,
        observedAt: this.now(),
        trunks: [],
      };
    }

    const rank = (trunk: ProviderTrunkStateSnapshot['trunks'][number]) =>
      trunk.confidence === 'CONFIRMED' ? 2 : 1;
    const merged = new Map<string, ProviderTrunkStateSnapshot['trunks'][number]>();
    for (const source of supported) {
      for (const trunk of source.trunks) {
        const current = merged.get(trunk.trunkId);
        if (!current || rank(trunk) > rank(current)) {
          merged.set(trunk.trunkId, trunk);
          continue;
        }
        if (
          current.reachability === 'UNKNOWN' &&
          trunk.reachability !== undefined &&
          trunk.reachability !== 'UNKNOWN'
        ) {
          merged.set(trunk.trunkId, { ...current, reachability: trunk.reachability });
        }
      }
    }

    const generations = supported
      .map((source) => source.streamGeneration)
      .filter((value): value is number => value !== undefined);
    const sequences = supported
      .map((source) => source.streamStartedSequence)
      .filter((value): value is number => value !== undefined);
    const streamGeneration =
      generations.length > 0 && generations.every((value) => value === generations[0])
        ? generations[0]
        : undefined;
    const streamStartedSequence = sequences.length > 0 ? Math.min(...sequences) : undefined;

    const trunks = [...merged.values()].sort((left, right) =>
      left.trunkId.localeCompare(right.trunkId),
    );
    this.capabilities.telephony.trunks = 'SUPPORTED';
    return {
      capability: 'SUPPORTED',
      startedAt,
      observedAt: this.now(),
      ...(streamGeneration === undefined ? {} : { streamGeneration }),
      ...(streamStartedSequence === undefined ? {} : { streamStartedSequence }),
      trunks,
    };
  }

  private async getQueueState(): Promise<ProviderQueueStateSnapshot> {
    const startedAt = this.now();
    try {
      const result = await this.options.transport.requestEventList(
        { action: 'QueueStatus' },
        {
          itemEvents: ['QueueParams', 'QueueMember', 'QueueEntry'],
          completeEvent: 'QueueStatusComplete',
        },
      );
      requireSuccess(result.response);

      const queues: ProviderQueueStateSnapshot['queues'] = [];
      const members: ProviderQueueStateSnapshot['members'] = [];
      const callers: ProviderQueueStateSnapshot['callers'] = [];

      for (const event of result.events) {
        const name = event.event.toLowerCase();
        if (name === 'queueparams') {
          const queueId = amiField(event.fields, 'Queue')?.trim();
          if (!queueId) throw new AsteriskProviderError('UNKNOWN');
          const strategy = amiField(event.fields, 'Strategy')?.trim();
          queues.push({
            queueId,
            ...(strategy ? { strategy } : {}),
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
          continue;
        }

        if (name === 'queuemember') {
          const queueId = amiField(event.fields, 'Queue')?.trim();
          const memberId = amiField(event.fields, 'Location')?.trim();
          const status = amiField(event.fields, 'Status')?.trim();
          const paused = amiBooleanField(amiField(event.fields, 'Paused'));
          const inCall = amiBooleanField(amiField(event.fields, 'InCall'));
          if (!queueId || !memberId || !status || paused === undefined || inCall === undefined) {
            throw new AsteriskProviderError('UNKNOWN');
          }
          const memberName = amiField(event.fields, 'Name')?.trim();
          members.push({
            queueId,
            memberId,
            ...(memberName ? { memberName } : {}),
            availability: normalizeQueueMemberAvailability(status),
            paused,
            inCall,
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
          continue;
        }

        if (name === 'queueentry') {
          const queueId = amiField(event.fields, 'Queue')?.trim();
          const callerId = amiField(event.fields, 'Uniqueid')?.trim();
          if (!queueId || !callerId) throw new AsteriskProviderError('UNKNOWN');
          const position = amiNonNegativeInteger(amiField(event.fields, 'Position'));
          const waitSeconds = amiNonNegativeInteger(amiField(event.fields, 'Wait'));
          callers.push({
            queueId,
            callerId,
            ...(position === undefined ? {} : { position }),
            ...(waitSeconds === undefined ? {} : { waitSeconds }),
            ...(event.streamSequence === undefined ? {} : { streamSequence: event.streamSequence }),
          });
          continue;
        }

        throw new AsteriskProviderError('UNKNOWN');
      }

      this.requireListCount(result.completion.fields, result.events.length);
      this.capabilities.telephony.queues = 'SUPPORTED';
      return {
        capability: 'SUPPORTED',
        startedAt,
        observedAt: this.now(),
        ...(result.streamGeneration === undefined
          ? {}
          : { streamGeneration: result.streamGeneration }),
        ...(result.streamStartedSequence === undefined
          ? {}
          : { streamStartedSequence: result.streamStartedSequence }),
        queues,
        members,
        callers,
      };
    } catch (error) {
      const code = providerCode(error);
      if (code !== 'PERMISSION_DENIED' && code !== 'UNSUPPORTED') throw error;
      const capability = code === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'UNSUPPORTED';
      this.capabilities.telephony.queues = capability;
      return {
        capability,
        startedAt,
        observedAt: this.now(),
        queues: [],
        members: [],
        callers: [],
      };
    }
  }

  private requireListCount(fields: Readonly<Record<string, string>>, actual: number): void {
    const listItems = amiField(fields, 'ListItems')?.trim();
    if (listItems === undefined) return;
    if (!/^[0-9]+$/.test(listItems) || Number(listItems) !== actual) {
      throw new AsteriskProviderError('UNKNOWN');
    }
  }

  subscribeSecurityEvents(listener: SecurityEventListener): () => void {
    this.securityEventListeners.add(listener);
    return () => {
      this.securityEventListeners.delete(listener);
    };
  }

  subscribeQualityEvents(listener: (event: AmiEvent) => void): () => void {
    this.qualityListeners.add(listener);
    return () => {
      this.qualityListeners.delete(listener);
    };
  }

  subscribeEvents(listener: ProviderEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  async getHealth(): Promise<PbxHealth> {
    return {
      instanceId: this.instanceId,
      connection: {
        state: this.connectionState,
        lastChangedAt: this.lastChangedAt,
        ...(this.amiHealth.error ? { error: { ...this.amiHealth.error } } : {}),
      },
      sources: {
        AMI: {
          ...this.amiHealth,
          ...(this.amiHealth.error ? { error: { ...this.amiHealth.error } } : {}),
        },
      },
    };
  }

  async reconcile(): Promise<ProviderStateSnapshot> {
    return this.getCurrentState();
  }

  private requireConnected(): void {
    if (
      !this.options.transport.connected ||
      (this.connectionState !== 'CONNECTED' && this.connectionState !== 'DEGRADED')
    ) {
      throw new AsteriskProviderError('CONNECTION_FAILED');
    }
  }

  private markOperationFailure(attempt: string, error: unknown): void {
    const code = providerCode(error);
    this.setConnectionState(this.options.transport.connected ? 'DEGRADED' : 'ERROR');
    this.amiHealth = {
      source: 'AMI',
      freshness: 'ERROR',
      lastAttempt: attempt,
      ...(this.amiHealth.lastSuccess ? { lastSuccess: this.amiHealth.lastSuccess } : {}),
      ...(this.amiHealth.lastUpdate ? { lastUpdate: this.amiHealth.lastUpdate } : {}),
      error: { code },
    };
  }

  private setConnectionState(state: PbxConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.lastChangedAt = this.now();
  }

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}
