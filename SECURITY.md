# Security policy

This project has a development application foundation, including encrypted local secret storage. Do not deploy it as a security control or expose it as a production monitor.

Report a suspected vulnerability privately through the repository's GitHub security advisory feature when available. Do not post credentials, private topology, logs, or exploit details in a public issue. If private reporting is unavailable, ask the repository owner to enable it without publishing sensitive details.

Never commit or upload real PBX credentials, SSH keys, TLS private keys, databases, packet captures, logs, or screenshots of private infrastructure. Treat Git history as public from the first commit. If exposure occurs, stop, identify what was exposed and whether it was pushed, rotate affected credentials, and coordinate remediation. Do not assume deleting a later commit removes exposure.

Future production releases must use authentication, HTTPS, least-privilege PBX access, tested backup and restore. Encrypted local secret storage exists, but authentication, HTTPS deployment, and tested recovery are not implemented.
