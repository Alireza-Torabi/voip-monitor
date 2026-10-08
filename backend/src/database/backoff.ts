import { DatabaseQueryError } from './query.js';

const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000] as const;

interface FailureState {
  failures: number;
  blockedUntilMs: number;
}

export class DatabaseConnectionBackoff {
  private readonly failures = new Map<string, FailureState>();

  constructor(private readonly now: () => number = Date.now) {}

  assertAllowed(pbxInstanceId: string): void {
    const state = this.failures.get(pbxInstanceId);
    if (!state) return;
    if (state.blockedUntilMs <= this.now()) return;
    throw new DatabaseQueryError('BACKOFF');
  }

  recordFailure(pbxInstanceId: string): void {
    const previous = this.failures.get(pbxInstanceId);
    const failures = Math.min((previous?.failures ?? 0) + 1, BACKOFF_SCHEDULE_MS.length);
    const delay = BACKOFF_SCHEDULE_MS[failures - 1]!;
    this.failures.set(pbxInstanceId, {
      failures,
      blockedUntilMs: this.now() + delay,
    });
  }

  recordSuccess(pbxInstanceId: string): void {
    this.failures.delete(pbxInstanceId);
  }

  remainingMs(pbxInstanceId: string): number {
    const state = this.failures.get(pbxInstanceId);
    if (!state) return 0;
    return Math.max(0, state.blockedUntilMs - this.now());
  }
}
