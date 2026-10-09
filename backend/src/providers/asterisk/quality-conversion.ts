import type { QualityMeasurement } from '@voip-monitor/shared';

export type VerifiedRtcpEvidence = {
  /** Must be backed by version-specific source or documented field validation. */
  fractionLostEncoding?: 'RFC3550_U8';
  rttEncoding?: 'SECONDS';
  rtpClockHz?: number;
};

const unknown = (reason: string): QualityMeasurement => ({ availability: 'UNKNOWN', reason });

/** Never enable a numeric conversion simply because the source field exists. */
export function fractionLostToPercent(
  raw: unknown,
  evidence: VerifiedRtcpEvidence,
): QualityMeasurement {
  if (evidence.fractionLostEncoding !== 'RFC3550_U8')
    return unknown('FRACTION_LOSS_SCALE_UNVERIFIED');
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d*)$/.test(raw))
    return unknown('FRACTION_LOSS_INVALID');
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 255)
    return unknown('FRACTION_LOSS_OUT_OF_RANGE');
  return { availability: 'AVAILABLE', value: (value * 100) / 256, unit: 'PERCENT' };
}

export function rttToMilliseconds(
  raw: unknown,
  evidence: VerifiedRtcpEvidence,
): QualityMeasurement {
  if (evidence.rttEncoding !== 'SECONDS') return unknown('RTT_SCALE_UNVERIFIED');
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))
    return unknown('RTT_INVALID');
  const value = Number(raw) * 1000;
  if (!Number.isFinite(value) || value < 0 || value > 3_600_000) return unknown('RTT_OUT_OF_RANGE');
  return { availability: 'AVAILABLE', value, unit: 'MILLISECONDS' };
}

export function jitterToMilliseconds(
  raw: unknown,
  evidence: VerifiedRtcpEvidence,
): QualityMeasurement {
  const hz = evidence.rtpClockHz;
  if (hz === undefined || !Number.isSafeInteger(hz) || hz < 1000 || hz > 1_000_000)
    return unknown('CLOCK_RATE_UNVERIFIED');
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d*)$/.test(raw)) return unknown('JITTER_INVALID');
  const ticks = Number(raw);
  if (!Number.isSafeInteger(ticks)) return unknown('JITTER_OUT_OF_RANGE');
  return { availability: 'AVAILABLE', value: (ticks * 1000) / hz, unit: 'MILLISECONDS' };
}
