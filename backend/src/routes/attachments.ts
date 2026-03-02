import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { generateId } from '../lib/id.js';

const attachments = new Hono<AppEnv>();

// POST / — upload file
attachments.post('/', async (c) => {
  const userId = c.var.userId;
  const taskId = c.req.param('taskId');

  // Verify task exists and belongs to user
  const task = await c.env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?')
    .bind(taskId, userId).first();
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB safety limit
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: `File too large. Maximum size is 100MB.` }, 413);
  }

  const attachmentId = generateId('att');
  const r2Key = `${userId}/${taskId}/${attachmentId}/${file.name}`;

  await c.env.BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await c.env.DB.prepare(
    'INSERT INTO attachments (id, user_id, task_id, file_name, r2_key, content_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(attachmentId, userId, taskId, file.name, r2Key, file.type, file.size).run();

  return c.json({
    id: attachmentId,
    user_id: userId,
    task_id: taskId,
    file_name: file.name,
    r2_key: r2Key,
    content_type: file.type,
    file_size: file.size,
  }, 201);
});

// GET /:attachmentId/download — download file
attachments.get('/:attachmentId/download', async (c) => {
  const userId = c.var.userId;
  const attachmentId = c.req.param('attachmentId');

  const attachment = await c.env.DB.prepare(
    'SELECT * FROM attachments WHERE id = ? AND user_id = ?'
  ).bind(attachmentId, userId).first();

  if (!attachment) return c.json({ error: 'Attachment not found' }, 404);

  const object = await c.env.BUCKET.get(attachment.r2_key as string);
  if (!object) return c.json({ error: 'File not found in storage' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', (attachment.content_type as string) || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${attachment.file_name}"`);

  return new Response(object.body, { headers });
});

// DELETE /:attachmentId — delete attachment
attachments.delete('/:attachmentId', async (c) => {
  const userId = c.var.userId;
  const attachmentId = c.req.param('attachmentId');

  const attachment = await c.env.DB.prepare(
    'SELECT * FROM attachments WHERE id = ? AND user_id = ?'
  ).bind(attachmentId, userId).first();

  if (!attachment) return c.json({ error: 'Attachment not found' }, 404);

  await c.env.BUCKET.delete(attachment.r2_key as string);
  await c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(attachmentId).run();

  return c.json({ ok: true });
});

export { attachments };
