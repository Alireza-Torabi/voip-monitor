import { fractionLostToPercent, rttToMilliseconds } from './quality-conversion.js';
import type { CallQualitySample, QualityMeasurement } from '@voip-monitor/shared';
import { amiField, type AmiEvent } from './transport.js';

const missing = (reason: string): QualityMeasurement => ({ availability: 'UNKNOWN', reason });
const nonnegative = (
  value: string | undefined,
  unit: 'COUNT' | 'RTP_TICKS',
): QualityMeasurement => {
  if (value === undefined || !/^\d+$/.test(value.trim()))
    return missing('FIELD_MISSING_OR_INVALID');
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed)
    ? { availability: 'AVAILABLE', value: parsed, unit }
    : missing('OUT_OF_RANGE');
};
/**
 * Fail-closed interpretation of AMI RTCP metadata.
 * No network access, no media sampling, no storage and no inferred MOS/codec.
 * FractionLost and RTT deliberately remain UNKNOWN pending version-specific scale validation.
 */
export function normalizeAmiRtcpSample(
  instanceId: string,
  event: AmiEvent,
  observedAt: string,
  sourceVersion?: string,
): CallQualitySample[] {
  const type = event.event.toLowerCase();
  if (type !== 'rtcpsent' && type !== 'rtcpreceived') return [];
  const legId = amiField(event.fields, 'Uniqueid')?.trim();
  if (!legId || legId.length > 256 || !Number.isFinite(Date.parse(observedAt))) return [];
  const countField = amiField(event.fields, 'ReportCount')?.trim();
  if (!countField || !/^\d+$/.test(countField)) return [];
  const reportCount = Number(countField);
  if (!Number.isSafeInteger(reportCount) || reportCount < 0 || reportCount > 32) return [];
  const linkedId = amiField(event.fields, 'Linkedid')?.trim();
  const ssrc = amiField(event.fields, 'SSRC')?.trim();
  const verified = sourceVersion === '13.20.0';
  const evidence = verified
    ? { fractionLostEncoding: 'RFC3550_U8' as const, rttEncoding: 'SECONDS' as const }
    : {};
  const rtt =
    type === 'rtcpreceived'
      ? rttToMilliseconds(amiField(event.fields, 'RTT'), evidence)
      : missing('RTT_NOT_IN_SENT_EVENT');
  const samples: CallQualitySample[] = [];
  for (let index = 0; index < reportCount; index += 1) {
    const prefix = `Report${index}`;
    const sourceSsrc = amiField(event.fields, `${prefix}SourceSSRC`)?.trim();
    const jitter = nonnegative(amiField(event.fields, `${prefix}IAJitter`), 'RTP_TICKS');
    const cumulativeLost = nonnegative(amiField(event.fields, `${prefix}CumulativeLost`), 'COUNT');
    samples.push({
      instanceId,
      source: 'ASTERISK_AMI_RTCP',
      observedAt,
      legId,
      ...(linkedId && linkedId.length <= 256 ? { linkedId } : {}),
      direction: type === 'rtcpsent' ? 'SENT' : 'RECEIVED',
      ...(ssrc && ssrc.length <= 64 ? { ssrc } : {}),
      ...(sourceSsrc && sourceSsrc.length <= 64 ? { reportSourceSsrc: sourceSsrc } : {}),
      reportIndex: index,
      packetLossPercent: fractionLostToPercent(
        amiField(event.fields, `${prefix}FractionLost`),
        evidence,
      ),
      cumulativeLostPackets: cumulativeLost,
      jitter,
      rtt,
      mos: missing('NO_TRUSTED_MOS_SOURCE'),
      codec: { availability: 'UNKNOWN', reason: 'NO_VERIFIED_CODEC_SOURCE' },
    });
  }
  return samples;
}
