# Implementation phases and acceptance

## Phase 0 — isolate and inventory

Create isolated checkout at baseline, branch `codex/self-hosted-postgres` if available (otherwise user-selected codex branch). Do not push until authorized. Run existing tests and record pre-existing failures separately. Read schema histories and build effective function/policy inventory; design OpenAPI and schema mapping from real columns. No production connection necessary for first sprint

Deliver: approved architecture delta, API schemas, permission matrix by operation, synthetic fixtures, migration allowlist and explicit decisions pending IT

## Phase 1 — platform and authentication

Scaffold Express/TypeScript, SQL migrations, pg pool, validated config, sessions/CSRF, rate limiting, Argon2id, identity mapping, RLS context helpers, health probes, isolated test DB. Add least-privilege Linux/container deployment template. No production secrets or hardcoded initial password

Deliver: synthetic admin/sender/primary recipient/invitee login; cross-user access denied; revoked session denied at HTTP and socket; request connection reuse cannot leak RLS context; staging-only seeds

## Phase 2 — read parity and files

API adapters for existing UI, authorized paged case/chat lists, directory, reports, files, workflow filters and print. Maintain DTO shapes expected by React to reduce visual churn. No browser Supabase dependency in new build except explicitly isolated legacy adapter for comparison

Deliver: snapshots/report parity on fixtures, 403/404 for guessed IDs, no patient-file public URLs. Header counts and click-through scope/status match. Default tracking active; overall Refer/Shared Care cards show all; completed and cancelled distinct

## Phase 3 — clinical mutations

Port `confirm_refer_appointment`, `finalize_refer_workflow`, `mutate_shared_care`, `respond_consult_invitation`, `mark_consult_messages_read`, consult completion/reopen rules, surgery summary rules, numbering and audited update rules. Use transactions + version checks + idempotency, not separate browser writes. Decide which domain invariants remain SQL functions, with one authoritative implementation

Deliver: DB integration tests use actual runtime role, not owner. Invalid transition leaves message/history/status unchanged. Concurrent finalize/reopen/add-step has deterministic winner and no duplicate cards

## Phase 4 — realtime and integrations

Socket.IO auth/rooms, persisted outbox worker, catch-up, dedupe, unread/read persistence; Push, LINE, support notifications. No replay/import side effects. Review existing call service: preserve signaling/ICE behavior with separate permission/timeout tests and approved TURN server if needed; do not treat text chat socket as full calling implementation

Deliver: two browser contexts show updates, reconnect/foreground catch-up works, server restart no lost persisted messages; denied user never receives room/history/file data; workers retry boundedly and alert failures. New origin Push enrollment verified Android/iOS actual devices before promising equivalent behavior

## Phase 5 — migration rehearsal

Implement inventory/export/import/verify contracts in MIGRATION.md, synthetic full run first. Obtain explicit source export and storage authorization before handling real data. Rehearse on isolated target and signed-off encrypted storage. No source mutation

Deliver: reproducible scripts, validation report, incident runbook, data reconciliation exceptions signed off, measured restore duration

## Phase 6 — operations/UAT/cutover

Patch management, TLS renewal, secret rotation, backup/restore ownership, outbox/DB/disk alerting, load/security tests, real device tests, user/admin guide. Separate go-live approval required; migration plan is not deployment authorization

## Critical regression matrix

| Scenario | Expected |
|---|---|
| Source posts to active consult | Authorized recipients receive; unread count persists across reload |
| Closed ordinary consult | Server rejects new main-chat message/file; explanation visible |
| Active Refer | Chat remains available to permitted participants without resetting Refer status |
| Cancelled or referred-back case reopen | Only authorized primary-recipient rule; retain prior records; same case ID |
| Surgery summary edited during Refer | Authorized author/team/admin semantics match baseline; no unintended transition |
| Pending invite clicked from notification | Invitation response allowed, clinical detail not accessible solely from pending invitation |
| Accepted invite | Allowed chat/read; cannot modify unrelated clinical workflow |
| Shared Care destination is not admin | Step creation/review/completion works per destination policy |
| Source Shared Care image | Preview before send, persist file/message, destination sees after reconnect |
| Refer appointment defaults | Primary consultant default editable, location/contact editable; preserve form-specific phone validation |
| Print case summary | Full multi-page content + primary consultant; no viewport clipping |
| Reopened and re-completed case | Stable case total; no duplicate surgical classification count |
| Tracking clicks | Refer all / active / finished / cancelled and Shared Care corresponding states correctly separated |
| Node dashboard | Scope only authorized hospital cases; no provincial totals leakage |
| Duplicate send / retry | One persisted message, deterministic same response |
| Crash after commit before emit | Outbox publishes after recovery; client deduplicates |
| Disconnect while event commits | Catch-up has no gaps, including commit ordering race |
| Change case permissions mid-session | HTTP, replay, sockets and files all revoke access |
| Push/LINE failure | Chat stays persisted; retry/alert visible; no historical flood |
| Unknown/deleted file, bad MIME/path | Reject securely, no arbitrary file reads |
| Import twice / mid-run failure | Identical clinical counts/IDs with resumable report |
| Backup restored | Cases, auth activation, chat, attachments and permissions work together |

## Performance gate proposal, not measured capacity

Agree realistic concurrent users with IT before final load test. Start synthetic 50 connected clients and concurrent sends/reports; record p50/p95 and hardware. Proposed p95 text send persistence < 1 s and online display < 2 s under agreed load, excluding device-offline cases. No promise based solely on database choice. Backpressure, pagination, query indexes and bounded connection pools required

## Definition of done

All baseline and new regression failures explained/resolved, no PHI/secrets in code/log/artifacts, authorization tests at API/DB/file/socket boundaries pass, migration verification has zero unexplained differences, backup restore proven, clinical UAT and IT operational acceptance recorded. Publish a clear list of remaining limitations instead of marking scaffolding production-ready
