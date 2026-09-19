# Identity foundation — incomplete authentication

Migration `ops/postgres/03-identity-schema.sql` creates users, source identity mappings, Argon2id credential hashes, hashed sessions and single-use recovery-token storage. It inserts no accounts or passwords. Clinical dentist IDs remain text; their foreign key will be added after directory mapping. Account states default to pending activation.

All five tables enable and force RLS. The runtime role receives only column-limited SELECT on active users matching transaction-local `app.user_id`. It receives no credential/session/recovery access or account write grants. No broad security-definer function is added. Login/activation/recovery implementation and narrowly reviewed authentication access functions are still required; the API remains not-ready.

`withActorTransaction` checks out one connection, begins a transaction, sets actor context with a parameterized transaction-local setting, and commits or rolls back before release. If BEGIN or rollback fails the connection is discarded. Actor IDs must be resolved from server-verified sessions, not accepted from a browser. Custom settings are not authentication: anyone holding the runtime database credential can set them. Keep that credential server-side. This is defense in depth, not protection against a compromised runtime role.

## Apply and verify locally

1. In the original pgAdmin administrator connection, open Query Tool on cphconsult_dev.
2. Run all of `03-identity-schema.sql`; expect `identity_schema_created`.
3. Run all of `04-check-identity-rls.sql`; inspect Messages for `identity_rls_checks_passed` and no ERROR. ROLLBACK alone does not indicate success.

The fourth file inserts two synthetic rows inside a transaction as the administrator, then performs assertions under SET LOCAL ROLE cphconsult_dev_runtime (not superuser). It checks anonymous denial, two-user isolation, credential denial, write denial and cleared identity. It rolls back all fixture writes. Existing fixture IDs/logins cause a failure instead of overwriting data. On an error run ROLLBACK if needed and report the error.

## Evidence and limits

TypeScript build and 10 HTTP/configuration/transaction-control tests pass locally. The new SQL has not yet run on the user's PostgreSQL instance. The SQL role-switch test is not a substitute for integration tests over an actual runtime login, pooled-connection reuse after COMMIT/ROLLBACK, disabled accounts, session revocation, CSRF and HTTP/socket authorization. Those remain release gates. No clinical data has been transferred.

Design references: [PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), [node-postgres transactions](https://node-postgres.com/features/transactions).

## Actual runtime login and connection reuse check

The user has now confirmed migration 0002 and `identity_rls_checks_passed` in pgAdmin. The next verification uses the real runtime login from Node, with pool size 1 and backend PID assertions to prove physical connection reuse:

```powershell
.\tools\start-local.ps1 -VerifyIdentity
```

Enter the runtime password in the local masked prompt. This mode runs preflight and nine checks, then exits without starting a second API. It can run while the existing API is open. It checks real current/session role, anonymous reads, actor A context, commit cleanup, actor B context with a real SQL error, rollback cleanup, credential denial, write denial and connection reuse. Expected final line: `runtime_identity_checks_passed: 9/9`.

No test accounts or data are inserted. Random actor IDs exercise context lifecycle, not positive account visibility; positive two-account visibility was covered by the separate pgAdmin fixture test. The write-denial probe uses WHERE false so it cannot change records even if permissions regress. Only safe check labels are printed on failure. This test has been prepared but its live execution still requires the user's local password entry. Login/session API implementation and HTTP authentication remain pending.
