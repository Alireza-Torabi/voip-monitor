# Security policy

This project has a development application foundation, including encrypted local secret storage and local authentication. Do not deploy it as a security control or expose it as a production monitor.

Report a suspected vulnerability privately through the repository's GitHub security advisory feature when available. Do not post credentials, private topology, logs, or exploit details in a public issue. If private reporting is unavailable, ask the repository owner to enable it without publishing sensitive details.

Never commit or upload real PBX credentials, SSH keys, TLS private keys, databases, packet captures, logs, or screenshots of private infrastructure. Treat Git history as public from the first commit. If exposure occurs, stop, identify what was exposed and whether it was pushed, rotate affected credentials, and coordinate remediation. Do not assume deleting a later commit removes exposure.

Future production releases need HTTPS deployment, least-privilege PBX access, and tested backup and restore. Local authentication and encrypted secret storage exist, but HTTPS deployment and tested recovery are not implemented. First-admin claiming requires a protected local token; possession of a network endpoint alone is insufficient. Never publish the bootstrap file, session cookies, or password hashes.

## Phase 2 Task 5 review

The first-admin endpoint requires a local 256-bit bootstrap token and an atomic SQLite guard; the database prevents a second claim even if token removal fails. Passwords use salted, parameterized scrypt and never enter structured logs. Session tokens have 256 bits of randomness, only SHA-256 digests are stored, absolute expiry is enforced on lookup, and logout removes the row. Cookies are HttpOnly, SameSite=Strict, and Secure in production. Every state-changing route checks Origin against Host and requires HTTPS Origin in production. Login and setup use generic failures and process-local per-socket-IP plus global attempt limits. `/health` and `/ready` reveal no account or token contents; setup state is separate from readiness.

Known limits: the TLS reverse proxy, distributed rate limiting, multi-instance operation, administrator recovery, and tested backup/restore are not implemented. A production reverse proxy must control Host and HTTPS. In-process counters reset on restart; session rows expire logically but are not yet purged. The built-in SQLite API remains a Node 24 release candidate. No external identity provider is supported.

## Phase 2 Task 6 onboarding review

All PBX endpoints require an enabled administrator session; writes retain same-origin Origin checks. Strict Zod schemas bound fields and reject unknown keys. The API never reads a PBX secret for a browser, never returns crypto envelopes, and emits only a credential-presence flag. Create, update, delete, and setup-state transitions use SQLite transactions; profile deletion cascades encrypted records. The browser clears entered bootstrap/admin/AMI secrets after successful submission and persists only language preference. JavaScript strings and browser form memory cannot be deterministically erased; no secret is written to application-managed persistent browser storage. Onboarding performs syntax validation without DNS, TCP, AMI, SSH, or other PBX network access. Structured logs retain status codes, not request bodies or credentials.

Task 6 identified the need for an explicit SSRF and monitoring-network policy covering private and loopback addresses, link-local and metadata-service ranges, DNS rebinding, and allowed network scope. Tasks 7–9 implement that connection boundary and keep PBX networking disabled by default. Browser interaction tests use a local DOM simulation to check secret clearing; production HTTPS deployment and telephony monitoring remain incomplete.


## Phase 2 Task 7 network-boundary review

The Asterisk connection foundation still performs no real DNS or socket I/O. Future hostname connections must resolve once through an injected resolver, validate every returned address, then connect to an already-approved address without resolving the hostname again. Private RFC1918 and IPv6 ULA ranges are intentionally allowed for administrator-managed PBX infrastructure. The policy rejects unspecified, loopback, link-local, multicast, IPv4 broadcast, IPv4-mapped blocked targets, and the known IPv6 AWS metadata address. A hostname with any unsafe DNS answer is rejected rather than selecting around it.

This is an SSRF risk reduction boundary, not a complete network authorization system. Future production transport work must preserve the single-resolution/validated-address rule, define any deployment-specific allowed monitoring scope, handle DNS failures safely, and avoid adding proxy behavior that bypasses the policy. The mock transport opens no sockets and CI remains isolated from PBXs.


## Phase 2 Task 8 AMI transport review

Task 8 introduced the plain-TCP AMI protocol transport; Task 9 later wired it into runtime only behind the default-disabled network gate. The transport connects only to the numeric address supplied by the validated connection boundary, limits buffered input and request duration, serializes one action at a time, rejects CR/LF header injection, and keeps transport errors bounded. Mock action history redacts secret-like field names. Synthetic integration tests bind an in-process AMI server to loopback only; this intentionally tests the low-level transport seam without weakening the production network policy.

Provider login uses the AMI plain-secret Login action. Task 10 requests AMI events only when a provider-event subscriber has been registered before connect; one-shot verification keeps events disabled. The secret Buffer is overwritten after serialization, but the temporary JavaScript string cannot be deterministically erased. Plain AMI TCP must not be treated as secure across an untrusted/public network. Production connectivity must explicitly choose AMI TLS or a suitably protected private/tunneled path, and real-PBX testing still requires explicit approval.


## Phase 2 Task 9 runtime connectivity review

PBX networking is now an explicit runtime capability but remains disabled by default. `APP_PBX_NETWORK_MODE=disabled` creates no real provider factory. The current opt-in mode, `plain_tcp`, must be used only on a trusted/protected network path because AMI credentials are not protected by transport encryption. Provider failures and PBX outages are isolated from application readiness.

The runtime manager owns at most one persistent provider per enabled profile and serializes provider operations. It reconnects with bounded backoff and jitter and periodically reconciles without browser-driven PBX requests. Manual connection tests require an authenticated administrator plus the existing same-origin check; responses contain safe discovery/health only and never return credentials or AMI wire payloads. Successful verification stores only non-secret discovery data and a timestamp. Connection-setting or credential changes clear the verification marker. No real PBX was used by tests; runtime tests use fake providers and protocol tests remain synthetic/loopback.

## Phase 2 Task 10 event-ingestion review

AMI event frames now have an internal subscription path. The transport isolates listener failures, and the Asterisk provider converts only a bounded set of recognized events into typed provider-neutral objects. Unknown events and events lacking required stable identities are dropped. Raw AMI maps, arbitrary headers, source addresses, CallerID fields, and secret-like values are not exposed through the normalized event bus.

Managed runtime entries subscribe before AMI login; one-shot connection verification has no provider-event subscriber and therefore keeps AMI events disabled. Runtime subscribers receive cloned normalized events and cannot create additional PBX connections. No HTTP/WebSocket event endpoint, persistence, or telephony state engine exists yet. The current AMI parser stores one value per header name, so repeated AMI headers are not preserved; future event-list/snapshot work must address that if a required Asterisk action depends on repeated fields.
