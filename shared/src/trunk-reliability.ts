import type { EndpointReachability, TrunkRegistrationState } from './index.js';

export type TrunkAvailabilityState = 'UP' | 'DOWN' | 'TRANSITIONING' | 'UNKNOWN';
export type TrunkTransitionSource = 'EVENT' | 'SNAPSHOT';

export interface TrunkReliabilityTransition {
  observedAt: string;
  from: TrunkAvailabilityState;
  to: TrunkAvailabilityState;
  registrationState: TrunkRegistrationState;
  reachability?: EndpointReachability;
  source: TrunkTransitionSource;
}

export interface TrunkReliabilityState {
  availability: TrunkAvailabilityState;
  lastUpAt?: string;
  lastDownAt?: string;
  outageStartedAt?: string;
  outageDurationSeconds?: number;
  flapCount: number;
  reconnectCount: number;
  recentTransitions: TrunkReliabilityTransition[];
}

export function classifyTrunkAvailability(
  registrationState: TrunkRegistrationState,
  reachability?: EndpointReachability,
): TrunkAvailabilityState {
  if (reachability === 'UNREACHABLE') return 'DOWN';
  if (registrationState === 'REGISTERED') return 'UP';
  if (registrationState === 'REGISTERING') return 'TRANSITIONING';
  if (
    registrationState === 'UNREGISTERED' ||
    registrationState === 'REJECTED' ||
    registrationState === 'FAILED'
  )
    return 'DOWN';
  if (registrationState === 'NOT_APPLICABLE' && reachability === 'REACHABLE') return 'UP';
  return 'UNKNOWN';
}
