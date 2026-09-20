-- Initial read slice only, NOT the full source migration schema.
-- Run entire file as postgres in cphconsult_dev. No fixtures are inserted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF current_database() <> 'cphconsult_dev' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN RAISE EXCEPTION 'Use postgres for schema installation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0003-auth-functions') THEN RAISE EXCEPTION 'Auth migration required'; END IF;
  IF EXISTS (SELECT 1 FROM app.schema_migrations WHERE version = '0004-clinical-read') THEN RAISE EXCEPTION 'Already applied'; END IF;
END
$guard$;
SET LOCAL ROLE cphconsult_dev_owner;
CREATE TABLE app.hospitals (
  id text PRIMARY KEY, name text NOT NULL, level text NOT NULL
);
CREATE TABLE app.dentists (
  id text PRIMARY KEY, name text NOT NULL,
  hospital_id text REFERENCES app.hospitals(id),
  specialties text[] NOT NULL DEFAULT '{}',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'))
);
ALTER TABLE app.app_users ADD CONSTRAINT app_users_dentist_fk FOREIGN KEY (dentist_id) REFERENCES app.dentists(id);
CREATE TABLE app.consults (
  id text PRIMARY KEY,
  patient_name text NOT NULL, patient_age integer NOT NULL CHECK (patient_age BETWEEN 0 AND 130),
  patient_gender text NOT NULL, patient_scheme text NOT NULL,
  consult_details text NOT NULL,
  sender_id text REFERENCES app.dentists(id),
  target_hospital_id text REFERENCES app.hospitals(id),
  target_specialties text[] NOT NULL DEFAULT '{}',
  target_dentist_ids text[] NOT NULL DEFAULT '{}',
  primary_consultant_id text REFERENCES app.dentists(id),
  status text NOT NULL DEFAULT 'pending',
  post_consult_option text, refer_status text, shared_care_status text,
  refer_data jsonb NOT NULL DEFAULT '{}', shared_care_data jsonb NOT NULL DEFAULT '{}',
  attachments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consults_sender_idx ON app.consults(sender_id);
CREATE INDEX consults_target_hospital_idx ON app.consults(target_hospital_id);
CREATE INDEX consults_specialties_idx ON app.consults USING gin(target_specialties);
CREATE INDEX consults_targets_idx ON app.consults USING gin(target_dentist_ids);
CREATE TABLE app.consult_invitations (
  id text PRIMARY KEY, consult_id text NOT NULL REFERENCES app.consults(id),
  invited_dentist_id text NOT NULL REFERENCES app.dentists(id),
  status text NOT NULL CHECK (status IN ('pending','accepted','declined'))
);
ALTER TABLE app.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.hospitals FORCE ROW LEVEL SECURITY;
ALTER TABLE app.dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.dentists FORCE ROW LEVEL SECURITY;
ALTER TABLE app.consults ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.consults FORCE ROW LEVEL SECURITY;
ALTER TABLE app.consult_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.consult_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY hospitals_authenticated_read ON app.hospitals FOR SELECT TO cphconsult_dev_runtime
  USING (EXISTS (SELECT 1 FROM app.app_users u WHERE u.id::text = nullif(current_setting('app.user_id',true),'') AND u.status = 'active' AND NOT u.must_change_password));
CREATE POLICY dentists_authenticated_read ON app.dentists FOR SELECT TO cphconsult_dev_runtime
  USING (EXISTS (SELECT 1 FROM app.app_users u WHERE u.id::text = nullif(current_setting('app.user_id',true),'') AND u.status = 'active' AND NOT u.must_change_password));
CREATE POLICY consults_scoped_read ON app.consults FOR SELECT TO cphconsult_dev_runtime
  USING (EXISTS (
    SELECT 1 FROM app.app_users u JOIN app.dentists d ON d.id = u.dentist_id
    WHERE u.id::text = nullif(current_setting('app.user_id',true),'') AND u.status = 'active' AND NOT u.must_change_password
      AND (d.role = 'admin' OR d.id = consults.sender_id
        OR d.id = ANY(consults.target_dentist_ids)
        OR d.hospital_id = consults.target_hospital_id
        OR d.specialties && consults.target_specialties)
  ));
-- No runtime invitation grant: acceptance endpoint/mutation is not implemented.
GRANT SELECT ON app.hospitals, app.dentists, app.consults TO cphconsult_dev_runtime;
INSERT INTO app.schema_migrations(version) VALUES ('0004-clinical-read');
RESET ROLE;
COMMIT;
SELECT 'clinical_read_schema_created' AS result;
