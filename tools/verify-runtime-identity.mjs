import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withActorTransaction } from '../dist/actor-transaction.js';
import { assertRuntimeDenied } from './runtime-denial-check.mjs';

let pool;
let stage = 'local_target';
let passed = 0;
async function check(name, work) {
  stage = name;
  await work();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '5432');
  assert.equal(url.pathname, '/cphconsult_dev');
  assert.equal(url.username, 'cphconsult_dev_runtime');
  assert.equal(url.search + url.hash, '');
  pool = new pg.Pool({ connectionString: url.toString(), max: 1,
    connectionTimeoutMillis: 3000, statement_timeout: 3000, query_timeout: 4000 });
  pool.on('error', () => { console.error('runtime_identity_connection_failed'); process.exitCode = 1; });
  const identity = async client => (await client.query(`
    SELECT pg_backend_pid() AS pid, current_user AS actor_role,
      session_user AS login_role, current_database() AS database_name,
      nullif(current_setting('app.user_id', true), '') AS actor
  `)).rows[0];
  let backendPid;
  await check('real_runtime_login', async () => {
    const row = await identity(pool);
    assert.equal(row.database_name, 'cphconsult_dev');
    assert.equal(row.actor_role, 'cphconsult_dev_runtime');
    assert.equal(row.login_role, 'cphconsult_dev_runtime');
    assert.equal(row.actor, null);
    backendPid = row.pid;
    const { rows: [role] } = await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolbypassrls, false);
  });
  const noContext = async () => {
    const row = await identity(pool);
    assert.equal(row.pid, backendPid, 'connection must really be reused');
    assert.equal(row.actor, null);
    const result = await pool.query('SELECT id FROM app.app_users LIMIT 1');
    assert.equal(result.rowCount, 0);
  };
  await check('anonymous_reads_denied', noContext);
  const actorA = randomUUID();
  const actorB = randomUUID();
  await check('actor_a_commit', async () => {
    await withActorTransaction(pool, actorA, async client => {
      const row = await identity(client);
      assert.equal(row.pid, backendPid);
      assert.equal(row.actor, actorA);
    });
  });
  await check('context_cleared_after_commit', noContext);
  await check('actor_b_sql_error_rollback', async () => {
    await assert.rejects(withActorTransaction(pool, actorB, async client => {
      const row = await identity(client);
      assert.equal(row.pid, backendPid);
      assert.equal(row.actor, actorB);
      await client.query('SELECT 1 / 0');
    }), error => error.code === '22012');
  });
  await check('context_cleared_after_rollback', noContext);
  await check('credential_table_denied', async () => {
    await assertRuntimeDenied(pool, actorA, 'SELECT password_hash FROM app.auth_credentials LIMIT 0');
  });
  await check('account_write_denied', async () => {
    // WHERE false ensures this probe never changes a row even if grants regress.
    await assertRuntimeDenied(pool, actorA, "UPDATE app.app_users SET status = 'active' WHERE false");
  });
  await check('connection_remains_usable_and_unscoped', noContext);
  console.log(`runtime_identity_checks_passed: ${passed}/9`);
} catch {
  // No raw database error, connection URL, credentials or returned user values.
  console.error(`runtime_identity_checks_failed: ${stage}`);
  process.exitCode = 1;
} finally {
  await pool?.end().catch(() => {});
}
