import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { parseNaturalLanguage } from '../services/nl-parser.js';
import { transcribeAudio } from '../services/transcribe.js';

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

ai.post('/transcribe', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('audio');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Audio file is required' }, 400);
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Audio file too large (max 10MB)' }, 400);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audio = new Uint8Array(arrayBuffer);
    const text = await transcribeAudio(audio, c.env.AI);

    if (!text) {
      return c.json({ error: 'No speech detected' }, 422);
    }

    return c.json({ text });
  } catch (e: any) {
    return c.json({ error: 'Transcription failed', details: e.message }, 500);
  }
});

export { ai };
