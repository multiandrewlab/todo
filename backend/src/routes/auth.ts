import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../bindings.js';
import { createToken, verifyToken } from '../lib/jwt.js';

const auth = new Hono<{ Bindings: Env }>();

// Redirect to Google OAuth
auth.get('/login', (c) => {
  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// OAuth callback
auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'No code provided' }, 400);

  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/callback`;

  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return c.json({ error: 'Failed to exchange code' }, 400);
  }

  const tokenData = await tokenRes.json() as { access_token: string };

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return c.json({ error: 'Failed to fetch user info' }, 400);
  }

  const userInfo = await userRes.json() as { email: string };

  // Check user exists in DB
  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
    .bind(userInfo.email)
    .first();

  if (!user) {
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=unauthorized`);
  }

  // Create JWT and set cookie
  const token = await createToken(
    { sub: user.id as string, email: user.email as string },
    c.env.JWT_SECRET,
  );

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 86400,
  });

  return c.redirect(c.env.FRONTEND_URL);
});

// Logout
auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

// Current user
auth.get('/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    return c.json({ id: payload.sub, email: payload.email });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export { auth };
