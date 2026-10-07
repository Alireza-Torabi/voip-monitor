import type {
  CapabilityState,
  DataFreshnessState,
  EndpointReachability,
  PbxConnectionState,
  SystemServiceState,
  TrunkRegistrationState,
} from './index.js';

export type OperationalHealthState = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN' | 'STALE';
export type OperationalHealthDimension =
  | 'PROVIDER'
  | 'TELEPHONY'
  | 'TRUNKS'
  | 'ENDPOINTS'
  | 'QUEUES'
  | 'SYSTEM'
  | 'SECURITY'
  | 'CALL_QUALITY';

export type OperationalHealthReasonCode =
  | 'PROVIDER_UNVERIFIED'
  | 'PROVIDER_CONNECTING'
  | 'PROVIDER_DISCONNECTED'
  | 'PROVIDER_DEGRADED'
  | 'PROVIDER_ERROR'
  | 'TELEPHONY_MISSING'
  | 'TELEPHONY_AWAITING_SNAPSHOT'
  | 'TELEPHONY_STALE'
  | 'CAPABILITY_UNAVAILABLE'
  | 'NO_OBSERVED_ENTITIES'
  | 'TRUNK_UNREGISTERED'
  | 'TRUNK_REGISTERING'
  | 'TRUNK_REJECTED'
  | 'TRUNK_FAILED'
  | 'TRUNK_UNREACHABLE'
  | 'QUEUE_WAITING'
  | 'SYSTEM_NOT_COLLECTED'
  | 'SYSTEM_UNAVAILABLE'
  | 'SYSTEM_SOURCE_ERROR'
  | 'SYSTEM_SOURCE_STALE'
  | 'SYSTEM_CPU_HIGH'
  | 'SYSTEM_CPU_CRITICAL'
  | 'SYSTEM_MEMORY_HIGH'
  | 'SYSTEM_MEMORY_CRITICAL'
  | 'SYSTEM_FILESYSTEM_HIGH'
  | 'SYSTEM_FILESYSTEM_CRITICAL'
  | 'SYSTEM_SERVICE_INACTIVE'
  | 'SYSTEM_SERVICE_FAILED'
  | 'SECURITY_ALERT_ACTIVE'
  | 'CALL_QUALITY_UNAVAILABLE';

export interface OperationalHealthReason {
  code: OperationalHealthReasonCode;
  count?: number;
  value?: number;
}

export interface OperationalHealthComponent {
  dimension: OperationalHealthDimension;
  state: OperationalHealthState;
  reasons: OperationalHealthReason[];
}

export interface OperationalHealthSnapshot {
  instanceId: string;
  overall: OperationalHealthState;
  components: Record<OperationalHealthDimension, OperationalHealthComponent>;
}

export interface OperationalHealthInput {
  instanceId: string;
  providerState: PbxConnectionState;
  telephony?: {
    synchronization: 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE';
    trunkCapability: CapabilityState;
    trunkSynchronization: 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE' | 'UNAVAILABLE';
    trunks: Array<{
      registrationState: TrunkRegistrationState;
      reachability?: EndpointReachability;
    }>;
    endpointCapability: CapabilityState;
    endpointSynchronization: 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE' | 'UNAVAILABLE';
    endpoints: Array<{ reachability: EndpointReachability }>;
    queueCapability: CapabilityState;
    queueSynchronization: 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE' | 'UNAVAILABLE';
    queues: Array<{ waitingCount: number }>;
  };
  system?: {
    freshness: DataFreshnessState;
    cpuPercent?: number;
    memoryPercent?: number;
    maxFilesystemPercent?: number;
    services?: Array<{ state: SystemServiceState }>;
  };
  security?: { currentAlertCount: number };
  callQuality?: { state: OperationalHealthState; reasons?: OperationalHealthReason[] | undefined };
}

const component = (
  dimension: OperationalHealthDimension,
  state: OperationalHealthState,
  reasons: OperationalHealthReason[] = [],
): OperationalHealthComponent => ({ dimension, state, reasons });

function capabilityUnavailable(capability: CapabilityState): boolean {
  return capability !== 'SUPPORTED';
}

