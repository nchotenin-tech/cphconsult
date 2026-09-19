# Synthetic clinical fixture plan

User decision: preserve legacy permissions/workflows for the initial replacement. Fixtures contain no production data, passwords, file URLs or outbound notification destinations. They are JavaScript test data only; nothing has been inserted into the user's database, and tester@example.invalid has not been given clinical rights.

## Prepared dataset

- 3 fictional hospitals: origin, destination, other.
- 8 fictional dentists: sender, primary recipient, destination colleague of another specialty, matching specialist at another hospital, pending invitee, accepted invitee, unrelated user, admin.
- 8 account mappings with synthetic UUIDs and reserved example.invalid logins; no credential records.
- 6 cases: pending, active, closed ordinary consult, active Refer, finished Refer, active Shared Care. Text IDs, UTC timestamps and JSON objects preserve the source storage conventions.
- 12 invitations covering pending and accepted status. Accepted invitees are included in target_dentist_ids, mirroring the source acceptance transaction.

Source: `server/test/fixtures/clinical.mjs`. No import command exists for these fixtures yet; source-column mapping must be finished before applying clinical DDL.

## Read visibility findings

At reference commit 56ba8b18ff58bfa5c58dc0b9ca555f993049298c, `supabase/migrations/202608080002_specialty_case_visibility.sql` is the latest can_access_consult definition found in the checked histories. It permits admin, sender, explicitly targeted dentist, any dentist at the destination hospital, OR anyone with a matching specialty even at another hospital. The SELECT policies for consults/messages use that helper.

This is broader than primary-recipient mutation rights. `202608180001_align_consult_recipient_permissions.sql` changes recipient/update authority, not the preceding read helper. Do not silently narrow read access to primary recipient or hospital-and-specialty without a separately agreed product change. Pending invitation alone grants no access, but an invitee can already qualify through an independent hospital/specialty rule.

`server/src/policies/legacy-case-read.ts` is an isolated parity model, not an enabled clinical API. Its tests cover a 6-case × 8-actor matrix plus anonymous/null and cross-case edge cases. It does not certify the live source catalog, read/write parity, RLS, HTTP/socket/files or production readiness.

## Next implementation gate

Complete effective columns/constraints and source-to-target mapping; add directory and clinical read migrations with database policies; run the same fixture matrix through an actual runtime PostgreSQL connection and HTTP list/detail APIs; only then map the local tester to a chosen synthetic dentist. Refer/Shared Care mutation tests must separately enforce clinical authority. No default passwords or global clinical admin shortcut will be seeded.
