# Security policy

This project has a development application foundation, including encrypted local secret storage and local authentication. Do not deploy it as a security control or expose it as a production monitor.

Report a suspected vulnerability privately through the repository's GitHub security advisory feature when available. Do not post credentials, private topology, logs, or exploit details in a public issue. If private reporting is unavailable, ask the repository owner to enable it without publishing sensitive details.

Never commit or upload real PBX credentials, SSH keys, TLS private keys, databases, packet captures, logs, or screenshots of private infrastructure. Treat Git history as public from the first commit. If exposure occurs, stop, identify what was exposed and whether it was pushed, rotate affected credentials, and coordinate remediation. Do not assume deleting a later commit removes exposure.

Future production releases need HTTPS deployment, least-privilege PBX access, and tested backup and restore. Local authentication and encrypted secret storage exist, but HTTPS deployment and tested recovery are not implemented. First-admin claiming requires a protected local token; possession of a network endpoint alone is insufficient. Never publish the bootstrap file, session cookies, or password hashes.

## Phase 2 Task 5 review

The first-admin endpoint requires a local 256-bit bootstrap token and an atomic SQLite guard; the database prevents a second claim even if token removal fails. Passwords use salted, parameterized scrypt and never enter structured logs. Session tokens have 256 bits of randomness, only SHA-256 digests are stored, absolute expiry is enforced on lookup, and logout removes the row. Cookies are HttpOnly, SameSite=Strict, and Secure in production. Every state-changing route checks Origin against Host and requires HTTPS Origin in production. Login and setup use generic failures and process-local per-socket-IP plus global attempt limits. `/health` and `/ready` reveal no account or token contents; setup state is separate from readiness.

Known limits: the first-run browser UI, TLS reverse proxy, distributed rate limiting, multi-instance operation, administrator recovery, and tested backup/restore are not implemented. A production reverse proxy must control Host and HTTPS. In-process counters reset on restart; session rows expire logically but are not yet purged. The built-in SQLite API remains a Node 24 release candidate. No external identity provider is supported.
