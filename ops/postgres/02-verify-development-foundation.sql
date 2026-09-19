-- Read-only metadata verification. Run as postgres in cphconsult_dev.
BEGIN READ ONLY;
DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN
    RAISE EXCEPTION 'Wrong database: expected cphconsult_dev';
  END IF;
END
$guard$;

SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname IN ('cphconsult_dev_owner', 'cphconsult_dev_runtime')
ORDER BY rolname;

SELECT
  n.nspname AS schema_name,
  pg_get_userbyid(n.nspowner) AS schema_owner,
  has_schema_privilege('cphconsult_dev_runtime', n.oid, 'USAGE') AS runtime_usage,
  has_schema_privilege('cphconsult_dev_runtime', n.oid, 'CREATE') AS runtime_create
FROM pg_namespace n WHERE n.nspname = 'app';

SELECT
  has_database_privilege('cphconsult_dev_runtime', 'cphconsult_dev', 'CONNECT') AS runtime_connect,
  has_database_privilege('cphconsult_dev_runtime', 'cphconsult_dev', 'CREATE') AS runtime_database_create,
  has_table_privilege('cphconsult_dev_runtime', 'app.schema_migrations', 'INSERT') AS runtime_change_migrations,
  pg_has_role('cphconsult_dev_runtime', 'cphconsult_dev_owner', 'MEMBER') AS runtime_is_owner_member;

SELECT version FROM app.schema_migrations ORDER BY version;
COMMIT;
