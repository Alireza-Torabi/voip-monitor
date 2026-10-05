# Instructions for future development sessions

Treat every tracked file and Git commit as public. Never stage credentials, keys, customer data, topology, real production logs, databases, packet captures, or screenshots. Keep private facts in `.local/`, which Git ignores.

Deployment portability is a hard requirement. No tracked code, test, example, document, default, migration, or fixture may depend on the current lab/company environment, real hostnames/IPs, PBX names, credentials, topology, certificates, paths outside the documented generic contract, or data copied from a live deployment. Environment-specific deployment facts belong only in ignored local runtime storage such as `.local/` or the deployment manager. A fresh clone must be deployable in another organization by following generic tracked documentation and supplying that organization's values at deployment time.

At the start of each session, read this file and `docs/PROJECT_CONTEXT.md`, `docs/MASTER_PLAN.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, and `.local/DEPLOYMENT_CONTEXT.md` if it exists. Then run `git status`, inspect the branch, remotes, recent history, and actual repository files. Reconcile documents with observed state and continue the next incomplete plan task.

Label environment claims OBSERVED, ASSUMED, DECIDED, or TO_VERIFY. Keep monitoring read-only and outside the call path. Do not change a real PBX without a concrete change, verification, rollback plan, and explicit approval. Never connect CI to a production PBX.

After meaningful work, update `docs/MASTER_PLAN.md` and its Persian companion `docs/MASTER_PLAN.fa.md`, plus any affected decision, architecture, operations, or context documents. Also refresh ignored `.local/SESSION_HANDOFF.md` so a new chat can resume from observed Git state without guessing. Before committing, inspect staged content for secrets and run relevant checks. Never force push or rewrite shared history without explicit approval.
