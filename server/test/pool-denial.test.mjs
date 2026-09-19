import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import pg from 'pg';
import { assertRuntimeDenied } from '../../tools/runtime-denial-check.mjs';

// Real pg.Pool lifecycle with a deterministic transport stub; no DB credentials.
let sequence = 0;
class TransportClient extends EventEmitter {
  _queryable = true;
  _ending = false;
  pid = ++sequence;
  connect(callback) { queueMicrotask(() => callback(null)); }
  end(callback) { this._ending = true; queueMicrotask(() => callback?.()); }
  ref() {}
  unref() {}
  query(sql, values, callback) {
    if (typeof values === 'function') callback = values;
    const error = sql === 'DENIED' ? Object.assign(new Error('permission denied'), { code: '42501' }) : null;
    const result = { rows: [{ pid: this.pid }] };
    if (callback) { queueMicrotask(() => callback(error, result)); return; }
    return error ? Promise.reject(error) : Promise.resolve(result);
  }
}
test('expected permission-denial probe preserves physical pooled connection', async () => {
  const pool = new pg.Pool({ Client: TransportClient, max: 1 });
  try {
    const before = (await pool.query('PID')).rows[0].pid;
    await assertRuntimeDenied(pool, '00000000-0000-4000-8000-000000000001', 'DENIED');
    const after = (await pool.query('PID')).rows[0].pid;
    assert.equal(after, before, 'permission probe must not evict the connection under test');
  } finally { await pool.end(); }
});
