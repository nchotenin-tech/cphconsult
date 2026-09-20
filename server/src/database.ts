import pg from 'pg';
import { PostgresAuthStore } from './auth-store.js';
import { createConsultRouter } from './consults.js';

// This checks connectivity and obvious excessive privilege, not complete RLS safety.
export function createDatabase(databaseUrl: string | undefined) {
  const pool = databaseUrl ? new pg.Pool({
    connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000, statement_timeout: 2000, query_timeout: 2500,
    application_name: 'cphconsult-api',
  }) : undefined;
  pool?.on('error', () => { console.error('database_connection_error'); });
  return {
    authStore: pool ? new PostgresAuthStore(pool) : undefined,
    consultRouter: pool ? createConsultRouter(pool, new PostgresAuthStore(pool)) : undefined,
    async probe(): Promise<boolean> {
      if (!pool) return false;
      const result = await pool.query<{ permitted: boolean }>(`
        SELECT NOT EXISTS (
          SELECT 1 FROM pg_roles r
          WHERE pg_has_role(current_user, r.oid, 'MEMBER')
            AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb)
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('public', 'app') AND c.relkind IN ('r', 'p')
            AND pg_has_role(current_user, c.relowner, 'MEMBER')
        ) AS permitted
      `);
      return result.rows[0]?.permitted === true;
    },
    async close() { await pool?.end(); },
  };
}
