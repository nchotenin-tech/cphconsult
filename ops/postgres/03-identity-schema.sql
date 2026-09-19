-- First application identity schema. Run entire file as postgres in cphconsult_dev.
-- No account passwords, clinical data, or test accounts are inserted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN
    RAISE EXCEPTION 'Wrong database: expected cphconsult_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0001-development-foundation') THEN
    RAISE EXCEPTION 'Foundation migration is required';
  END IF;
  IF EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0002-identity-schema') THEN
    RAISE EXCEPTION 'Identity migration already applied; do not overwrite';
  END IF;
END
$guard$;
SET LOCAL ROLE cphconsult_dev_owner;

CREATE TABLE app.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_id text UNIQUE,
  login text NOT NULL UNIQUE CHECK (login = lower(btrim(login)) AND length(login) BETWEEN 1 AND 254),
  status text NOT NULL DEFAULT 'pending_activation' CHECK (status IN ('pending_activation', 'active', 'disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Dentist FK is deferred until the legacy text-ID directory schema is mapped.
CREATE TABLE app.auth_identities (
  provider text NOT NULL,
  source_subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES app.app_users(id),
  PRIMARY KEY (provider, source_subject)
);
CREATE INDEX auth_identities_user_idx ON app.auth_identities(user_id);
CREATE TABLE app.auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES app.app_users(id),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.app_users(id),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  csrf_token_hash bytea NOT NULL CHECK (octet_length(csrf_token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (idle_expires_at > created_at AND idle_expires_at <= expires_at)
);
CREATE INDEX sessions_user_idx ON app.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON app.sessions(expires_at);
CREATE TABLE app.account_recovery_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.app_users(id),
  purpose text NOT NULL CHECK (purpose IN ('activation', 'password_reset')),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX recovery_user_idx ON app.account_recovery_tokens(user_id);
CREATE INDEX recovery_expiry_idx ON app.account_recovery_tokens(expires_at);

ALTER TABLE app.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.app_users FORCE ROW LEVEL SECURITY;
ALTER TABLE app.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.auth_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE app.auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.auth_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.account_recovery_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_recovery_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY app_users_self_read ON app.app_users FOR SELECT TO cphconsult_dev_runtime
  USING (id::text = nullif(current_setting('app.user_id', true), '') AND status = 'active');
GRANT SELECT (id, dentist_id, login, status, must_change_password) ON app.app_users TO cphconsult_dev_runtime;
-- No credential/session/recovery grants or permissive policies. Authentication
-- service functions and account provisioning will be reviewed in a later migration.
INSERT INTO app.schema_migrations(version) VALUES ('0002-identity-schema');
RESET ROLE;
COMMIT;
SELECT 'identity_schema_created' AS result;
