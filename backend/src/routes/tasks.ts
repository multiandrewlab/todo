import { Hono } from 'hono';
import type { AppEnv } from '../bindings.js';
import { generateId } from '../lib/id.js';
import { getNextOccurrence } from '@muscat/shared';
import type { CreateTaskRequest, UpdateTaskRequest, Task, Tag, Attachment } from '@muscat/shared';
import { fetchAndUpdateLinkPreview } from '../services/link-preview.js';

export const tasks = new Hono<AppEnv>();

// GET / — List tasks
tasks.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.var.userId;

  const status = c.req.query('status');
  const search = c.req.query('search');
  const includeArchived = c.req.query('include_archived') === 'true';
  const dueBefore = c.req.query('due_before');
  const dueAfter = c.req.query('due_after');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const conditions: string[] = ['t.user_id = ?'];
  const params: unknown[] = [userId];

  if (!includeArchived) {
    conditions.push("t.status != 'archived'");
  }

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (dueBefore) {
    conditions.push('t.due_date <= ?');
    params.push(dueBefore);
  }

  if (dueAfter) {
    conditions.push('t.due_date >= ?');
    params.push(dueAfter);
  }

  let query: string;
  if (search) {
    // Escape FTS5 special characters by wrapping each term in double quotes
    const sanitizedSearch = search
      .replace(/"/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(' ');
    query = `
      SELECT t.* FROM tasks t
      INNER JOIN tasks_fts ON tasks_fts.rowid = t.rowid
      WHERE ${conditions.join(' AND ')} AND tasks_fts MATCH ?
      ORDER BY rank, t.due_date ASC NULLS LAST, t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(sanitizedSearch, limit, offset);
  } else {
    query = `
      SELECT t.* FROM tasks t
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.due_date IS NULL, t.due_date ASC, t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
  }

  const result = await db.prepare(query).bind(...params).all<Task>();
  const taskList = result.results;

  // Fetch tags for all tasks
  if (taskList.length > 0) {
    const taskIds = taskList.map((t) => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const tagRows = await db
      .prepare(
        `SELECT tt.task_id, tg.id, tg.user_id, tg.name
         FROM task_tags tt
         JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.task_id IN (${placeholders})`
      )
      .bind(...taskIds)
      .all<{ task_id: string; id: string; user_id: string; name: string }>();

    const tagsByTask = new Map<string, Tag[]>();
    for (const row of tagRows.results) {
      const tags = tagsByTask.get(row.task_id) || [];
      tags.push({ id: row.id, user_id: row.user_id, name: row.name });
      tagsByTask.set(row.task_id, tags);
    }

    const tasksWithTags = taskList.map((t) => ({
      ...t,
      tags: tagsByTask.get(t.id) || [],
    }));

    return c.json({ tasks: tasksWithTags });
  }

  return c.json({ tasks: [] });
});

