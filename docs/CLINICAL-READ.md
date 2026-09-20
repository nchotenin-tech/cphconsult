# Initial clinical read API

This is a development read slice, not the complete legacy schema or a production import tool. No clinical UI or clinical write endpoints are included.

## Install locally

In pgAdmin, connect as `postgres` to **cphconsult_dev**, open Query Tool, and execute the entire `ops/postgres/06-clinical-read-schema.sql` file. The earlier foundation, identity and auth migrations must already be installed. Success returns `clinical_read_schema_created`. Installation is transactional and rejects a different database or a repeated installation. If it fails, roll back the failed transaction before retrying after resolving the error.

Restart the API with `tools/start-local.ps1` after installing the schema. This migration inserts no fixtures. The existing `tester@example.invalid` account has no dentist mapping, so its list is empty and case details return 404.

## Contract and access

- `GET /api/v1/consults?limit=20&after=<last-id>` returns `{items, nextCursor}`. Limit is 1–100. Ordering and cursor comparison use database text ID order, not creation time.
- `GET /api/v1/consults/:id` returns `{item}` or the same 404 for missing and inaccessible cases.
- Both require an active session. Missing/expired sessions return 401; accounts requiring password change return 403.
- The server derives the actor from its session and sets transaction-local RLS context. Request headers/parameters cannot select the actor.

The policy preserves the reference legacy read conditions: admin, sender, explicit recipient, destination hospital membership, or overlapping specialty. A pending invitation alone grants no read access. An accepted invitee in the fixtures is already an explicit recipient; invitation acceptance itself is not implemented. These read rules do not establish permission for clinical mutations.

Only explicit summary/detail columns are returned. Attachment access, workflow JSON payloads, chat, invitations, mutations and full legacy field coverage remain pending. The initial constraints must be reconciled against source data before a full migration; do not import real records into this partial schema.

## Validation

Run `npm test`, then `./tools/test-auth-postgres.ps1` in PowerShell. The latter requires local PostgreSQL 18 binaries and unused port 55439. It creates and stops an isolated synthetic cluster under ignored `.local-tests/`; it does not connect to the user's port-5432 database. Temporary test clusters remain local after shutdown.

Validated: 28 unit tests; authentication HTTP/PostgreSQL checks; 48 synthetic role/case pairs through both HTTP and the real runtime role; pagination; anonymous denial; missing/inaccessible detail; ignored actor spoof header; denied direct writes; no residual actor context; password-change and disabled-account rejection. Superuser is used only for setup and fixture changes, never the authorization queries under test. These tests do not prove production migration readiness or source-data completeness.
