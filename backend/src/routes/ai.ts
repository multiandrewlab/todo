import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { parseNaturalLanguage } from '../services/nl-parser.js';

const ai = new Hono<AppEnv>();

ai.post('/parse', async (c) => {
  const body = await c.req.json<{ text: string }>();
  if (!body.text?.trim()) {
    return c.json({ error: 'Text is required' }, 400);
  }

  try {
    const result = await parseNaturalLanguage(body.text, c.env.AI);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: 'Failed to parse text', details: e.message }, 500);
  }
});

export { ai };
