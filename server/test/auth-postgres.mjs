import assert from 'node:assert/strict';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../../dist/app.js';
import { createAuthRouter, hashPassword } from '../../dist/auth.js';
import { PostgresAuthStore } from '../../dist/auth-store.js';

// Dedicated disposable cluster only, never the user's instance on port 5432.
const port = 55439;
const admin = new pg.Client({ host: '127.0.0.1', port, database: 'cphconsult_dev', user: 'postgres' });
const pool = new pg.Pool({ host: '127.0.0.1', port, database: 'cphconsult_dev', user: 'cphconsult_dev_runtime', max: 1 });
let server;
try {
  await admin.connect();
  const password = 'Synthetic-only-Auth-test-12345!';
  const hash = await hashPassword(password);
  await admin.query("INSERT INTO app.app_users(id,login,status,must_change_password) VALUES ('11111111-1111-4111-8111-111111111111','http-test@example.invalid','active',false)");
  await admin.query("INSERT INTO app.auth_credentials(user_id,password_hash) VALUES ('11111111-1111-4111-8111-111111111111',$1)", [hash]);
  await admin.query('ALTER ROLE cphconsult_dev_runtime LOGIN');
  const store = new PostgresAuthStore(pool);
  server = createApp(async () => true, await createAuthRouter(store, 'http://127.0.0.1:3100')).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  const login = async () => fetch(base + '/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3100', 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'http-test@example.invalid', password }) });
  const response = await login(); assert.equal(response.status, 200, 'real DB login');
  const body = await response.json();
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/me', { headers: { Cookie: cookie } })).status, 200);
  const persisted = (await admin.query('SELECT octet_length(token_hash) AS bytes FROM app.sessions')).rows;
  assert.equal(persisted.length, 1); assert.equal(persisted[0].bytes, 32);
  await assert.rejects(pool.query('SELECT password_hash FROM app.auth_credentials'), error => error.code === '42501');
  const logout = await fetch(base + '/logout', { method: 'POST', headers: { Cookie: cookie, Origin: 'http://127.0.0.1:3100', 'X-CSRF-Token': body.csrfToken } });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(base + '/me', { headers: { Cookie: cookie } })).status, 401);
  const expired = await login(); assert.equal(expired.status, 200);
  const expiredCookie = expired.headers.get('set-cookie').split(';')[0];
  await admin.query("UPDATE app.sessions SET created_at = now() - interval '2 hours', idle_expires_at = now() - interval '1 hour'");
  assert.equal((await fetch(base + '/me', { headers: { Cookie: expiredCookie } })).status, 401);
  const disabled = await login(); assert.equal(disabled.status, 200);
  await admin.query("UPDATE app.app_users SET status = 'disabled' WHERE login = 'http-test@example.invalid'");
  assert.equal((await fetch(base + '/me', { headers: { Cookie: disabled.headers.get('set-cookie').split(';')[0] } })).status, 401);
  assert.equal((await login()).status, 401);
  console.log('auth_postgres_http_checks_passed');
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await pool.end(); await admin.end();
}
