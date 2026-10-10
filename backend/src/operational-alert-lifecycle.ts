import {
  operationalAlertFingerprint,
  type OperationalAlertObservation,
} from '@voip-monitor/shared';

export type AlertLifecycleState = 'ACTIVE' | 'ACKNOWLEDGED' | 'SILENCED' | 'RESOLVED';
export interface ManagedOperationalAlert {
  fingerprint: string;
  observation: OperationalAlertObservation;
  state: AlertLifecycleState;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  acknowledgedAt?: string | undefined;
  silencedUntil?: string | undefined;
  resolvedAt?: string | undefined;
}

const MAX_ALERTS = 512;
const RESOLVE_AFTER_MS = 60_000;
const RETAIN_RESOLVED_MS = 600_000;
const MAX_SILENCE_MS = 86_400_000;

/** Process-local bounded alert lifecycle. No persistence, call history or notifications. */
export class OperationalAlertLifecycle {
  private readonly items = new Map<string, ManagedOperationalAlert>();
  constructor(private readonly now: () => number = Date.now) {}

  reconcile(
    instanceId: string,
    observations: readonly OperationalAlertObservation[],
    resolvableDimensions?: ReadonlySet<string>,
  ): ManagedOperationalAlert[] {
    const at = this.now();
    const seen = new Set<string>();
    for (const observation of observations) {
      if (
        observation.instanceId !== instanceId ||
        observation.evidence.availability !== 'AVAILABLE'
      )
        continue;
      const key = operationalAlertFingerprint(observation);
      seen.add(key);
      const prev = this.items.get(key);
      if (prev) {
        const silenceExpired =
          prev.state === 'SILENCED' &&
          (!prev.silencedUntil || Date.parse(prev.silencedUntil) <= at);
        const reopened = prev.state === 'RESOLVED';
        this.items.set(key, {
          ...prev,
          observation,
          state: silenceExpired || reopened ? 'ACTIVE' : prev.state,
          lastSeenAt: new Date(at).toISOString(),
          occurrences: Math.min(prev.occurrences + 1, Number.MAX_SAFE_INTEGER),
          ...(reopened ? { firstSeenAt: new Date(at).toISOString(), occurrences: 1 } : {}),
          ...(silenceExpired || reopened ? { silencedUntil: undefined } : {}),
          ...(reopened ? { resolvedAt: undefined, acknowledgedAt: undefined } : {}),
        });
      } else {
        this.items.set(key, {
          fingerprint: key,
          observation,
          state: 'ACTIVE',
          firstSeenAt: new Date(at).toISOString(),
          lastSeenAt: new Date(at).toISOString(),
          occurrences: 1,
        });
      }
    }
    for (const [key, value] of this.items) {
      if (value.observation.instanceId !== instanceId || seen.has(key)) continue;
      if (resolvableDimensions && !resolvableDimensions.has(value.observation.dimension)) continue;
      if (value.state !== 'RESOLVED' && at - Date.parse(value.lastSeenAt) >= RESOLVE_AFTER_MS)
        this.items.set(key, {
          ...value,
          state: 'RESOLVED',
          resolvedAt: new Date(at).toISOString(),
        });
    }
    this.gc(at);
    return this.list(instanceId);
  }

  update(
    instanceId: string,
    key: string,
    action: 'ACKNOWLEDGE' | 'SILENCE' | 'UNSILENCE',
    minutes?: number,
  ): boolean {
    const value = this.items.get(key);
    if (!value || value.observation.instanceId !== instanceId || value.state === 'RESOLVED')
      return false;
    const at = this.now();
    if (
      action === 'SILENCE' &&
      (!Number.isSafeInteger(minutes) || minutes! < 1 || minutes! > MAX_SILENCE_MS / 60_000)
    )
      return false;
    this.items.set(key, {
      ...value,
      state:
        action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : action === 'SILENCE' ? 'SILENCED' : 'ACTIVE',
      ...(action === 'ACKNOWLEDGE' ? { acknowledgedAt: new Date(at).toISOString() } : {}),
      ...(action === 'SILENCE'
        ? { silencedUntil: new Date(at + minutes! * 60_000).toISOString() }
        : { silencedUntil: undefined }),
    });
    return true;
  }

  list(instanceId: string): ManagedOperationalAlert[] {
    return [...this.items.values()]
      .filter((x) => x.observation.instanceId === instanceId)
      .map((x) => structuredClone(x));
  }

  private gc(now: number): void {
    for (const [key, value] of this.items) {
      if (
        value.state === 'RESOLVED' &&
        now - Date.parse(value.resolvedAt ?? value.lastSeenAt) > RETAIN_RESOLVED_MS
      )
        this.items.delete(key);
    }
    while (this.items.size > MAX_ALERTS) this.items.delete(this.items.keys().next().value!);
  }
}
