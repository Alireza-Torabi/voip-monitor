import type { CallQualitySample } from '@voip-monitor/shared';
import type { AmiEvent } from '../asterisk/transport.js';
import { normalizeAmiRtcpSample } from '../asterisk/call-quality.js';

const TTL_MS = 120_000;
const MAX_PER_PBX = 256;
export class LiveQualityStore {
  private readonly values = new Map<string, Map<string, CallQualitySample>>();
  private readonly versions = new Map<string, string>();
  /** Two recent observations per stream, in RAM only, for sustained-quality rules. */
  private readonly previous = new Map<string, Map<string, CallQualitySample>>();
  setSourceVersion(instanceId: string, version: string | undefined): void {
    this.clear(instanceId);
    if (version) this.versions.set(instanceId, version);
  }
  constructor(private readonly now: () => number = Date.now) {}
  observe(instanceId: string, event: AmiEvent): void {
    const now = this.now();
    const samples = normalizeAmiRtcpSample(
      instanceId,
      event,
      new Date(now).toISOString(),
      this.versions.get(instanceId),
    );
    if (!samples.length) return;
    const byLeg = this.values.get(instanceId) ?? new Map<string, CallQualitySample>();
    this.values.set(instanceId, byLeg);
    for (const sample of samples) {
      const key = `${sample.legId}:\0${sample.direction}:\0${sample.ssrc ?? ''}:\0${sample.reportSourceSsrc ?? ''}:\0${sample.reportIndex}`;
      const prior = byLeg.get(key);
      if (prior && prior.observedAt !== sample.observedAt) {
        const old = this.previous.get(instanceId) ?? new Map<string, CallQualitySample>();
        old.set(key, prior);
        this.previous.set(instanceId, old);
      }
      byLeg.delete(key);
      byLeg.set(key, sample);
    }
    this.prune(instanceId, now);
  }
  current(instanceId: string, activeLegs: ReadonlySet<string>): CallQualitySample[] {
    this.prune(instanceId, this.now());
    return [...(this.values.get(instanceId)?.values() ?? [])].filter((sample) =>
      activeLegs.has(sample.legId),
    );
  }
  recent(instanceId: string, activeLegs: ReadonlySet<string>): CallQualitySample[] {
    this.prune(instanceId, this.now());
    return [
      ...this.current(instanceId, activeLegs),
      ...[...(this.previous.get(instanceId)?.values() ?? [])].filter((sample) =>
        activeLegs.has(sample.legId),
      ),
    ];
  }
  clear(instanceId: string): void {
    this.values.delete(instanceId);
    this.previous.delete(instanceId);
    this.versions.delete(instanceId);
  }
  private prune(instanceId: string, now: number): void {
    const values = this.values.get(instanceId);
    if (!values) return;
    for (const [key, sample] of values) {
      if (now - Date.parse(sample.observedAt) > TTL_MS) values.delete(key);
    }
    while (values.size > MAX_PER_PBX) values.delete(values.keys().next().value!);
    const prior = this.previous.get(instanceId);
    if (prior) {
      for (const [key, sample] of prior) {
        if (!values.has(key) || now - Date.parse(sample.observedAt) > TTL_MS) prior.delete(key);
      }
      while (prior.size > MAX_PER_PBX) prior.delete(prior.keys().next().value!);
      if (prior.size === 0) this.previous.delete(instanceId);
    }
    if (values.size === 0) this.values.delete(instanceId);
  }
}
