import { Router, json } from 'express';
import type { Request, Response } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import type { AuthStore, AuthUser } from './auth-store.js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest();
export const csrfFor = (token: string) => createHmac('sha256', token).update('cphconsult-csrf-v1').digest('base64url');
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
const cookieName = 'cph_session';
function tokenFrom(req: Request) {
  const matches = (req.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(cookieName + '='));
  if (matches.length !== 1) return undefined;
  const token = matches[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
const publicUser = (user: AuthUser) => ({ id: user.id, login: user.login, mustChangePassword: user.must_change_password });

export async function createAuthRouter(store: AuthStore, origin: string) {
  const router = Router();
  const secure = new URL(origin).protocol === 'https:';
  const cookie = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  // Local/single-process guard. Shared rate limiting is required before scaling.
  const attempts = new Map<string, { count: number; until: number }>();
  let inFlight = 0;
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin !== origin) {
      res.status(403).json({ error: { code: 'ORIGIN_REJECTED' } }); return;
    }
    next();
  });
  router.use(json({ limit: '8kb' }));
  router.post('/login', async (req, res) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const ip = req.ip ?? 'unknown';
    const entry = attempts.get(ip) ?? { count: 0, until: now + 60000 };
    if (entry.count >= 10 || inFlight >= 2 || (!attempts.has(ip) && attempts.size >= 1000)) {
      res.setHeader('Retry-After', '60'); res.status(429).json({ error: { code: 'RATE_LIMITED' } }); return;
    }
    entry.count++; attempts.set(ip, entry);
    const { login, password } = req.body ?? {};
    if (typeof login !== 'string' || login.trim().length < 1 || login.length > 254
      || typeof password !== 'string' || password.length < 1 || Buffer.byteLength(password) > 1024) {
      res.status(422).json({ error: { code: 'INVALID_INPUT' } }); return;
    }
    inFlight++;
    try {
      const user = await store.lookup(login.trim().toLowerCase());
      const valid = await argon2.verify(user?.password_hash ?? dummyHash, password);
      if (!valid || !user) { res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } }); return; }
      const token = randomBytes(32).toString('base64url');
      const csrfToken = csrfFor(token);
      const previous = tokenFrom(req);
      if (!await store.start(user.id, user.password_hash, hashToken(token), hashToken(csrfToken), previous ? hashToken(previous) : null)) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } }); return;
      }
      res.cookie(cookieName, token, { ...cookie, maxAge: 8 * 60 * 60 * 1000 });
      res.json({ user: publicUser(user), csrfToken });
    } finally { inFlight--; }
  });
  const session = async (req: Request, res: Response) => {
    const token = tokenFrom(req);
    const user = token ? await store.resolve(hashToken(token)) : undefined;
    if (!token || !user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }); return undefined; }
    return { token, user };
  };
  router.get('/me', async (req, res) => {
    const current = await session(req, res); if (!current) return;
    res.json({ user: publicUser(current.user), csrfToken: csrfFor(current.token) });
  });
  router.post('/logout', async (req, res) => {
    const current = await session(req, res); if (!current) return;
    const supplied = req.headers['x-csrf-token'];
    if (typeof supplied !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(supplied)
      || current.user.csrf_token_hash.length !== 32
      || !timingSafeEqual(hashToken(supplied), current.user.csrf_token_hash)) {
      res.status(403).json({ error: { code: 'CSRF_REJECTED' } }); return;
    }
    await store.revoke(hashToken(current.token));
    res.clearCookie(cookieName, cookie); res.status(204).end();
  });
  return router;
}
