# Local pgAdmin foundation

For the user-created, dedicated `cphconsult_dev` database on local PostgreSQL 18.4. This does not install the clinical application. Do not run on rcis or production.

1. In pgAdmin expand Servers → PostgreSQL 18 → Databases.
2. Right-click **cphconsult_dev** → Query Tool. Check the connection selector says cphconsult_dev.
3. Open `01-development-foundation.sql` with the Query Tool folder button. Run the entire file, with no partial text selection.
4. Expected last result: `cphconsult_dev | foundation_created`.
5. Open and run `02-verify-development-foundation.sql` in the same database. pgAdmin may show only the last result grid; individual SELECT statements can then be selected and run to inspect their results.

Expected metadata: two roles, all listed role flags false; app schema owned by cphconsult_dev_owner; runtime USAGE true, CREATE false; database CONNECT true, database CREATE false, migration INSERT false, owner membership false; migration version 0001-development-foundation.

The first file is deliberately first-run only. An existing role/schema name stops the transaction instead of taking over unknown objects. On error run `ROLLBACK;` if the transaction remains aborted, then report the error; do not remove the guards or delete objects to retry.

Scope: creates two cluster-wide NOLOGIN roles with project-specific names; creates app schema and a migration marker; restricts PUBLIC privileges in cphconsult_dev only. Neither role is granted privileges on rcis. Roles remain unable to log in. This is not a complete cross-database access audit once login is enabled: other databases may have PUBLIC privileges, which must be reviewed separately without changing their settings here.

No password needs to be entered or shared at this step. Later setup will establish credentials privately and activate a least-privilege runtime login. The owner stays separate. Application readiness remains false; authentication, clinical schema, RLS and integration tests are still pending.

Validation status: prepared and reviewed against PostgreSQL 18 documentation; not yet executed against the user's database. The verification script checks metadata only, not real-login/RLS enforcement.

References: https://www.postgresql.org/docs/18/sql-createrole.html and https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html
