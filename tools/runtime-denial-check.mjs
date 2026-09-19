import assert from 'node:assert/strict';
import { withActorTransaction } from '../dist/actor-transaction.js';

export async function assertRuntimeDenied(pool, actorId, sql) {
  // pool.query releases with the SQL error and evicts the connection. Keep the
  // expected denial inside a checked-out transaction so rollback clears it.
  await assert.rejects(
    withActorTransaction(pool, actorId, client => client.query(sql)),
    error => error.code === '42501',
  );
}
