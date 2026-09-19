-- Run entire file as postgres in cphconsult_dev AFTER 03.
-- Admin seeds synthetic rows only; assertions execute as the runtime role.
-- All inserted rows are rolled back. This is not a real-login/pool reuse test.
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RAISE EXCEPTION 'Run fixture setup as postgres';
  END IF;
END
$guard$;
INSERT INTO app.app_users(id, login, status) VALUES
 ('11111111-1111-4111-8111-111111111111', 'rls-check-a@example.invalid', 'active'),
 ('22222222-2222-4222-8222-222222222222', 'rls-check-b@example.invalid', 'active');

SET LOCAL ROLE cphconsult_dev_runtime;
SELECT set_config('app.user_id', '', true);
DO $checks$
DECLARE
  visible_ids uuid[];
BEGIN
  IF current_user <> 'cphconsult_dev_runtime' OR EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'Invalid test role'; END IF;
  IF EXISTS (SELECT id FROM app.app_users) THEN RAISE EXCEPTION 'Anonymous context leaked a user'; END IF;

  PERFORM set_config('app.user_id', '11111111-1111-4111-8111-111111111111', true);
  SELECT array_agg(id) INTO visible_ids FROM app.app_users;
  IF visible_ids IS DISTINCT FROM ARRAY['11111111-1111-4111-8111-111111111111'::uuid] THEN
    RAISE EXCEPTION 'User A isolation failed';
  END IF;
  PERFORM set_config('app.user_id', '22222222-2222-4222-8222-222222222222', true);
  SELECT array_agg(id) INTO visible_ids FROM app.app_users;
  IF visible_ids IS DISTINCT FROM ARRAY['22222222-2222-4222-8222-222222222222'::uuid] THEN
    RAISE EXCEPTION 'User B isolation failed';
  END IF;
  BEGIN
    PERFORM password_hash FROM app.auth_credentials;
    RAISE EXCEPTION 'Credential access unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE app.app_users SET status = 'active' WHERE id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Account mutation unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('app.user_id', '', true);
  IF EXISTS (SELECT id FROM app.app_users) THEN RAISE EXCEPTION 'Cleared context leaked a user'; END IF;
  RAISE NOTICE 'identity_rls_checks_passed';
END
$checks$;
ROLLBACK;
-- Look for NOTICE identity_rls_checks_passed AND no ERROR in Messages.
-- ROLLBACK alone is not proof of a passing test.
