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
    const status = req.query.status ?? 'all';
    const workflow = req.query.workflow ?? 'all';
    const progress = req.query.progress ?? 'all';
    const search = req.query.q ?? '';
    if (typeof search !== 'string' || search.length > 200 || search.includes('\u0000')) {
      res.status(422).json({ error: { code: 'INVALID_SEARCH' } }); return;
    }
    if (typeof workflow !== 'string' || !['all', 'refer', 'shared_care'].includes(workflow)
      || typeof progress !== 'string' || !['all', 'active', 'finished', 'cancelled'].includes(progress)
      || (workflow === 'all' && progress !== 'all')) {
      res.status(422).json({ error: { code: 'INVALID_WORKFLOW_FILTER' } }); return;
    }
    if (typeof status !== 'string' || !['all', 'pending', 'active', 'completed'].includes(status)) {
      res.status(422).json({ error: { code: 'INVALID_STATUS_FILTER' } }); return;
    }
    if (typeof limitText !== 'string' || !/^\d{1,3}$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 100
      || typeof after !== 'string' || after.length > 200) {
      res.status(422).json({ error: { code: 'INVALID_PAGINATION' } }); return;
    }
    const limit = Number(limitText);
    const rows = await withActorTransaction(pool, res.locals.actorId, async client => {
      return (await client.query(`SELECT id, patient_name, patient_age, status, post_consult_option,
        refer_status, shared_care_status, created_at FROM app.consults
        WHERE id > $1 AND ($3::text IS NULL OR status = $3)
          AND ($6::text = '' OR strpos(lower(patient_name), lower($6)) > 0 OR strpos(lower(id), lower($6)) > 0)
          AND ($4::text = 'all' OR post_consult_option = $4)
          AND ($5::text = 'all'
            OR ($5 = 'active' AND CASE WHEN post_consult_option = 'shared_care'
              THEN coalesce(shared_care_status, '') NOT IN ('completed','cancelled')
              ELSE coalesce(refer_status, '') NOT IN ('referred_back','cancelled') END)
            OR ($5 = 'finished' AND CASE WHEN post_consult_option = 'shared_care'
              THEN shared_care_status = 'completed' ELSE refer_status = 'referred_back' END)
            OR ($5 = 'cancelled' AND CASE WHEN post_consult_option = 'shared_care'
              THEN shared_care_status = 'cancelled' ELSE refer_status = 'cancelled' END))
        ORDER BY id LIMIT $2`, [after, limit + 1, status === 'all' ? null : status, workflow, progress, search.trim()])).rows;
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
