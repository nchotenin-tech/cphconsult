-- Run the entire file as postgres in cphconsult_dev. No users/passwords seeded.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RAISE EXCEPTION 'Use the postgres administrator connection for this migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0002-identity-schema') THEN
    RAISE EXCEPTION 'Identity schema is required';
  END IF;
  IF EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0003-auth-functions') THEN
    RAISE EXCEPTION 'Auth migration already applied';
  END IF;
END
$guard$;
SET LOCAL ROLE cphconsult_dev_owner;
-- FORCE RLS remains enabled. Only the non-login function owner gets these policies.
CREATE POLICY auth_owner_users_read ON app.app_users FOR SELECT TO cphconsult_dev_owner USING (true);
CREATE POLICY auth_owner_credentials_read ON app.auth_credentials FOR SELECT TO cphconsult_dev_owner USING (true);
-- SELECT FOR SHARE also needs UPDATE-policy visibility under FORCE RLS.
-- WITH CHECK false keeps actual account/credential updates forbidden here.
CREATE POLICY auth_owner_users_lock ON app.app_users FOR UPDATE TO cphconsult_dev_owner USING (true) WITH CHECK (false);
CREATE POLICY auth_owner_credentials_lock ON app.auth_credentials FOR UPDATE TO cphconsult_dev_owner USING (true) WITH CHECK (false);
CREATE POLICY auth_owner_sessions ON app.sessions TO cphconsult_dev_owner USING (true) WITH CHECK (true);

CREATE FUNCTION app.auth_lookup(p_login text)
RETURNS TABLE(id uuid, login text, must_change_password boolean, password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT u.id, u.login, u.must_change_password, c.password_hash
  FROM app.app_users u JOIN app.auth_credentials c ON c.user_id = u.id
  WHERE u.login = p_login AND u.status = 'active';
$$;

CREATE FUNCTION app.auth_start_session(p_user uuid, p_expected_hash text, p_token bytea, p_csrf bytea, p_old_token bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
BEGIN
  -- Lock account and credential rows so state/password cannot change between
  -- revalidation and insert. Password verification itself occurs in Node.
  PERFORM 1 FROM app.app_users u JOIN app.auth_credentials c ON c.user_id = u.id
    WHERE u.id = p_user AND u.status = 'active' AND c.password_hash = p_expected_hash
    FOR SHARE OF u, c;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_token IS NULL OR p_csrf IS NULL OR octet_length(p_token) <> 32 OR octet_length(p_csrf) <> 32 THEN
    RAISE EXCEPTION 'Invalid session digest';
  END IF;
  INSERT INTO app.sessions(user_id, token_hash, csrf_token_hash, expires_at, idle_expires_at)
    VALUES (p_user, p_token, p_csrf, now() + interval '8 hours', now() + interval '30 minutes');
  UPDATE app.sessions SET revoked_at = now()
    WHERE token_hash = p_old_token AND user_id = p_user AND revoked_at IS NULL;
  RETURN true;
END
$$;

CREATE FUNCTION app.auth_resolve_session(p_token bytea)
RETURNS TABLE(id uuid, login text, must_change_password boolean, csrf_token_hash bytea)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  UPDATE app.sessions s SET idle_expires_at = least(s.expires_at, now() + interval '30 minutes')
  FROM app.app_users u WHERE s.user_id = u.id AND u.status = 'active'
    AND s.token_hash = p_token AND s.revoked_at IS NULL
    AND s.expires_at > now() AND s.idle_expires_at > now()
  RETURNING u.id, u.login, u.must_change_password, s.csrf_token_hash;
$$;

CREATE FUNCTION app.auth_revoke_session(p_token bytea)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  UPDATE app.sessions SET revoked_at = now() WHERE token_hash = p_token AND revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION app.auth_lookup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_start_session(uuid,text,bytea,bytea,bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_resolve_session(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_revoke_session(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.auth_lookup(text), app.auth_start_session(uuid,text,bytea,bytea,bytea),
  app.auth_resolve_session(bytea), app.auth_revoke_session(bytea) TO cphconsult_dev_runtime;
INSERT INTO app.schema_migrations(version) VALUES ('0003-auth-functions');
RESET ROLE;
COMMIT;
SELECT 'auth_functions_created' AS result;
