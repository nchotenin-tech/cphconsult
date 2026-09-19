import pg from 'pg';
import { createDatabase } from '../dist/database.js';

// Intentionally accepts no command-line password and prints no database error details.
const connectionString = process.env.DATABASE_URL;
let client;
let database;
try {
  const url = new URL(connectionString ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || url.hostname !== '127.0.0.1' || url.port !== '5432'
      || url.pathname !== '/cphconsult_dev' || url.username !== 'cphconsult_dev_runtime'
      || url.search || url.hash) throw new Error('target');
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000,
    statement_timeout: 3000, query_timeout: 4000 });
  client.on('error', () => { console.error('local_database_connection_failed'); process.exitCode = 1; });
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows: [result] } = await client.query(`
    SELECT current_database() = 'cphconsult_dev'
      AND current_user = 'cphconsult_dev_runtime'
      AND session_user = 'cphconsult_dev_runtime'
      AND has_schema_privilege(current_user, 'app', 'USAGE')
      AND NOT has_schema_privilege(current_user, 'app', 'CREATE')
      AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
      AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
      AND NOT has_table_privilege(current_user, 'app.schema_migrations', 'INSERT')
      AND NOT pg_has_role(current_user, 'cphconsult_dev_owner', 'MEMBER')
      AS valid
  `);
  await client.query('COMMIT');
  if (result?.valid !== true) throw new Error('permissions');
  database = createDatabase(connectionString);
  if (!await database.probe()) throw new Error('role');
  console.log('local_database_preflight_passed');
  console.log('Database: cphconsult_dev; account: cphconsult_dev_runtime; no data was modified.');
} catch {
  console.error('local_database_preflight_failed: check local server, password and foundation role setup.');
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
  await database?.close().catch(() => {});
}
