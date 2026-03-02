import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './bindings.js';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

export default app;
