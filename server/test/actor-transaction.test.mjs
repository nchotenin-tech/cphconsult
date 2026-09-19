import test from 'node:test';
import assert from 'node:assert/strict';
import { withActorTransaction } from '../../dist/actor-transaction.js';

const actor = '00000000-0000-4000-8000-000000000001';
function harness(failOn = []) {
  const calls = [];
  const releases = [];
  const client = {
    async query(sql, values) {
      calls.push([sql, values]);
      if (failOn.includes(sql)) throw new Error(`failure: ${sql}`);
      return { rows: [] };
    },
    release(destroy) { releases.push(destroy); },
  };
  return { calls, releases, client, pool: { async connect() { return client; } } };
}
test('actor context and work use one client and commit before release', async () => {
  const h = harness();
  const result = await withActorTransaction(h.pool, actor, async client => {
    assert.equal(client, h.client);
    await client.query('SELECT fixture');
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(h.calls.map(([sql]) => sql), ['BEGIN', "SELECT set_config('app.user_id', $1, true)", 'SELECT fixture', 'COMMIT']);
  assert.deepEqual(h.calls[1][1], [actor]);
  assert.deepEqual(h.releases, [false]);
});
test('failed operation rolls back and preserves original error', async () => {
  const h = harness();
  const original = new Error('operation failed');
  await assert.rejects(withActorTransaction(h.pool, actor, async () => { throw original; }), error => error === original);
  assert.equal(h.calls.at(-1)[0], 'ROLLBACK');
  assert.deepEqual(h.releases, [false]);
});
test('rollback failure discards connection instead of returning polluted state', async () => {
  const h = harness(['ROLLBACK']);
  await assert.rejects(withActorTransaction(h.pool, actor, async () => { throw new Error('operation'); }), /operation/);
  assert.deepEqual(h.releases, [true]);
});
test('begin failure discards connection and never executes work', async () => {
  const h = harness(['BEGIN']);
  await assert.rejects(withActorTransaction(h.pool, actor, async () => assert.fail('work must not run')), /BEGIN/);
  assert.deepEqual(h.releases, [true]);
});
test('invalid actor cannot acquire a database connection', async () => {
  const pool = { async connect() { assert.fail('must reject before connecting'); } };
  await assert.rejects(withActorTransaction(pool, "bad'; SET ROLE postgres", async () => {}), /Invalid authenticated actor/);
});
