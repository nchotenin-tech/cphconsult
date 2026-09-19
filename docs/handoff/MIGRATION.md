# Migration and cutover runbook — DESIGN ONLY

No production access/export authorized by this document. No migration executable is included yet. Build tooling against synthetic fixtures first; exact executable commands require inventoried source schema/version and approved target connection

## A. Source inventory

Read these from the baseline checkout:

- `deployment/new-stack-bootstrap/00_bootstrap.sql` plus ALL `supabase/migrations/` in chronological order. Some functions are replaced repeatedly; last effective definition and live catalog decide behavior. Do not replay Supabase bootstrap blindly into standalone PostgreSQL
- `src/context/ConsultContext.jsx`: Auth, profile matching, data transforms and subscriptions
- `src/services/consult/{authService,profileService,consultService,chatService,referService,notificationService,announcementService}.js`
- `src/utils/consultPermissions.js`, `consultWorkflowState.js`, `consultWorkflowState` consumers, `storageMedia.js`, `referWorkflow.js`
- `src/App.jsx`, `PostConsultTracking.jsx`, `ProcessWorkflowDashboard.jsx`: latest filter routing
- `api/line-oa.js`, `api/push.js`, `api/_lib/`, `src/utils/pushNotifications.js`
- `test/` and `test/components/`: behavioral oracle, not proof all server policies were covered

After separately approved read-only source access, inventory actual tables/columns/types/defaults/sequences/FKs/indexes/views/functions/triggers/RLS/grants/extensions/publications; source PostgreSQL version; bucket list; file metadata; Auth providers and account mapping. Capture schema-only manifest privately. Include tables absent from this list rather than silently dropping them

| Source objects found in repo | Target treatment |
|---|---|
| hospitals, dentists | Preserve IDs/columns; link dentists to new app account via audited mapping |
| dentist_private_profiles | Preserve only authorized private data; explicit restricted access, not public directory API |
| consults | Preserve IDs, case numbers, primary consultant, targets, statuses, refer_data/shared_care_data JSONB and historical fields |
| messages | Preserve IDs, author, timestamps, message types, step linkage, workflow cards, edited/read fields |
| consult_invitations | Preserve pending/accepted/rejected and parties; test no pre-accept access |
| refer_service_locations | Preserve service destination defaults and editable contact details |
| shared_care_audit_log, app_audit_log | Preserve audit records/timestamps; no synthesized author replacements |
| notifications | Preserve ownership/read state; do not re-dispatch imported notifications |
| announcements, support_tickets, support_messages | Preserve ownership, message history and attachment mappings |
| workflow_layouts | Preserve nodes/cards/anchors/curves and layout version |
| consult_case_number_counters | Reconcile with highest existing case numbers before writes |
| specialty_group_ids, line_group_settings_version | Controlled operational config, verify destinations before enabling sends |
| push_subscriptions | Sensitive endpoint/key metadata; keep quarantined, migrate only with verified origin/key compatibility |
| push_reply_events, push_chat_presence, active_app_sessions, line_rate_limits | Normally do not reactivate transient state; archive if required and document reset |
| moph_alert_deliveries | Preserve history if in scope; keep integration disabled if disabled at baseline |
| auth schema | Not restored as drop-in standalone Auth service; follow B |
| storage schema and objects | Metadata does not contain file bytes; follow C |

Map every source table and column to `preserve / transform / omit-with-approved-reason`. Record mapping version, FK dependencies and row totals in a private migration manifest. Source counts/checksums in logs must avoid patient values. No sensitive manifest in repository

## B. Accounts and login continuity

Never match by display name or silently merge by email. Build mapping source Auth UUID -> source dentist text ID -> target app_user UUID. Flag duplicate/missing/ambiguous profiles and abort affected import until resolved

Default proposal: import identity/profile only, lock credentials pending one-time activation, hash new passwords with Argon2id. Tokens hashed, single-use, short-lived; no shared default passwords. Real verified emails may use approved SMTP recovery. Accounts with fake emails, including admin, require identity verification and a separately approved secure delivery channel (e.g. administrator-issued one-time activation in person); do not require email that does not exist. This decision must be signed off before cutover

Optional password-hash compatibility import is a separate approved work item: inspect source scheme/parameters, encrypted export, implement verification/rehash, test sample account with owner's consent. Do not assume copying auth.users makes Supabase Auth work on standalone PostgreSQL. Never import active sessions or refresh tokens as valid target sessions

## C. Files