// POST / — Create task
tasks.post('/', async (c) => {
  const db = c.env.DB;
  const userId = c.var.userId;
  const body = await c.req.json<CreateTaskRequest>();

  if (!body.title?.trim()) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const id = generateId('task');
  const recurrenceRule = body.recurrence_rule
    ? JSON.stringify(body.recurrence_rule)
    : null;

  await db
    .prepare(
      `INSERT INTO tasks (id, user_id, title, notes, url, due_date, recurrence_rule, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      body.title,
      body.notes || null,
      body.url || null,
      body.due_date || null,
      recurrenceRule,
      body.status || 'inbox'
    )
    .run();

  // Handle tag associations
  if (body.tag_ids && body.tag_ids.length > 0) {
    // Verify all tags belong to the authenticated user
    const placeholders = body.tag_ids.map(() => '?').join(',');
    const ownedTags = await db
      .prepare(`SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ?`)
      .bind(...body.tag_ids, userId)
      .all<{ id: string }>();
    const ownedIds = new Set(ownedTags.results.map((t) => t.id));
    const invalidIds = body.tag_ids.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      return c.json({ error: 'Invalid tag IDs' }, 400);
    }
    const stmts = body.tag_ids.map((tagId) =>
      db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').bind(id, tagId)
    );
    await db.batch(stmts);
  }

  const url = body.url || null;
  if (url) {
    c.executionCtx.waitUntil(fetchAndUpdateLinkPreview(c.env.DB, id, url));
  }

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<Task>();
  return c.json(task, 201);
});

// GET /:id — Get single task
tasks.get('/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.var.userId;
  const taskId = c.req.param('id');

  const task = await db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .bind(taskId, userId)
    .first<Task>();

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Fetch tags
  const tagRows = await db
    .prepare(
      `SELECT tg.id, tg.user_id, tg.name
       FROM task_tags tt
       JOIN tags tg ON tg.id = tt.tag_id
       WHERE tt.task_id = ?`
    )
    .bind(taskId)
    .all<Tag>();

  // Fetch attachments
  const attachmentRows = await db
    .prepare('SELECT * FROM attachments WHERE task_id = ? AND user_id = ?')
    .bind(taskId, userId)
    .all<Attachment>();

  return c.json({
    ...task,
    tags: tagRows.results,
    attachments: attachmentRows.results,
  });
});

// PUT /:id — Update task
tasks.put('/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.var.userId;
  const taskId = c.req.param('id');
  const body = await c.req.json<UpdateTaskRequest>();

  // Verify ownership
  const existing = await db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .bind(taskId, userId)
    .first<Task>();

  if (!existing) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Build dynamic update
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) {
    fields.push('title = ?');
    values.push(body.title);
  }
  if (body.notes !== undefined) {
    fields.push('notes = ?');
    values.push(body.notes);
  }
  if (body.url !== undefined) {
    fields.push('url = ?');
    values.push(body.url);
  }
  if (body.due_date !== undefined) {
    fields.push('due_date = ?');
    values.push(body.due_date);
  }
  if (body.recurrence_rule !== undefined) {
    fields.push('recurrence_rule = ?');
    values.push(body.recurrence_rule ? JSON.stringify(body.recurrence_rule) : null);
  }
  if (body.status !== undefined) {
    fields.push('status = ?');
    values.push(body.status);
  }

  if (fields.length > 0) {
    values.push(taskId, userId);
    await db
      .prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...values)
      .run();
  }

  // Handle tag updates
  if (body.tag_ids !== undefined) {
    if (body.tag_ids.length > 0) {
      // Verify all tags belong to the authenticated user
      const placeholders = body.tag_ids.map(() => '?').join(',');
      const ownedTags = await db
        .prepare(`SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ?`)
        .bind(...body.tag_ids, userId)
        .all<{ id: string }>();
      const ownedIds = new Set(ownedTags.results.map((t) => t.id));
      const invalidIds = body.tag_ids.filter((id) => !ownedIds.has(id));
      if (invalidIds.length > 0) {
        return c.json({ error: 'Invalid tag IDs' }, 400);
      }
    }
    await db.prepare('DELETE FROM task_tags WHERE task_id = ?').bind(taskId).run();
    if (body.tag_ids.length > 0) {
      const stmts = body.tag_ids.map((tagId) =>
        db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').bind(taskId, tagId)
      );
      await db.batch(stmts);
    }
  }

  if (body.url !== undefined && body.url) {
    c.executionCtx.waitUntil(fetchAndUpdateLinkPreview(c.env.DB, taskId, body.url));
  }

  const updated = await db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(taskId)
    .first<Task>();

  return c.json(updated);
});

// POST /:id/archive — Archive task
tasks.post('/:id/archive', async (c) => {
  const db = c.env.DB;
  const userId = c.var.userId;
  const taskId = c.req.param('id');

  const task = await db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .bind(taskId, userId)
    .first<Task>();

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Archive the task
  await db
    .prepare("UPDATE tasks SET status = 'archived', archived_at = datetime('now') WHERE id = ?")
    .bind(taskId)
    .run();

  const archivedTask = await db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(taskId)
    .first<Task>();

  let newTask: Task | null = null;

  // If recurring, create next occurrence
  if (task.recurrence_rule && task.due_date) {
    let rule;
    try {
      rule = JSON.parse(task.recurrence_rule);
    } catch {
      return c.json({ archived: archivedTask });
    }
    const today = new Date().toISOString().split('T')[0];
    const nextDueDate = getNextOccurrence(task.due_date, rule, today);

    if (nextDueDate) {
      const newId = generateId('task');

      await db
        .prepare(
          `INSERT INTO tasks (id, user_id, title, notes, url, due_date, recurrence_rule, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'inbox')`
        )
        .bind(
          newId,
          userId,
          task.title,
          task.notes,
          task.url,
          nextDueDate,
          task.recurrence_rule
        )
        .run();

      // Copy tag associations
      const existingTags = await db
        .prepare('SELECT tag_id FROM task_tags WHERE task_id = ?')
        .bind(taskId)
        .all<{ tag_id: string }>();

      if (existingTags.results.length > 0) {
        const stmts = existingTags.results.map((row) =>
          db
            .prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)')
            .bind(newId, row.tag_id)
        );
        await db.batch(stmts);
      }

      newTask = await db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .bind(newId)
        .first<Task>();
    }
  }

  const response: { archived: Task | null; next?: Task | null } = { archived: archivedTask };
  if (newTask) {
    response.next = newTask;
  }

  return c.json(response);
});
