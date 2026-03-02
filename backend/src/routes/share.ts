import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { generateId } from '../lib/id.js';
import { fetchAndUpdateLinkPreview } from '../services/link-preview.js';

const share = new Hono<AppEnv>();

share.get('/', async (c) => {
  const userId = c.var.userId;
  const title = c.req.query('title') || c.req.query('text') || 'Shared item';
  const url = c.req.query('url') || null;

  const id = generateId('task');
  await c.env.DB.prepare(
    'INSERT INTO tasks (id, user_id, title, url, status) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, userId, title, url, 'inbox')
    .run();

  if (url) {
    c.executionCtx.waitUntil(fetchAndUpdateLinkPreview(c.env.DB, id, url));
  }

  return c.redirect(c.env.FRONTEND_URL);
});

export { share };
