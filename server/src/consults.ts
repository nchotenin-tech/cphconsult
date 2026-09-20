import { Router } from 'express';
import type { Pool } from 'pg';
import type { AuthStore } from './auth-store.js';
import { hashToken, tokenFrom } from './auth.js';
import { withActorTransaction } from './actor-transaction.js';

export function createConsultRouter(pool: Pool, auth: AuthStore) {
  const router = Router();
  router.use(async (req, res, next) => {
    const token = tokenFrom(req);
    const user = token ? await auth.resolve(hashToken(token)) : undefined;
    if (!user) { res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }); return; }
    if (user.must_change_password) { res.status(403).json({ error: { code: 'PASSWORD_CHANGE_REQUIRED' } }); return; }
    res.locals.actorId = user.id;
    next();
  });
  router.get('/', async (req, res) => {
    const limitText = req.query.limit ?? '20';
    const after = req.query.after ?? '';
    if (typeof limitText !== 'string' || !/^\d{1,3}$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 100
      || typeof after !== 'string' || after.length > 200) {
      res.status(422).json({ error: { code: 'INVALID_PAGINATION' } }); return;
    }
    const limit = Number(limitText);
    const rows = await withActorTransaction(pool, res.locals.actorId, async client => {
      return (await client.query(`SELECT id, patient_name, patient_age, status, post_consult_option,
        refer_status, shared_care_status, created_at FROM app.consults
        WHERE id > $1 ORDER BY id LIMIT $2`, [after, limit + 1])).rows;
    });
    const more = rows.length > limit;
    const items = rows.slice(0, limit);
    res.json({ items, nextCursor: more ? items.at(-1).id : null });
  });
  router.get('/:id', async (req, res) => {
    if (req.params.id.length > 200) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return; }
    const item = await withActorTransaction(pool, res.locals.actorId, async client => {
      return (await client.query(`SELECT id, patient_name, patient_age, patient_gender, patient_scheme,
        consult_details, sender_id, target_hospital_id, target_specialties, target_dentist_ids,
        primary_consultant_id, status, post_consult_option, refer_status, shared_care_status, created_at
        FROM app.consults WHERE id = $1`, [req.params.id])).rows[0];
    });
    if (!item) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return; }
    res.json({ item });
  });
  return router;
}
