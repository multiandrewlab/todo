import PostalMime from 'postal-mime';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const senderEmail = message.from;

    // Check sender against all users' email_allowlist settings
    const allowedSenders = await env.DB.prepare(
      "SELECT user_id, setting_value FROM user_settings WHERE setting_name = 'email_allowlist'"
    ).all();

    let matchedUserId: string | null = null;
    for (const row of allowedSenders.results) {
      try {
        const allowlist: string[] = JSON.parse(row.setting_value as string);
        if (allowlist.includes(senderEmail)) {
          matchedUserId = row.user_id as string;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedUserId) {
      // Silently drop unauthorized emails
      return;
    }

    // Parse email
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(rawEmail);

    // Create task
    const taskId = generateId('task');
    const title = parsed.subject || 'Email task';
    const notes = parsed.text || '';

    await env.DB.prepare(
      'INSERT INTO tasks (id, user_id, title, notes, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(taskId, matchedUserId, title, notes, 'inbox').run();

    // Save attachments to R2
    if (parsed.attachments?.length) {
      for (const att of parsed.attachments) {
        const attId = generateId('att');
        const fileName = att.filename || 'attachment';
        const r2Key = `${matchedUserId}/${taskId}/${attId}/${fileName}`;

        await env.BUCKET.put(r2Key, att.content);
        await env.DB.prepare(
          'INSERT INTO attachments (id, user_id, task_id, file_name, r2_key, content_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(attId, matchedUserId, taskId, fileName, r2Key, att.mimeType || 'application/octet-stream', att.content.byteLength).run();
      }
    }
  },
};
