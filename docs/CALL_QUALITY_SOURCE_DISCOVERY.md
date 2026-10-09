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
- The AMI source has now been observed emitting RTCP events on one deployed PBX, but the application's call-quality capability remains UNKNOWN until a validated normalization/association contract exists; missing measurements must never become zero.

## Discovery matrix (verified AMI on one PBX; database remains unverified)
| Source | Candidate | Availability | Needed proof |
| AMI Reporting events | RTCPSent / RTCPReceived | OBSERVED_SUPPORTED for Asterisk 13.20.0 | 20-second read-only event observation confirmed both event types and selected field names; exact metric semantics and correlation remain unverified |
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

## Observed deployment verification — 2026-10-09
- Existing restricted AMI compatibility verification: PASS, Asterisk 13.20.0, login/discovery/snapshot/reconciliation all passed; five-second normalized-event sample was empty and cannot determine RTCP support.
- Follow-up twenty-second read-only passive AMI event observation on the same approved endpoint: 49 raw events, of which 15 were `RTCPReceived` and 12 `RTCPSent`.
- Only field *names* were collected. Present RTCP field names included `RTT`, `Report0FractionLost`, `Report0CumulativeLost`, `Report0IAJitter`, `ReportCount`, `SSRC`, `Uniqueid`, `Linkedid`; no corresponding field values, identifiers, caller data or media payload were printed or saved.
- These observations establish real RTCP event availability for this deployment but do not validate jitter units, RTT semantics, loss percentage conversion, per-leg correlation or MOS.
- Read-only database metadata verification was prepared but did not execute due to access restrictions; no source database query was issued. Database quality schema is UNKNOWN.
- No PBX configuration changes, call origination, recordings, packet capture, or database writes occurred.
