# Contributing

The project is licensed Apache-2.0. Contributions should be generic, readable, tested where meaningful, and safe for public distribution.

Before work, read `AGENTS.md` and the context, plan, decisions, and architecture documents in `docs/`. Use a short-lived branch from `main`; prefer Conventional Commit messages. Keep provider-specific code behind provider boundaries and avoid deployment-specific assumptions. Update documentation when behavior or operating procedures change.

Use synthetic fixtures only. Never include real PBX addresses, credentials, phone numbers, extension lists, topology, logs, packet captures, or customer data in a contribution. Do not connect automated tests to production PBXs.

Current foundation checks are described in `docs/OPERATIONS.md`. Build and test commands will be added with runnable application code.
