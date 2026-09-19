-- Run the ENTIRE file in pgAdmin Query Tool, connected to cphconsult_dev
-- as postgres. First-time setup only; existing names cause a rollback.
-- No passwords, clinical tables, imports or changes to rcis.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN
    RAISE EXCEPTION 'Wrong database: connect to cphconsult_dev before running this file';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RAISE EXCEPTION 'Run initial setup as the local postgres administrator';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('cphconsult_dev_owner', 'cphconsult_dev_runtime'))
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
    RAISE EXCEPTION 'Foundation names already exist. Stop and inspect; do not overwrite existing roles/schema';
  END IF;
END
$guard$;

-- Roles are cluster-wide, so names explicitly identify this development project.
-- Neither can log in. Password setup and login activation are a later step.
CREATE ROLE cphconsult_dev_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE cphconsult_dev_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON DATABASE cphconsult_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE cphconsult_dev TO cphconsult_dev_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app AUTHORIZATION cphconsult_dev_owner;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO cphconsult_dev_runtime;

SET LOCAL ROLE cphconsult_dev_owner;
-- Functions otherwise receive PUBLIC EXECUTE by default. Revoke globally for
-- objects this owner will create in this database; schema-local revoke alone
-- would not remove the global default.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
-- No blanket table/function grants to runtime. Future migrations grant narrowly.
CREATE TABLE app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.schema_migrations(version) VALUES ('0001-development-foundation');
RESET ROLE;
COMMIT;

SELECT current_database() AS database_name, 'foundation_created' AS result;
