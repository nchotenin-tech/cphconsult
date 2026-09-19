import pg from 'pg';
import { hashPassword } from '../dist/auth.js';

let client;
let begun = false;
let stage = 'password_validation';
try {
  const password = process.env.CPH_TEST_PASSWORD ?? '';
  if (password.length < 12 || Buffer.byteLength(password) > 1024 || !process.env.CPH_LOCAL_ADMIN_PASSWORD) throw new Error('input');
  const hash = await hashPassword(password);
  stage = 'local_admin_connection';
  client = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'cphconsult_dev', user: 'postgres', password: process.env.CPH_LOCAL_ADMIN_PASSWORD,
    connectionTimeoutMillis: 3000, statement_timeout: 5000, query_timeout: 6000 });
  await client.connect();
  stage = 'identity_and_migration';
  const { rows: [identity] } = await client.query("SELECT current_database() AS db, current_user AS actor, rolsuper FROM pg_roles WHERE rolname = current_user");
  if (identity?.db !== 'cphconsult_dev' || identity.actor !== 'postgres' || !identity.rolsuper) throw new Error('target');
  const migration = await client.query("SELECT version FROM app.schema_migrations WHERE version = '0003-auth-functions'");
  if (migration.rowCount !== 1) throw new Error('migration');
  await client.query('BEGIN'); begun = true;
  stage = 'account_exists_or_insert_rejected';
  const { rows: [user] } = await client.query("INSERT INTO app.app_users(login,status,must_change_password) VALUES ('tester@example.invalid','active',false) RETURNING id");
  await client.query('INSERT INTO app.auth_credentials(user_id,password_hash) VALUES ($1,$2)', [user.id, hash]);
  await client.query('COMMIT'); begun = false;
  console.log('test_account_created: tester@example.invalid');
  console.log('No dentist mapping or clinical/admin privileges were assigned.');
} catch {
  if (begun) await client?.query('ROLLBACK').catch(() => {});
  console.error(`test_account_creation_failed: ${stage}`);
  process.exitCode = 1;
} finally { await client?.end().catch(() => {}); }
