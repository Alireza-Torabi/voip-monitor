/** Source-neutral quality sample. Task 62 is a contract only: no persistence, API or collector. */
export type QualityAvailability = 'AVAILABLE' | 'UNKNOWN' | 'UNSUPPORTED';
export type QualityDirection = 'SENT' | 'RECEIVED';
export type QualityMetricUnit =
  'PERCENT' | 'MILLISECONDS' | 'SECONDS' | 'RTP_TICKS' | 'SCORE' | 'COUNT';

export type QualityMeasurement =
  | { availability: 'AVAILABLE'; value: number; unit: QualityMetricUnit }
  | { availability: 'UNKNOWN' | 'UNSUPPORTED'; reason: string };

export interface CallQualitySample {
  instanceId: string;
  source: 'ASTERISK_AMI_RTCP';
  observedAt: string;
  /** A leg is not a whole call; neither leg nor linked ID may be a caller number. */
  legId: string;
  linkedId?: string;
  direction: QualityDirection;
  ssrc?: string;
  reportSourceSsrc?: string;
  /** Each report block is independent; multiple samples may belong to one call. */
  reportIndex: number;
  packetLossPercent: QualityMeasurement;
  cumulativeLostPackets: QualityMeasurement;
  jitter: QualityMeasurement;
  rtt: QualityMeasurement;
  mos: QualityMeasurement;
  codec:
    | { availability: 'AVAILABLE'; name: string }
    | { availability: 'UNKNOWN' | 'UNSUPPORTED'; reason: string };
}
