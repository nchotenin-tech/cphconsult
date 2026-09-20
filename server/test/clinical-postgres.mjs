import assert from 'node:assert/strict';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../../dist/app.js';
import { createAuthRouter, hashPassword } from '../../dist/auth.js';
import { PostgresAuthStore } from '../../dist/auth-store.js';
import { createConsultRouter } from '../../dist/consults.js';
import { withActorTransaction } from '../../dist/actor-transaction.js';
import { hospitals, dentists, accounts, consults, invitations, expectedReaders } from './fixtures/clinical.mjs';

const options = { host: '127.0.0.1', port: 55439, database: 'cphconsult_dev' };
const admin = new pg.Client({ ...options, user: 'postgres' });
const pool = new pg.Pool({ ...options, user: 'cphconsult_dev_runtime', max: 1 });
let server;
try {
  await admin.connect();
  const password = 'Synthetic-clinical-test-password-only!';
  const hash = await hashPassword(password);
  await admin.query('BEGIN');
  // Table/column identifiers come exclusively from these versioned synthetic fixtures.
  for (const [table, rows] of [['hospitals', hospitals], ['dentists', dentists], ['app_users', accounts.map(row => ({ ...row, must_change_password: false }))], ['consults', consults], ['consult_invitations', invitations]]) {
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map(key => ['refer_data', 'shared_care_data', 'attachments'].includes(key) ? JSON.stringify(row[key]) : row[key]);
      await admin.query(`INSERT INTO app.${table} (${columns.join(',')}) VALUES (${columns.map((_, index) => '$' + (index + 1)).join(',')})`, values);
    }
  }
  for (const account of accounts) await admin.query('INSERT INTO app.auth_credentials(user_id,password_hash) VALUES ($1,$2)', [account.id, hash]);
  await admin.query('COMMIT');
  const auth = new PostgresAuthStore(pool);
  server = createApp(async () => true, await createAuthRouter(auth, 'http://127.0.0.1:3100'), createConsultRouter(pool, auth)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/v1/consults')).status, 401);
  const cookies = [];
  let combinations = 0;
  for (const account of accounts) {
    const login = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3100', 'Content-Type': 'application/json' }, body: JSON.stringify({ login: account.login, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0]; cookies.push(cookie);
    const expected = expectedReaders.includes(account.dentist_id);
    const list = await fetch(base + '/api/v1/consults', { headers: { Cookie: cookie } }); assert.equal(list.status, 200);
    assert.equal((await list.json()).items.length, expected ? consults.length : 0);
    for (const consult of consults) {
      const detail = await fetch(base + '/api/v1/consults/' + consult.id, { headers: { Cookie: cookie } });
      assert.equal(detail.status, expected ? 200 : 404, `${account.dentist_id}/${consult.id}`);
      const dbRows = await withActorTransaction(pool, account.id, async client => (await client.query('SELECT id FROM app.consults WHERE id=$1', [consult.id])).rows);
      assert.equal(dbRows.length, expected ? 1 : 0);
      combinations++;
    }
  }
  const headers = { Cookie: cookies[0] };
  let cursor = '', seen = [];
  do {
    const response = await fetch(base + '/api/v1/consults?limit=2&after=' + encodeURIComponent(cursor), { headers });
    assert.equal(response.status, 200);
    const page = await response.json(); seen.push(...page.items.map(row => row.id)); cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(seen, consults.map(row => row.id).sort());
  for (const status of ['all', 'pending', 'active', 'completed']) {
    let after = '', ids = [];
    do {
      const response = await fetch(base + '/api/v1/consults?limit=1&status=' + status + '&after=' + encodeURIComponent(after), { headers });
      assert.equal(response.status, 200);
      const page = await response.json();
      ids.push(...page.items.map(row => row.id)); after = page.nextCursor;
      assert.ok(ids.length <= consults.length, 'pagination must terminate without duplicates');
    } while (after);
    assert.deepEqual(ids, consults.filter(row => status === 'all' || row.status === status).map(row => row.id).sort());
    const denied = await fetch(base + '/api/v1/consults?status=' + status, { headers: { Cookie: cookies[6] } });
    assert.equal(denied.status, 200);
    assert.deepEqual(await denied.json(), { items: [], nextCursor: null });
  }
  for (const query of ['status=unknown', 'status=active&status=pending', 'status=']) {
    assert.equal((await fetch(base + '/api/v1/consults?' + query, { headers })).status, 422);
  }
  assert.equal((await fetch(base + '/api/v1/consults?limit=101', { headers })).status, 422);
  // Cover terminal, cancelled, null and unknown states, not just the six demo defaults.
  for (const workflow of ['refer', 'shared_care']) {
    const states = workflow === 'refer' ? ['planning','appointment_confirmed','referred_back','cancelled',null,'unknown'] : ['in_progress','waiting','completed','cancelled',null,'unknown'];
    for (let i = 0; i < consults.length; i++) {
      await admin.query('UPDATE app.consults SET post_consult_option=$1, refer_status=$2, shared_care_status=$3 WHERE id=$4', [workflow, workflow === 'refer' ? states[i] : null, workflow === 'shared_care' ? states[i] : null, consults[i].id]);
    }
    for (const [progress, indexes] of [['all',[0,1,2,3,4,5]],['active',[0,1,4,5]],['finished',[2]],['cancelled',[3]]]) {
      let after = '', found = [];
      do {
        const response = await fetch(base + `/api/v1/consults?workflow=${workflow}&progress=${progress}&limit=1&after=${encodeURIComponent(after)}`, { headers });
        assert.equal(response.status, 200);
        const page = await response.json(); found.push(...page.items.map(item => item.id)); after = page.nextCursor;
        assert.ok(found.length <= 6);
      } while (after);
      assert.deepEqual(found, indexes.map(i => consults[i].id).sort());
      const denied = await fetch(base + `/api/v1/consults?workflow=${workflow}&progress=${progress}`, { headers: { Cookie: cookies[6] } });
      assert.deepEqual(await denied.json(), { items: [], nextCursor: null });
    }
  }
  for (const item of consults) await admin.query('UPDATE app.consults SET post_consult_option=$1, refer_status=$2, shared_care_status=$3 WHERE id=$4', [item.post_consult_option,item.refer_status,item.shared_care_status,item.id]);
  const combined = await fetch(base + '/api/v1/consults?status=active&workflow=refer', { headers });
  for (const [q, expected] of [['ผู้ป่วยจำลอง 1',[consults[0].id]],['  FIXTURE-CASE-ACTIVE  ',[consults[1].id]],['%',[]],['_',[]],["' OR true --",[]],['not-found',[]]]) {
    const response = await fetch(base + '/api/v1/consults?q=' + encodeURIComponent(q), { headers });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items.map(item => item.id), expected);
  }
  let searchAfter = '', searchIds = [];
  do {
    const response = await fetch(base + '/api/v1/consults?workflow=refer&q=fixture-case&limit=1&after=' + encodeURIComponent(searchAfter), { headers });
    assert.equal(response.status, 200);
    const page = await response.json(); searchIds.push(...page.items.map(item => item.id)); searchAfter = page.nextCursor;
    assert.ok(searchIds.length <= 2);
  } while (searchAfter);
  assert.deepEqual(searchIds, consults.filter(item => item.post_consult_option === 'refer').map(item => item.id).sort());
  const deniedSearch = await fetch(base + '/api/v1/consults?q=fixture-case', { headers: { Cookie: cookies[6] } });
  assert.deepEqual(await deniedSearch.json(), { items: [], nextCursor: null });
  for (const query of ['q=a&q=b','q=' + 'a'.repeat(201),'q=%00']) assert.equal((await fetch(base + '/api/v1/consults?' + query, { headers })).status, 422);
  assert.deepEqual(await combined.json(), { items: [], nextCursor: null });
  for (const query of ['workflow=bad','progress=active','workflow=refer&progress=bad','workflow=refer&workflow=shared_care','workflow=refer&progress=all&progress=active']) {
    assert.equal((await fetch(base + '/api/v1/consults?' + query, { headers })).status, 422);
  }
  assert.equal((await fetch(base + '/api/v1/consults/missing-case', { headers })).status, 404);
  assert.equal((await fetch(base + '/api/v1/consults/' + consults[0].id, { headers: { Cookie: cookies[6], 'X-User-Id': accounts[7].id } })).status, 404);
  assert.equal((await pool.query('SELECT id FROM app.consults')).rowCount, 0);
  await assert.rejects(pool.query("UPDATE app.consults SET status='active' WHERE false"), error => error.code === '42501');
  await admin.query('UPDATE app.app_users SET must_change_password=true WHERE id=$1', [accounts[0].id]);
  assert.equal((await fetch(base + '/api/v1/consults', { headers })).status, 403);
  await admin.query("UPDATE app.app_users SET status='disabled' WHERE id=$1", [accounts[1].id]);
  assert.equal((await fetch(base + '/api/v1/consults', { headers: { Cookie: cookies[1] } })).status, 401);
  console.log(`clinical_postgres_http_checks_passed: ${combinations} role-case pairs plus pagination and negative checks`);
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await pool.end(); await admin.end();
}
