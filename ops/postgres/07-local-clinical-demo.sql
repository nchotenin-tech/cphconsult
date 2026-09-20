-- Synthetic local demo only. Run entire file as postgres in cphconsult_dev.
-- Maps the existing tester account to the synthetic sender; no password changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
 IF current_database() <> 'cphconsult_dev' OR current_user <> 'postgres' THEN RAISE EXCEPTION 'Use postgres in cphconsult_dev'; END IF;
 IF NOT EXISTS (SELECT 1 FROM app.schema_migrations WHERE version='0004-clinical-read') THEN RAISE EXCEPTION 'Clinical read migration required'; END IF;
END
$guard$;
LOCK TABLE app.app_users, app.hospitals, app.dentists, app.consults, app.consult_invitations IN EXCLUSIVE MODE;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM app.hospitals) OR EXISTS (SELECT 1 FROM app.dentists) OR EXISTS (SELECT 1 FROM app.consults) OR EXISTS (SELECT 1 FROM app.consult_invitations) THEN RAISE EXCEPTION 'Demo requires empty clinical tables; nothing overwritten'; END IF;
 IF NOT EXISTS (SELECT 1 FROM app.app_users WHERE login='tester@example.invalid' AND dentist_id IS NULL AND status='active' AND NOT must_change_password) THEN RAISE EXCEPTION 'Active unmapped tester account required'; END IF;
END
$guard$;
INSERT INTO app.hospitals (id,name,level) VALUES ('fixture-h-origin','โรงพยาบาลจำลองต้นทาง','community');
INSERT INTO app.hospitals (id,name,level) VALUES ('fixture-h-destination','โรงพยาบาลจำลองปลายทาง','general');
INSERT INTO app.hospitals (id,name,level) VALUES ('fixture-h-other','โรงพยาบาลจำลองอื่น','community');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-sender','ทันตแพทย์จำลอง sender','fixture-h-origin',ARRAY['general'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-primary','ทันตแพทย์จำลอง primary','fixture-h-destination',ARRAY['oral-surgery'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-destination-other-specialty','ทันตแพทย์จำลอง destination-other-specialty','fixture-h-destination',ARRAY['general'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-same-specialty-other-hospital','ทันตแพทย์จำลอง same-specialty-other-hospital','fixture-h-other',ARRAY['oral-surgery'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-pending-invitee','ทันตแพทย์จำลอง pending-invitee','fixture-h-other',ARRAY['general'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-accepted-invitee','ทันตแพทย์จำลอง accepted-invitee','fixture-h-other',ARRAY['general'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-unrelated','ทันตแพทย์จำลอง unrelated','fixture-h-other',ARRAY['general'],'user');
INSERT INTO app.dentists (id,name,hospital_id,specialties,role) VALUES ('fixture-d-admin','ทันตแพทย์จำลอง admin','fixture-h-other','{}'::text[],'admin');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-pending','ผู้ป่วยจำลอง 1',30,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],NULL,'pending',NULL,NULL,NULL,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'2026-09-10T02:00:00.000Z');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-active','ผู้ป่วยจำลอง 2',31,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],'fixture-d-primary','active',NULL,NULL,NULL,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'2026-09-11T02:00:00.000Z');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-closed','ผู้ป่วยจำลอง 3',32,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],'fixture-d-primary','completed',NULL,NULL,NULL,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'2026-09-12T02:00:00.000Z');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-refer-planning','ผู้ป่วยจำลอง 4',33,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],'fixture-d-primary','completed','refer','planning',NULL,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'2026-09-13T02:00:00.000Z');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-refer-finished','ผู้ป่วยจำลอง 5',34,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],'fixture-d-primary','completed','refer','referred_back',NULL,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'2026-09-14T02:00:00.000Z');
INSERT INTO app.consults (id,patient_name,patient_age,patient_gender,patient_scheme,consult_details,sender_id,target_hospital_id,target_specialties,target_dentist_ids,primary_consultant_id,status,post_consult_option,refer_status,shared_care_status,refer_data,shared_care_data,attachments,created_at) VALUES ('fixture-case-shared-care','ผู้ป่วยจำลอง 6',35,'male','fixture-only','ข้อมูลจำลองสำหรับทดสอบสิทธิ์เท่านั้น','fixture-d-sender','fixture-h-destination',ARRAY['oral-surgery'],ARRAY['fixture-d-primary','fixture-d-accepted-invitee'],'fixture-d-primary','completed','shared_care',NULL,'in_progress','{}'::jsonb,'{"steps":[{"id":"fixture-step-1","number":1,"status":"waiting","detail":"แผนจำลอง"}]}'::jsonb,'[]'::jsonb,'2026-09-15T02:00:00.000Z');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-pending-pending-invite','fixture-case-pending','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-pending-accepted-invite','fixture-case-pending','fixture-d-accepted-invitee','accepted');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-active-pending-invite','fixture-case-active','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-active-accepted-invite','fixture-case-active','fixture-d-accepted-invitee','accepted');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-closed-pending-invite','fixture-case-closed','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-closed-accepted-invite','fixture-case-closed','fixture-d-accepted-invitee','accepted');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-refer-planning-pending-invite','fixture-case-refer-planning','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-refer-planning-accepted-invite','fixture-case-refer-planning','fixture-d-accepted-invitee','accepted');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-refer-finished-pending-invite','fixture-case-refer-finished','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-refer-finished-accepted-invite','fixture-case-refer-finished','fixture-d-accepted-invitee','accepted');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-shared-care-pending-invite','fixture-case-shared-care','fixture-d-pending-invitee','pending');
INSERT INTO app.consult_invitations (id,consult_id,invited_dentist_id,status) VALUES ('fixture-case-shared-care-accepted-invite','fixture-case-shared-care','fixture-d-accepted-invitee','accepted');
UPDATE app.app_users SET dentist_id='fixture-d-sender' WHERE login='tester@example.invalid' AND dentist_id IS NULL;
COMMIT;
SELECT 'clinical_demo_created' AS result;
