# Configuration design

**Status:** Only the development server bind uses environment values; no PBX configuration loader or onboarding UI exists yet.

`.env.example` contains only generic application defaults. A production `.env` file is ignored by Git. PBX addresses, ports, AMI and SSH credentials, timezone, recording paths, and capability choices will be entered through authenticated onboarding and stored at runtime, without editing source or rebuilding images.

The planned first-run flow creates a local administrator, adds an Asterisk/FreePBX PBX profile, tests AMI read-only connectivity, optionally tests restricted SSH, performs read-only discovery, displays observed and unavailable capabilities, asks for confirmation, and starts monitoring. Existing profiles can later be edited, disabled, removed, tested, and rediscovered.

Non-secret PBX metadata belongs in SQLite. PBX credentials are encrypted at rest with a protected master key stored outside Git. The frontend must never receive saved secrets. Each observation will include an availability state and timestamp; unavailable readings are not displayed as zero.

The proposed container data mount is `/data`. The host path is chosen by the operator. Do not use the checkout for runtime data. Details are in [Architecture](ARCHITECTURE.md).

The backend accepts `APP_HOST` and `APP_PORT` for its development listener. It defaults to loopback and port 3000. `.env.example` is an example only and is not loaded automatically. No AMI, SSH, or PBX environment variables are accepted by this skeleton.
