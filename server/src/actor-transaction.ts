import type { Pool, PoolClient } from 'pg';

/** Internal boundary: actorId must come from verified server-side authentication,
 * never directly from request JSON/headers. No HTTP route uses this yet. */
export async function withActorTransaction<T>(
  pool: Pick<Pool, 'connect'>,
  actorId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
    throw new Error('Invalid authenticated actor');
  }
  const client = await pool.connect();
  let begun = false;
  let destroy = false;
  try {
    await client.query('BEGIN');
    begun = true;
    await client.query("SELECT set_config('app.user_id', $1, true)", [actorId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (begun) {
      try { await client.query('ROLLBACK'); } catch { destroy = true; }
    } else {
      destroy = true;
    }
    throw error;
  } finally {
    client.release(destroy);
  }
}
