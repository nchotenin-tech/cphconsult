import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../dist/app.js';
import { readConfig } from '../../dist/config.js';
import { createDatabase } from '../../dist/database.js';

async function serve(t, probe) {
  const server = createApp(probe).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('liveness works without database; readiness cannot falsely claim a finished app', async t => {
  const request = await serve(t, async () => false);
  assert.equal((await request('/health/live')).status, 200);
  assert.equal((await request('/health/database')).status, 503);
  const ready = await request('/health/ready');
  assert.equal(ready.status, 503);
  assert.equal((await ready.json()).reason, 'application_not_implemented');
});

test('database exceptions never expose connection strings or SQL', async t => {
  const request = await serve(t, async () => { throw new Error('postgres://secret SQL patient'); });
  const response = await request('/health/database');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('dependency success is separate from clinical readiness; unknown clinical API is absent', async t => {
  const request = await serve(t, async () => true);
  assert.equal((await request('/health/database')).status, 200);
  assert.equal((await request('/health/ready')).status, 503);
  const response = await request('/api/v1/consults');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND' } });
});

test('configuration rejects malformed ports and database URLs without echoing credentials', () => {
  for (const PORT of ['0', '-1', '65536', '3100junk', '1.5']) assert.throws(() => readConfig({ PORT }));
  assert.throws(() => readConfig({ DATABASE_URL: 'https://secret@example.com/db' }), /^Error: Invalid DATABASE_URL$/);
  assert.equal(readConfig({}).host, '127.0.0.1');
});

test('missing database configuration does not fall back to ambient pg credentials', async () => {
  const database = createDatabase(undefined);
  assert.equal(await database.probe(), false);
  await database.close();
});
