import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const db = new pg.Client({ host: '127.0.0.1', port: 55439, database: 'cphconsult_dev', user: 'postgres' });
const sql = readFileSync(new URL('../../ops/postgres/07-local-clinical-demo.sql', import.meta.url), 'utf8').replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
try {
  await db.connect();
  await db.query('BEGIN');
  await db.query("INSERT INTO app.app_users(login,status,must_change_password) VALUES ('tester@example.invalid','active',false)");
  await db.query(sql);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM app.consults')).rows[0].n, 6);
  assert.equal((await db.query("SELECT dentist_id FROM app.app_users WHERE login='tester@example.invalid'")).rows[0].dentist_id, 'fixture-d-sender');
  await db.query('SAVEPOINT repeat_demo');
  await assert.rejects(db.query(sql), /Demo requires empty clinical tables/);
  await db.query('ROLLBACK TO SAVEPOINT repeat_demo');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM app.consults')).rows[0].n, 6);
  console.log('clinical_demo_checks_passed: six cases, tester mapping, repeat rejected');
} finally {
  await db.query('ROLLBACK').catch(() => {});
  await db.end();
}
