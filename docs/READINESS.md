# Readiness and next steps

## Verified on 2026-09-19

- The new GitHub repository was empty and cloned independently.
- The legacy checkout is clean at `0f2836cc0ba251f2d313ce80609ba3f6ffdf8e16`.
- The reference commit exists locally and is 31 commits ahead of that checkout.
- Source-only inventory can be generated without modifying the legacy checkout.
- No live schema, data counts, files, Auth export or restore has been inspected or verified.
- Draft entity mapping covers all 26 discovered table names; column evidence contains 197 source locations, not a complete effective schema.
- Preliminary permission matrix records critical clinical boundaries and unresolved combined-trigger review.
- Docker CLI is installed but its Linux engine is unavailable; PostgreSQL runtime/RLS tests have not run.
- Initial Express/TypeScript platform implemented with liveness, dependency diagnostics, deliberately false application readiness and bounded connection pool/shutdown.
- TypeScript build and 5 local HTTP/configuration tests passed on Node 20.19.5. Dependency installation audit reported zero known vulnerabilities at installation time; this is not a security certification.
- `docs/openapi.yaml` covers implemented probes only; authentication/clinical contracts and the effective source schema review remain unfinished.

## Development progress after initial inventory

PostgreSQL 18 is available locally. Authentication, transaction-scoped identity, clinical read RLS and HTTP integration tests now run against an isolated synthetic cluster. The React UI supports login, scoped list/detail and consultation-status filters. OpenAPI documents these endpoints. The local tester and six-case demo were installed by the user; browser checks confirmed all six detail views and session persistence. Current test commands and their scope are in `CLINICAL-READ.md` and `CLINICAL-DEMO.md`. The initial inventory bullets above are historical; full schema/data/file verification and production readiness remain outstanding.

## Phase 0 remaining tasks

1. Review all SQL definitions in execution order, including replacements and drops; derive effective functions, triggers, policies and grants. Resolve duplicate migration version prefixes before choosing a migration runner.
2. Build a column-level mapping and classify every source entity as preserve, transform or omit only with an approved reason. Include tables omitted from the initial handoff list.
3. Build an operation-level permission matrix from SQL, UI predicates and regression tests.
4. Define OpenAPI contracts and synthetic fixtures, then establish the legacy regression baseline in an isolated development environment.
5. Confirm production revision and obtain an approved schema-only catalog to identify drift. Do not assume the Git inventory matches production.

## Implementation sequence

1. Platform, authentication, least-privilege runtime role and transaction-scoped RLS context.
2. Authorized read APIs, file storage and frontend adapters.
3. Clinical mutations with transaction, idempotency and regression coverage.
4. Durable outbox, Socket.IO catch-up and notification workers.
5. Synthetic migration runner, then approved real-data rehearsal and restore drill.
6. Clinical acceptance, operational readiness and separately approved final cutover.

## Information needed

Thai preparation guide and local checklist validator: [MIGRATION-PREPARATION-TH.md](MIGRATION-PREPARATION-TH.md). The blank template correctly reports 21 unknown items; these are unverified, not proof the user lacks them. Four validator tests cover missing/pending/invalid entries and the distinction between checklist completeness and migration authorization. The tool does not access production or perform migration.

- Server OS/version, CPU/RAM/disk, Docker availability, domain and operating team.
- Confirm whether React is retained or the frontend is also to be replaced.
- Source project identity and actual deployed revision.
- Database/file volumes, concurrency, downtime allowance and backup retention.
- Account activation/password continuity decision, SMTP and integration ownership.

## Completion evidence required

Exact preserved row/key reconciliation; canonical clinical field hashes; verified file lengths/hashes and no unexplained missing references; account mapping; HTTP/database/socket/file permission tests; repeatable import and crash recovery; measured restore drill. Imported notifications must not be resent.
