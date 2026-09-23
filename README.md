# VoIP Monitoring Platform (planning)

An Apache-2.0 public project for a separate-server VoIP/PBX monitor. Initial planned support is Asterisk and FreePBX-based Asterisk, including compatibility work for Asterisk 13.x. There is no runnable application yet; no PBX has been connected or tested.

[فارسی](README.fa.md) · [Architecture](docs/ARCHITECTURE.md) · [Installation status](docs/INSTALL.md) · [Project plan](docs/MASTER_PLAN.md)

The backend will own persistent AMI connections and expose authenticated state to web clients. Deployment-specific configuration and credentials will be entered at runtime. Do not use this planning scaffold to monitor a PBX.
