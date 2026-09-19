# Authorization review matrix — preliminary

Reference revision: `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`.
This matrix records evidence and required tests, not a completed authorization audit. SQL policies, all applicable triggers, helper functions and UI guards must be combined before implementation. Each new API, socket replay and file operation must derive the actor from the authenticated session.

| Operation | Evidence / intended boundary | Required negative or concurrency test |
|---|---|---|
| Read case and history | Case-scoped visibility; pending invitation alone grants no detail access | Unrelated hospital/user and pending invitee denied at HTTP, socket and replay |
| Manage post-consult | `src/utils/consultPermissions.js:canManagePostConsult`: admin, assigned primary; otherwise eligible destination; sender/accepted invitee excluded from fallback | Accepted invitee cannot gain workflow control merely from invitation |
| Manage Shared Care steps | `202609020001_secure_shared_care_workflow.sql:is_shared_care_destination` and `mutate_shared_care`: destination predicate, case access, expected version and row lock; no global admin clinical override | Unrelated admin denied; source denied; stale version rolls back all changes |
| Respond to invitation | `202609050001_fix_consult_invitation_acceptance.sql`: invited dentist, pending state, row lock; add participant then record acceptance in one transaction | Another user cannot respond; repeated/concurrent response cannot duplicate participant |
| Send main chat during active Refer | `202609160001_allow_chat_during_active_refer.sql`: planning/appointment_confirmed bypass completed-chat lock; ordinary case authorization still applies | Unrelated actor denied; terminal Refer and ordinary completed text chat locked |
| Send Shared Care step chat | Same lock permits step-tagged discussion during in_progress; this alone does not establish step/actor authorization | Forged step ID, wrong case, unauthorized actor and closed step must be checked |
| Reopen terminal Refer | `202609110001_reopen_referred_back_consult.sql`: cancelled/referred_back, same case, reason and actor; function has broad participant/admin checks | Review ALL other triggers/RLS/UI guards before deriving effective permission; never broaden to source/admin from this function alone |
| Edit surgery summary | `202608190003_surgery_team_summary_permissions.sql` plus UI and message policies | Author/team/admin semantics and edits during active Refer need end-to-end parity tests |
| Download/upload private files | Storage policy plus owning case/support/profile authority | Guessed IDs, pending invitation, revoked access and malformed path denied |
| Read/mark notification | Owner-only new API contract; audit legacy policies | Cross-user IDs denied; imported notifications never sent |
| Realtime/catch-up | Proposed target: authorized recipients, durable events, recheck current access | Revoked actor receives no payload on existing socket or old cursor |

## Important review traps

- `canViewReferWorkflow` accepts terminal/confirmed status; it is not a standalone case visibility check.
- A later replacement of one function does not supersede other triggers or RLS on the same table.
- The handoff's primary-recipient reopen requirement must be reconciled with the combined effective guards, not one migration file.
- SQL `declined` is observed for invitation rejection. Do not rename persisted states to `rejected` merely because a design document uses that word.
- Database tests must execute as the actual runtime role without ownership, superuser or BYPASSRLS privileges. A passing source-text assertion is not proof of database enforcement.

## Still to review

Full table RLS/grants, private profiles, directory administration, message edit/delete/read receipts, support, announcement administration, report scopes, surgery summary and file policy histories. No clinical mutation should be ported before its regression cases and effective authorization are established.
