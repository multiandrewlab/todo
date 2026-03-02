import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Env } from '../bindings.js';
import { verifyToken } from '../lib/jwt.js';

type AuthEnv = {
  Bindings: Env;
  Variables: { userId: string; userEmail: string };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
