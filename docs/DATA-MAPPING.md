# Source entity mapping — draft, not import authorization

Reference: `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`. All 26 table declarations in the source inventory are covered below. This does not prove live-table coverage. Column mapping, effective constraints and live catalog reconciliation remain required.

Preserve means retain original IDs, references, values and UTC timestamps; text IDs must not be coerced to UUID. No row is silently dropped. Quarantine means keep a restricted historical copy without activating it in the new runtime; disposition requires review.

| Source public table | Proposed treatment | Verification / runtime boundary |
|---|---|---|
| hospitals | Preserve | Exact ID set and directory fields |
| dentists | Preserve; map to app_users | Unique source dentist/account mapping; never merge by name |
| dentist_private_profiles | Preserve restricted | No exposure through public directory; field-level reconciliation |
| consults | Preserve | IDs, case numbers, targets, primary consultant, statuses, JSONB history and attachments |
| messages | Preserve | Author, case, timestamps, metadata, step IDs, edits and read state; no replay delivery |
| consult_invitations | Preserve | Exact pending/accepted/declined vocabulary; no invitation-only clinical access |
| refer_service_locations | Preserve | Destination, editable contact fields and references |
| shared_care_audit_log | Preserve | Original actor, step, action and timestamp; reconcile identity counter |
| app_audit_log | Preserve restricted | Original evidence; never synthesize substitute actors |
| notifications | Preserve | Ownership/read state; imported notifications never enter send queue |
| announcements | Preserve | Authors, timestamps and private attachment mappings |
| support_tickets | Preserve | Ownership/status/history and reference reconciliation |
| support_messages | Preserve | Ticket/author/attachment linkage |
| workflow_layouts | Preserve | Layout version and JSON coordinates, nodes and links |
| consult_case_number_counters | Preserve and reconcile | Advance safely beyond existing numbers before enabling writes |
| specialty_group_ids | Preserve disabled configuration | Verify destinations before any external sends |
| line_group_settings_version | Preserve configuration/history | Reconcile version semantics before enabling configuration updates |
| moph_alert_deliveries | Preserve history, disable delivery | Imported records must not produce alerts |
| push_preferences | Preserve | Map owner identity and retain opt-in/out choices |
| push_deliveries | Preserve history, quarantine pending work | Prevent resending old notifications; verify effective schema |
| push_subscriptions | Quarantine | Browser origin/key compatibility and re-enrollment decision |
| push_reply_events | Quarantine | Historical evidence only until lifecycle reviewed |
| push_chat_presence | Quarantine | Never reactivate stale presence |
| active_app_sessions | Quarantine | Never authenticate or mark users online from old sessions |
| active_consult_sessions | Quarantine | Never treat old session records as current activity |
| line_rate_limits | Quarantine | New limiter starts with explicitly reviewed policy |

## Objects outside public tables

- Auth: map original Auth UUID → dentist ID → new account UUID. Preserve required identity history securely; active tokens/sessions are not valid target credentials. Password continuity versus activation remains a decision.
- Storage: inventory all buckets and actual file bytes, not just database metadata. Map legacy bucket/key to file ID, bytes and SHA-256. Preserve case/chat/support/avatar references; unresolved files block acceptance.
- SQL: classify functions, triggers, RLS, grants, views, sequences and extensions. Supabase auth/storage dependencies require adapters or replacements.
- Additional live tables/columns: add to this mapping before export/import acceptance. Repository discovery cannot authorize omissions.

## Required column mapping format

Each column needs source schema/table/name/type/nullability/default, target column/type, preserve/transform disposition, conversion version, FK dependency, validation rule and evidence location. Do not infer final types from an early CREATE TABLE without applying later ALTER statements.

The generated `column-evidence.json` indexes candidate declarations and alterations for review. It is intentionally not executable DDL or an authoritative effective schema. Candidate declarations retain only column names, type tokens and line references; defaults and patient values are not exported.

## Rehearsal acceptance

Compare preserved row counts and key sets, canonical hashes of clinical fields, FK orphans, identity ambiguity, case number uniqueness, file bytes/hashes and report totals. Repeated import must be a no-op for matching content and fail on unexplained changes. Final transfer occurs only after source writes are frozen and verified.
