# Shared contracts

`src/index.ts` contains provider-neutral TypeScript contracts for PBX identity, capabilities, connection and source health, safe error codes, discovery, and the future provider interface. It contains no provider behavior or runtime validation. Build it before the backend; root scripts handle this ordering.