function staleOrUnknown(
  dimension: OperationalHealthDimension,
  synchronization: 'CURRENT' | 'AWAITING_SNAPSHOT' | 'STALE' | 'UNAVAILABLE',
): OperationalHealthComponent | undefined {
  if (synchronization === 'STALE')
    return component(dimension, 'STALE', [{ code: 'TELEPHONY_STALE' }]);
  if (synchronization !== 'CURRENT')
    return component(dimension, 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  return undefined;
}

function providerHealth(state: PbxConnectionState): OperationalHealthComponent {
  if (state === 'CONNECTED') return component('PROVIDER', 'HEALTHY');
  if (state === 'DEGRADED')
    return component('PROVIDER', 'DEGRADED', [{ code: 'PROVIDER_DEGRADED' }]);
  if (state === 'CONNECTING')
    return component('PROVIDER', 'DEGRADED', [{ code: 'PROVIDER_CONNECTING' }]);
  if (state === 'DISCONNECTED')
    return component('PROVIDER', 'CRITICAL', [{ code: 'PROVIDER_DISCONNECTED' }]);
  if (state === 'ERROR') return component('PROVIDER', 'CRITICAL', [{ code: 'PROVIDER_ERROR' }]);
  return component('PROVIDER', 'UNKNOWN', [{ code: 'PROVIDER_UNVERIFIED' }]);
}

function telephonyHealth(input: OperationalHealthInput['telephony']): OperationalHealthComponent {
  if (!input) return component('TELEPHONY', 'UNKNOWN', [{ code: 'TELEPHONY_MISSING' }]);
  if (input.synchronization === 'STALE')
    return component('TELEPHONY', 'STALE', [{ code: 'TELEPHONY_STALE' }]);
  if (input.synchronization === 'AWAITING_SNAPSHOT')
    return component('TELEPHONY', 'UNKNOWN', [{ code: 'TELEPHONY_AWAITING_SNAPSHOT' }]);
  return component('TELEPHONY', 'HEALTHY');
}

function trunkHealth(
  input: NonNullable<OperationalHealthInput['telephony']>,
): OperationalHealthComponent {
  if (capabilityUnavailable(input.trunkCapability))
    return component('TRUNKS', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const sync = staleOrUnknown('TRUNKS', input.trunkSynchronization);
  if (sync) return sync;
  if (input.trunks.length === 0)
    return component('TRUNKS', 'UNKNOWN', [{ code: 'NO_OBSERVED_ENTITIES' }]);
  const reasons: OperationalHealthReason[] = [];
  const failed = input.trunks.filter((item) => item.registrationState === 'FAILED').length;
  const rejected = input.trunks.filter((item) => item.registrationState === 'REJECTED').length;
  const unregistered = input.trunks.filter(
    (item) => item.registrationState === 'UNREGISTERED',
  ).length;
  const registering = input.trunks.filter(
    (item) => item.registrationState === 'REGISTERING',
  ).length;
  const unreachable = input.trunks.filter((item) => item.reachability === 'UNREACHABLE').length;
  if (failed) reasons.push({ code: 'TRUNK_FAILED', count: failed });
  if (rejected) reasons.push({ code: 'TRUNK_REJECTED', count: rejected });
  if (unregistered) reasons.push({ code: 'TRUNK_UNREGISTERED', count: unregistered });
  if (unreachable) reasons.push({ code: 'TRUNK_UNREACHABLE', count: unreachable });
  if (failed || rejected || unregistered || unreachable)
    return component('TRUNKS', 'CRITICAL', reasons);
  if (registering)
    return component('TRUNKS', 'DEGRADED', [{ code: 'TRUNK_REGISTERING', count: registering }]);
  return component('TRUNKS', 'HEALTHY');
}

function endpointHealth(
  input: NonNullable<OperationalHealthInput['telephony']>,
): OperationalHealthComponent {
  if (capabilityUnavailable(input.endpointCapability))
    return component('ENDPOINTS', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const sync = staleOrUnknown('ENDPOINTS', input.endpointSynchronization);
  if (sync) return sync;
  if (input.endpoints.length === 0)
    return component('ENDPOINTS', 'UNKNOWN', [{ code: 'NO_OBSERVED_ENTITIES' }]);
  return component('ENDPOINTS', 'HEALTHY');
}

function queueHealth(
  input: NonNullable<OperationalHealthInput['telephony']>,
): OperationalHealthComponent {
  if (capabilityUnavailable(input.queueCapability))
    return component('QUEUES', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const sync = staleOrUnknown('QUEUES', input.queueSynchronization);
  if (sync) return sync;
  if (input.queues.length === 0)
    return component('QUEUES', 'UNKNOWN', [{ code: 'NO_OBSERVED_ENTITIES' }]);
  const waiting = input.queues.reduce((sum, queue) => sum + Math.max(0, queue.waitingCount), 0);
  if (waiting > 0)
    return component('QUEUES', 'DEGRADED', [{ code: 'QUEUE_WAITING', count: waiting }]);
  return component('QUEUES', 'HEALTHY');
}

function systemHealth(input: OperationalHealthInput['system']): OperationalHealthComponent {
  if (!input || input.freshness === 'NEVER_COLLECTED')
    return component('SYSTEM', 'UNKNOWN', [{ code: 'SYSTEM_NOT_COLLECTED' }]);
  if (input.freshness === 'UNAVAILABLE')
    return component('SYSTEM', 'UNKNOWN', [{ code: 'SYSTEM_UNAVAILABLE' }]);
  if (input.freshness === 'ERROR')
    return component('SYSTEM', 'CRITICAL', [{ code: 'SYSTEM_SOURCE_ERROR' }]);
  if (input.freshness === 'STALE')
    return component('SYSTEM', 'STALE', [{ code: 'SYSTEM_SOURCE_STALE' }]);

  const reasons: OperationalHealthReason[] = [];
  let state: OperationalHealthState = 'HEALTHY';
  const apply = (next: OperationalHealthState, reason: OperationalHealthReason) => {
    reasons.push(reason);
    if (next === 'CRITICAL' || (next === 'DEGRADED' && state === 'HEALTHY')) state = next;
  };
  const cpu = input.cpuPercent;
  const memory = input.memoryPercent;
  const filesystem = input.maxFilesystemPercent;
  if (cpu !== undefined && cpu >= 95)
    apply('CRITICAL', { code: 'SYSTEM_CPU_CRITICAL', value: cpu });
  else if (cpu !== undefined && cpu >= 85)
    apply('DEGRADED', { code: 'SYSTEM_CPU_HIGH', value: cpu });
  if (memory !== undefined && memory >= 97)
    apply('CRITICAL', { code: 'SYSTEM_MEMORY_CRITICAL', value: memory });
  else if (memory !== undefined && memory >= 90)
    apply('DEGRADED', { code: 'SYSTEM_MEMORY_HIGH', value: memory });
  if (filesystem !== undefined && filesystem >= 97)
    apply('CRITICAL', { code: 'SYSTEM_FILESYSTEM_CRITICAL', value: filesystem });
  else if (filesystem !== undefined && filesystem >= 90)
    apply('DEGRADED', { code: 'SYSTEM_FILESYSTEM_HIGH', value: filesystem });
  const failed = input.services?.filter((service) => service.state === 'FAILED').length ?? 0;
  const inactive = input.services?.filter((service) => service.state === 'INACTIVE').length ?? 0;
  if (failed) apply('CRITICAL', { code: 'SYSTEM_SERVICE_FAILED', count: failed });
  if (inactive) apply('DEGRADED', { code: 'SYSTEM_SERVICE_INACTIVE', count: inactive });
  return component('SYSTEM', state, reasons);
}

function securityHealth(input: OperationalHealthInput['security']): OperationalHealthComponent {
  if (!input) return component('SECURITY', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  if (input.currentAlertCount > 0)
    return component('SECURITY', 'CRITICAL', [
      { code: 'SECURITY_ALERT_ACTIVE', count: input.currentAlertCount },
    ]);
  return component('SECURITY', 'HEALTHY');
}

export function aggregateOperationalHealth(
  components: Iterable<OperationalHealthComponent>,
): OperationalHealthState {
  const states = [...components].map((item) => item.state);
  if (states.includes('CRITICAL')) return 'CRITICAL';
  if (states.includes('STALE')) return 'STALE';
  if (states.includes('DEGRADED')) return 'DEGRADED';
  if (states.includes('HEALTHY')) return 'HEALTHY';
  return 'UNKNOWN';
}

export function evaluateOperationalHealth(
  input: OperationalHealthInput,
): OperationalHealthSnapshot {
  const telephony = telephonyHealth(input.telephony);
  const trunks = input.telephony
    ? trunkHealth(input.telephony)
    : component('TRUNKS', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const endpoints = input.telephony
    ? endpointHealth(input.telephony)
    : component('ENDPOINTS', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const queues = input.telephony
    ? queueHealth(input.telephony)
    : component('QUEUES', 'UNKNOWN', [{ code: 'CAPABILITY_UNAVAILABLE' }]);
  const components: OperationalHealthSnapshot['components'] = {
    PROVIDER: providerHealth(input.providerState),
    TELEPHONY: telephony,
    TRUNKS: trunks,
    ENDPOINTS: endpoints,
    QUEUES: queues,
    SYSTEM: systemHealth(input.system),
    SECURITY: securityHealth(input.security),
    CALL_QUALITY: input.callQuality
      ? component('CALL_QUALITY', input.callQuality.state, input.callQuality.reasons ?? [])
      : component('CALL_QUALITY', 'UNKNOWN', [{ code: 'CALL_QUALITY_UNAVAILABLE' }]),
  };
  return {
    instanceId: input.instanceId,
    overall: aggregateOperationalHealth(Object.values(components)),
    components,
  };
}
