import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './bindings.js';
import { auth } from './routes/auth.js';
import { tasks } from './routes/tasks.js';
import { tags } from './routes/tags.js';
import { attachments } from './routes/attachments.js';
import { requireAuth } from './middleware/auth.js';

const app = new Hono<AppEnv>();

app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));
app.route('/api/v1/auth', auth);

app.use('/api/v1/tasks/*', requireAuth);
app.use('/api/v1/tasks', requireAuth);
app.route('/api/v1/tasks', tasks);

app.use('/api/v1/tasks/:taskId/attachments/*', requireAuth);
app.use('/api/v1/tasks/:taskId/attachments', requireAuth);
app.route('/api/v1/tasks/:taskId/attachments', attachments);

app.use('/api/v1/tags/*', requireAuth);
app.use('/api/v1/tags', requireAuth);
app.route('/api/v1/tags', tags);

export default app;
