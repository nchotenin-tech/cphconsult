import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../dist/app.js';
import { createAuthRouter, hashPassword } from '../../dist/auth.js';
import { readConfig } from '../../dist/config.js';

const origin = 'http://127.0.0.1:3100';
const password = 'synthetic-test-password-only-123!';
const password_hash = await hashPassword(password);
async function setup(t, originValue = origin) {
  const user = { id: '11111111-1111-4111-8111-111111111111', login: 'test@example.invalid', must_change_password: true, password_hash };
  const sessions = new Map();
  let active = true;
  const store = {
    async lookup(login) { return active && login === user.login ? user : undefined; },
    async start(id, expected, hash, csrf, old) {
      if (!active || expected !== user.password_hash) return false;
      if (old) sessions.delete(old.toString('hex'));
      sessions.set(hash.toString('hex'), { ...user, csrf_token_hash: csrf, expires: Date.now() + 60000 }); return true;
    },
    async resolve(hash) {
      const row = sessions.get(hash.toString('hex'));
      return active && row && row.expires > Date.now() ? row : undefined;
    },
    async revoke(hash) { sessions.delete(hash.toString('hex')); },
  };
  const app = createApp(async () => true, await createAuthRouter(store, originValue));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (path, options) => fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth${path}`, options);
  const login = (body = { login: user.login, password }, headers = {}) => request('/login', {
    method: 'POST', headers: { Origin: originValue, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { request, login, sessions, disable: () => { active = false; } };
}
test('login sets HttpOnly session, returns no secrets, logout requires CSRF and revokes it', async t => {
  const h = await setup(t);
  const response = await h.login(); assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body.user).sort(), ['id', 'login', 'mustChangePassword']);
  const headers = { Cookie: cookie.split(';')[0], Origin: origin };
  const me = await h.request('/me', { headers }); assert.equal(me.status, 200);
  assert.equal((await me.json()).csrfToken, body.csrfToken);
  assert.equal((await h.request('/logout', { method: 'POST', headers })).status, 403);
  assert.equal((await h.request('/logout', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': body.csrfToken } })).status, 204);
  assert.equal((await h.request('/me', { headers })).status, 401);
});
test('wrong password, unknown and disabled accounts return the same generic response', async t => {
  const h = await setup(t);
  for (const body of [{ login: 'test@example.invalid', password: 'wrong' }, { login: 'missing@example.invalid', password }]) {
    const response = await h.login(body); assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_CREDENTIALS' } });
  }
  h.disable(); assert.equal((await h.login()).status, 401);
});
test('missing/foreign Origin rejected and expired or disabled sessions cannot authenticate', async t => {
  const h = await setup(t);
  assert.equal((await h.login(undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await h.request('/login', { method: 'POST' })).status, 403);
  const result = await h.login();
  const headers = { Cookie: result.headers.get('set-cookie').split(';')[0] };
  for (const row of h.sessions.values()) row.expires = 0;
  assert.equal((await h.request('/me', { headers })).status, 401);
  const second = await h.login(); h.disable();
  assert.equal((await h.request('/me', { headers: { Cookie: second.headers.get('set-cookie').split(';')[0] } })).status, 401);
});
test('HTTPS origin uses Secure cookie; public HTTP origin and insecure production are rejected', async t => {
  const h = await setup(t, 'https://consult.example');
  assert.match((await h.login()).headers.get('set-cookie'), /; Secure/);
  assert.throws(() => readConfig({ APP_ORIGIN: 'http://consult.example' }));
  assert.throws(() => readConfig({ NODE_ENV: 'production' }));
});
test('login rotates existing token, validates input and rate-limits repeated attempts', async t => {
  const h = await setup(t);
  const first = await h.login(); const oldCookie = first.headers.get('set-cookie').split(';')[0];
  const second = await h.login(undefined, { Cookie: oldCookie }); assert.equal(second.status, 200);
  assert.notEqual(second.headers.get('set-cookie').split(';')[0], oldCookie);
  assert.equal((await h.request('/me', { headers: { Cookie: oldCookie } })).status, 401);
  assert.equal((await h.login({ login: 1, password })).status, 422);
  for (let index = 0; index < 7; index++) await h.login({});
  assert.equal((await h.login()).status, 429);
});
