# Task 61 — Call Quality Source Discovery

Status: IN PROGRESS (source verification outstanding)
Scope: source discovery only, no call-quality UI/API/collector or historical storage.

## Confirmed from Asterisk documentation
- AMI `RTCPSent` and `RTCPReceived` have existed since Asterisk 12.0.0; event class is REPORTING.
- Per RTCP report block: `ReportXFractionLost`, `ReportXCumulativeLost`, `ReportXIAJitter`, source SSRC, report count and sequence details. Interarrival jitter is in RTP timestamp units, not automatically milliseconds.
- `RTCPReceived` documents `RTT` in seconds; association may include Channel, Uniqueid, Linkedid and SSRC.
- RTCP availability depends on source/media/session settings and observable traffic; SIP presence, AMI login and CDR access alone do not demonstrate working call-quality telemetry.
- Asterisk Media Experience Score (MES) is not MOS. Do not label it MOS or invent a score; inspect exact supported release and exposed fields first.
References:
https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/RTCPSent/
https://docs.asterisk.org/Certified-Asterisk_22.8_Documentation/API_Documentation/AMI_Events/RTCPReceived/
https://www.asterisk.org/asterisk-media-experience-score/

## Current application facts (code inspection)
- AsteriskProvider subscribes to provider transport AMI events but normalizes telephony/security only.
- No normalized RTCP event or jitter/loss/RTT/MOS contract exists in backend/src or shared/src.
- Existing source-history discovery targets conventional CDR, CEL, queue_log and verified source scopes. It does not verify call-quality tables/columns.
- Hence current capability must remain UNKNOWN, not SUPPORTED, and missing metrics are not zero.

## Discovery matrix (not yet verified for a specific PBX)
| Source | Candidate | Availability | Needed proof |
| AMI Reporting events | RTCPSent / RTCPReceived | VERSION_DOCUMENTED, DEPLOYMENT_UNKNOWN | Server version, allowed event class and masked field-presence samples from a consented test call |
| Read-only source DB | vendor-specific RTCP/RTP quality table | UNKNOWN | Approved-scope information_schema metadata only, not guessed schema or raw call data |
| AMI CLI commands | RTP stats via arbitrary Command | NOT AUTHORIZED | Excluded from this task's read-only, bounded allowlist; do not send |
| MOS | direct trusted source | UNKNOWN | Explicit vendor data/algorithm and source semantics; MES must not be rebranded |
| Codec | channel/SDP source | UNKNOWN | Capability-specific direct proof; no codec fallback guess |

## Verification gates before Task 61 can be complete
1. Confirm each supported Asterisk generation and required AMI permission without changing PBX configuration.
2. On operator-approved read-only verification, record only event names, field names, source version, availability and coarse sample counts; no caller IDs, addresses, tokens, Uniqueid or RTP payload.
3. Confirm the source's RTCP direction and per-leg association, sampling frequency, timebase, percent/ratio conversion and handling of missing reports.
4. Inspect only approved DB scopes for vendor-specific quality schemas; SQL must remain bounded and SELECT-only.
5. Publish a capability matrix: SUPPORTED / UNSUPPORTED / UNKNOWN with reason and per-metric unit/semantics.
6. Only then proceed to Task 62's provider-neutral contracts.

No production/PBX queries, network probes, credential reads, configuration changes, or call traffic captures were made as part of this document.
