import type { EndpointReachability, EndpointRegistrationState } from './index.js';

export type EndpointAvailabilityState = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type EndpointTransitionSource = 'EVENT' | 'SNAPSHOT';

export interface EndpointReliabilityTransition {
  observedAt: string;
  from: EndpointAvailabilityState;
  to: EndpointAvailabilityState;
  registrationState: EndpointRegistrationState;
  reachability: EndpointReachability;
  source: EndpointTransitionSource;
}

export interface EndpointReliabilityState {
  availability: EndpointAvailabilityState;
  lastReachableAt?: string;
  lastUnreachableAt?: string;
  offlineStartedAt?: string;
  offlineDurationSeconds?: number;
  flapCount: number;
  recentTransitions: EndpointReliabilityTransition[];
}

export function classifyEndpointAvailability(
  registrationState: EndpointRegistrationState,
  reachability: EndpointReachability,
): EndpointAvailabilityState {
  if (reachability === 'REACHABLE') return 'ONLINE';
  if (reachability === 'UNREACHABLE') return 'OFFLINE';
  if (registrationState === 'REGISTERED') return 'ONLINE';
  if (registrationState === 'UNREGISTERED') return 'OFFLINE';
  return 'UNKNOWN';
}
