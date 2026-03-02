import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { generateId } from '../lib/id.js';

const tags = new Hono<AppEnv>();

// GET / — list all tags for the user
tags.get('/', async (c) => {
  const userId = c.var.userId;
  const result = await c.env.DB.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name')
    .bind(userId)
    .all();
  return c.json({ tags: result.results });
});

// POST / — create a new tag
tags.post('/', async (c) => {
  const userId = c.var.userId;
  const { name } = await c.req.json<{ name: string }>();

  if (!name?.trim()) {
    return c.json({ error: 'Tag name is required' }, 400);
  }

  const id = generateId('tag');
  try {
    await c.env.DB.prepare('INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)')
      .bind(id, userId, name.trim())
      .run();
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'Tag already exists' }, 409);
    }
    throw e;
  }

  return c.json({ id, user_id: userId, name: name.trim() }, 201);
});

// PUT /:id — update tag name
tags.put('/:id', async (c) => {
  const userId = c.var.userId;
  const tagId = c.req.param('id');
  const { name } = await c.req.json<{ name: string }>();

  if (!name?.trim()) {
    return c.json({ error: 'Tag name is required' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
    .bind(tagId, userId)
    .first();

  if (!existing) {
    return c.json({ error: 'Tag not found' }, 404);
  }

  try {
    await c.env.DB.prepare('UPDATE tags SET name = ? WHERE id = ? AND user_id = ?')
      .bind(name.trim(), tagId, userId)
      .run();
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'Tag name already exists' }, 409);
    }
    throw e;
  }

  return c.json({ ...existing, name: name.trim() });
});

export { tags };
