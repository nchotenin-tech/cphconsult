import type { Pool } from 'pg';

export interface AuthUser { id: string; login: string; must_change_password: boolean }
export interface AuthSession extends AuthUser { csrf_token_hash: Buffer }
export interface AuthStore {
  lookup(login: string): Promise<(AuthUser & { password_hash: string }) | undefined>;
  start(userId: string, expectedHash: string, tokenHash: Buffer, csrfHash: Buffer, oldHash: Buffer | null): Promise<boolean>;
  resolve(tokenHash: Buffer): Promise<AuthSession | undefined>;
  revoke(tokenHash: Buffer): Promise<void>;
}
export class PostgresAuthStore implements AuthStore {
  constructor(private pool: Pool) {}
  async lookup(login: string) {
    return (await this.pool.query('SELECT * FROM app.auth_lookup($1)', [login])).rows[0];
  }
  async start(id: string, expected: string, token: Buffer, csrf: Buffer, old: Buffer | null) {
    const result = await this.pool.query('SELECT app.auth_start_session($1,$2,$3,$4,$5) AS ok', [id, expected, token, csrf, old]);
    return result.rows[0]?.ok === true;
  }
  async resolve(hash: Buffer) {
    return (await this.pool.query('SELECT * FROM app.auth_resolve_session($1)', [hash])).rows[0];
  }
  async revoke(hash: Buffer) { await this.pool.query('SELECT app.auth_revoke_session($1)', [hash]); }
}
