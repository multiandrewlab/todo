import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';

const settings = new Hono<AppEnv>();

// GET / — list all settings for user
settings.get('/', async (c) => {
  const userId = c.var.userId;
  const result = await c.env.DB.prepare(
    'SELECT setting_name, setting_value, created_at FROM user_settings WHERE user_id = ?'
  )
    .bind(userId)
    .all();
  return c.json({ settings: result.results });
});

// PUT /:name — upsert a setting
settings.put('/:name', async (c) => {
  const userId = c.var.userId;
  const settingName = c.req.param('name');
  const { value } = await c.req.json<{ value: string }>();

  if (value === undefined || value === null) {
    return c.json({ error: 'Value is required' }, 400);
  }

  const settingValue = typeof value === 'string' ? value : JSON.stringify(value);

  await c.env.DB.prepare(
    'INSERT INTO user_settings (user_id, setting_name, setting_value) VALUES (?, ?, ?) ON CONFLICT(user_id, setting_name) DO UPDATE SET setting_value = excluded.setting_value'
  )
    .bind(userId, settingName, settingValue)
    .run();

  return c.json({ setting_name: settingName, setting_value: settingValue });
});

export { settings };
