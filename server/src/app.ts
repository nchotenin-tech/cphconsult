import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

export type DatabaseProbe = () => Promise<boolean>;

export function createApp(probe: DatabaseProbe) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/health/live', (_req, res) => { res.json({ status: 'alive' }); });
  app.get('/health/database', async (_req, res) => {
    try {
      const ready = await probe();
      res.status(ready ? 200 : 503).json({ status: ready ? 'available' : 'unavailable' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  // The platform is not application-ready until auth, schema and policies exist.
  app.get('/health/ready', (_req, res) => {
    res.status(503).json({ status: 'not_ready', reason: 'application_not_implemented' });
  });
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND' } }); });
  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  };
  app.use(errorHandler);
  return app;
}
