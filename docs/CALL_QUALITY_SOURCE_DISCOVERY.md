# Task 61 — Call Quality Source Discovery

Status: COMPLETE for verified live AMI source discovery on Asterisk 13.20.0. Historical DB source discovery and numeric RTCP validation remain explicitly UNKNOWN/deferred.
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

## Verified metric interpretation and acceptance boundary — 2026-10-09
- **Source direction:** `RTCPReceived` is a report received by Asterisk from the far end; reception-report blocks describe the RTP stream indicated by `ReportXSourceSSRC`. `RTCPSent` is a report emitted by Asterisk. Do not assume they are exchangeable measurements or mix legs and directions.
- **Identity:** `Uniqueid` identifies a channel leg and `Linkedid` associates related legs, not a guaranteed single media stream. For each report block, `SSRC` and `ReportXSourceSSRC` must also be respected. Correlation cannot safely rely on caller ID or channel display text, and must tolerate missing IDs, transfers, multiple blocks, and channel reuse.
- **Loss:** RFC 3550 `fraction lost` is unsigned 8-bit fixed point (integer fraction / 256). The percent conversion is `100 * fractionLost / 256` only after verifying the Asterisk version exposes the raw RFC value; otherwise mark scale UNKNOWN. `cumulative lost` is the cumulative packet count for that media source, not the percentage, and it can be affected by duplicate/reordered traffic. Avoid summing cumulative counts across intervals.
- **Jitter:** `ReportXIAJitter` represents interarrival jitter in RTP clock timestamp units. Millisecond conversion requires the corresponding RTP clock frequency (`1000 * jitterUnits / clockHz`), which cannot be safely inferred from RTCP packet type alone. If unknown, display raw unit-qualified value only or UNKNOWN; never silently label as milliseconds.
- **RTT:** `RTCPReceived.RTT` is documented in seconds for current Asterisk API and is derived using received LSR/DLSR fields. The exact Asterisk 13.20.0 numeric scale remains to be empirically validated before exposing an RTT KPI.
- **Timing:** AMI event reception time is the monitor's observation timestamp, not guaranteed media-report generation time. A bounded in-memory short-lived current-call view is allowed later; no duplicate persistence of historical RTCP events is approved.
- **Sampling:** A report event and one report block are not a distinct call; counts cannot be used as call totals. Do not call missing reports 0 loss/0 jitter or presume silence indicates good quality. Quality alert thresholds are deferred until proven metrics.
- **MOS/codec:** Neither MOS nor codec appeared as quality metric fields in the observed probe. They remain UNKNOWN and must not be calculated, guessed or mislabeled from MES.
- **Database:** Approved scopes were not inspected: no conclusion about historical quality storage is supportable. AMI real-time event support alone is enough to identify a potential live source, not historical availability.

### Task 61 discovery disposition
The source-discovery requirement is satisfied for an **Asterisk 13.20.0 live AMI RTCP event source** by direct operator-authorized observation; integration, numeric normalization, per-call association and historical database support explicitly remain *unverified*. Those belong to validation gates for Task 62 and Task 63, and no quality KPI/UI is authorized before that validation. Other Asterisk versions/technologies remain capability-gated UNKNOWN until separately proven.

References: https://www.rfc-editor.org/rfc/rfc3550 ; https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/RTCPSent/ ; https://docs.asterisk.org/Certified-Asterisk_22.8_Documentation/API_Documentation/AMI_Events/RTCPReceived/ ; https://community.asterisk.org/t/more-rtcpsent-rtcpreceived-documentation-somewhere/87632