Enumerate actual private buckets and attachments from case/chat/support/avatar fields, not only `consult-images` and `dentist-avatars`. Preserve legacy bucket + key mapping; whitelist source host/buckets. Signed URLs expire: extract/resolve authorized object identity, do not treat URLs as file content

Manifest: source bucket/key, target file ID/key, bytes, detected MIME, SHA-256, owner/reference, migration status. Copy to private staging volume, verify length and hash before ready. Database backup alone is insufficient. Document absent/duplicate/orphan objects; no silent deletion or skip. Reconcile all references and representative download/preview/print behavior. Disable arbitrary external URL retrieval during conversion

Use consistent source freeze for final DB + object snapshot. While source remains live, rehearsal exports are not considered final consistency proof. Encrypt transport and at-rest staging; sanitize object paths to prevent traversal; preserve unicode names as metadata only

## D. Tooling contract for implementing agent

Create read-only source inventory/export and target-only import/verify commands, with defaults `--dry-run`, explicit source project allowlist, target staging identity check, `--run-id`, manifest checksum, no secrets in argv/log. Source role read-only; target role isolated. Reject source==target and production target unless separately approved

Schema export, data snapshot, Auth mapping and files are separate outputs. Use supported pg_dump version >= source major and a consistent snapshot; do not use parallel arbitrary REST reads as a consistent full DB backup. Schema dependencies on auth/storage/extensions must be classified before restore. No blind `pg_restore --clean` into shared DB

Import into a fresh staging database per rehearsal, not overwrite existing environment. Keep original source dump encrypted and unchanged; transform copies. Apply reviewed target schema first, copy reference then dependent entities in FK order determined from actual catalog. Suppress external delivery by isolating worker credentials/egress, not by disabling all database safety checks. Replaying old clinical triggers during import can change histories: distinguish import DDL/data from runtime functions, then validate all constraints and permissions before enabling writes

Idempotency: source entity + ID + content hash; repeat matching rows is no-op, mismatches fail unless explicit reconciliation approved. Use transaction checkpoints and import ledger; a partial run is not success. Re-running must not duplicate messages, workflow cards, notification jobs, case numbers or file records

## E. Verification report required

- Tables/columns mapped 100%; row counts and key sets exact for preserved entities
- Canonical per-record hashes (normalized timestamps/JSON key order) reconcile all migrated clinical fields; transformations have reviewed exceptions
- No FK orphans, duplicate identities/case numbers, missing author/primary consultant/step links
- All file references map; verified hashes/bytes; zero unexplained missing files
- Compare workflow/report counts by hospital, specialty, status, scheme, age/month; reopening must not duplicate case count
- Dates: Thai/UTC, cross-day chat, latest-post elapsed time; preserve source timestamps
- Login/activation succeeds for ordinary and synthetic-email admin account through approved method
- Runtime role RLS tests, cross-hospital/cross-case download tests and pending invite access tests pass
- Repeat import yields same data; forced crash recovery produces no extra rows/events
- Full restore drill of target database + files + operational config completed in isolated environment

## F. Cutover (manual gates)

1. IT approves DNS/TLS, storage, Auth delivery, RPO/RTO and maintenance window; clinician/admin accept UAT
2. Take verified source backup; record rollback baseline; disable source writes server-side for ALL APIs, sockets, jobs and scheduled integrations (not just frontend banner). Prove read-only
3. Export final consistent DB + Auth mapping + file set. For initial system size prefer full snapshot into fresh target rather than unproven deltas. Keep source untouched except approved maintenance control
4. Import/verify; target outbound notifications disabled. Run private smoke tests with synthetic accounts and protected data access
5. Change approved domain/routing, force old frontend cache/service worker update, require login, enroll new-origin Push; health and permissions smoke test
6. Explicit go/no-go then enable target writes and workers. Only one writable authority. Record exact write-enable time
7. Monitor errors, outbox lag, audit, missing attachments, permissions and counts through agreed observation window

## G. Rollback is not simply changing DNS

Before first target write: switch to source only after verifying source snapshot still matches and restoring approved write settings

After target accepts writes: freeze target, snapshot database/files/outbox, inventory ALL new/updated/deleted records since cutover. Reconcile into source using a tested reverse converter and preserved IDs, or fix forward. Do not blindly switch traffic back and lose patient messages. Until reconciliation tested, post-write rollback requires manual incident decision and maintenance downtime. Never replay delivered Push/LINE messages blindly. Keep both copies intact with restricted access until signed-off retention expiry; no automatic destructive cleanup
