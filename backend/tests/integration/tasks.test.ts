import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { createToken } from '../../src/lib/jwt.js';

const SCHEMA_SQL = `
-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, setting_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    url TEXT,
    url_title TEXT,
    url_favicon TEXT,
    due_date TEXT,
    recurrence_rule TEXT,
    status TEXT DEFAULT 'inbox',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Task-tag join table
CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    r2_key TEXT UNIQUE NOT NULL,
    content_type TEXT,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title, notes, content='tasks', content_rowid='rowid'
);
`;

const TRIGGERS_SQL = [
  `CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (NEW.rowid, NEW.title, NEW.notes);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
  END;`,
  `CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (NEW.rowid, NEW.title, NEW.notes);
  END;`,
];

const INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);`,
];

const SEED_SQL = `
INSERT OR IGNORE INTO users (id, email) VALUES ('user_001', 'andrew.hunt@fundamentalmedia.com');
INSERT OR IGNORE INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["andrew.hunt@fundamentalmedia.com","andy@mrhunt.co.uk","ahunt83@gmail.com"]');
`;

async function getAuthCookie(): Promise<string> {
  const token = await createToken(
    { sub: 'user_001', email: 'andrew.hunt@fundamentalmedia.com' },
    'dev-secret-change-in-prod'
  );
  return `token=${token}`;
}

describe('Task CRUD', () => {
  beforeAll(async () => {
    const db = env.DB;

    // Apply schema - run each statement separately
    const schemaStatements = SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of schemaStatements) {
      await db.prepare(stmt).run();
    }

    // Apply FTS
    await db.prepare(FTS_SQL.trim()).run();

    // Apply triggers
    for (const trigger of TRIGGERS_SQL) {
      await db.prepare(trigger).run();
    }

    // Apply indexes
    for (const idx of INDEXES_SQL) {
      await db.prepare(idx).run();
    }

    // Apply seed data
    const seedStatements = SEED_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of seedStatements) {
      await db.prepare(stmt).run();
    }

    // Create a test tag
    await db
      .prepare("INSERT OR IGNORE INTO tags (id, user_id, name) VALUES ('tag_001', 'user_001', 'urgent')")
      .run();
  });

  it('returns 401 without auth cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/tasks creates a task', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Buy groceries', status: 'inbox' }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string; title: string; status: string };
    expect(data.title).toBe('Buy groceries');
    expect(data.id).toMatch(/^task_/);
    expect(data.status).toBe('inbox');
  });

  it('GET /api/v1/tasks lists tasks', async () => {
    const cookie = await getAuthCookie();

    // Create a task to ensure there's at least one
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Task for listing', status: 'inbox' }),
    });

    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ id: string }> };
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.tasks.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/tasks?status=inbox filters by status', async () => {
    const cookie = await getAuthCookie();

    // Create an inbox task to ensure there's at least one
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Inbox task for filter', status: 'inbox' }),
    });

    const res = await SELF.fetch('http://localhost/api/v1/tasks?status=inbox', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ status: string }> };
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.tasks.every((t) => t.status === 'inbox')).toBe(true);
  });

  it('GET /api/v1/tasks/:id returns task with tags and attachments', async () => {
    const cookie = await getAuthCookie();

    // Create a task with tags
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Tagged task', tag_ids: ['tag_001'] }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      id: string;
      title: string;
      tags: Array<{ id: string; name: string }>;
      attachments: unknown[];
    };
    expect(data.id).toBe(created.id);
    expect(data.title).toBe('Tagged task');
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags.length).toBe(1);
    expect(data.tags[0].name).toBe('urgent');
    expect(Array.isArray(data.attachments)).toBe(true);
  });

  it('returns 404 for non-existent task', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks/nonexistent', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it('PUT /api/v1/tasks/:id updates a task', async () => {
    const cookie = await getAuthCookie();

    // Create a task
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Original title' }),
    });
    const created = (await createRes.json()) as { id: string };

    // Update it
    const updateRes = await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Updated title', notes: 'Some notes' }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { title: string; notes: string };
    expect(updated.title).toBe('Updated title');
    expect(updated.notes).toBe('Some notes');
  });

  it('PUT /api/v1/tasks/:id returns 404 for non-existent task', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Nope' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/tasks/:id/archive archives a task', async () => {
    const cookie = await getAuthCookie();

    // Create a task
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Task to archive' }),
    });
    const created = (await createRes.json()) as { id: string };

    // Archive it
    const archiveRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${created.id}/archive`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
      }
    );
    expect(archiveRes.status).toBe(200);
    const data = (await archiveRes.json()) as {
      archived: { id: string; status: string; archived_at: string };
    };
    expect(data.archived.status).toBe('archived');
    expect(data.archived.archived_at).toBeTruthy();
  });

  it('POST /api/v1/tasks/:id/archive creates next recurring task', async () => {
    const cookie = await getAuthCookie();

    // Create a recurring task
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Weekly standup',
        due_date: '2026-03-02',
        recurrence_rule: { frequency: 'weekly', interval: 1 },
        tag_ids: ['tag_001'],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    // Archive it
    const archiveRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${created.id}/archive`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
      }
    );
    expect(archiveRes.status).toBe(200);
    const data = (await archiveRes.json()) as {
      archived: { id: string; status: string };
      next: { id: string; title: string; due_date: string; status: string; recurrence_rule: string };
    };
    expect(data.archived.status).toBe('archived');
    expect(data.next).toBeTruthy();
    expect(data.next.title).toBe('Weekly standup');
    expect(data.next.status).toBe('inbox');
    expect(data.next.due_date).toBe('2026-03-09'); // one week later
    expect(data.next.recurrence_rule).toBeTruthy();

    // Verify the new task has the tag copied
    const newTaskRes = await SELF.fetch(`http://localhost/api/v1/tasks/${data.next.id}`, {
      headers: { Cookie: cookie },
    });
    const newTask = (await newTaskRes.json()) as { tags: Array<{ id: string }> };
    expect(newTask.tags.length).toBe(1);
    expect(newTask.tags[0].id).toBe('tag_001');
  });

  it('POST /api/v1/tasks/:id/archive returns 404 for non-existent task', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks/nonexistent/archive', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/tasks excludes archived by default', async () => {
    const cookie = await getAuthCookie();

    // Create a task and archive it
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Will be archived for exclude test' }),
    });
    const created = (await createRes.json()) as { id: string };
    await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}/archive`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    // Also create a non-archived task
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Not archived' }),
    });

    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ status: string }> };
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.tasks.every((t) => t.status !== 'archived')).toBe(true);
  });

  it('GET /api/v1/tasks?include_archived=true includes archived', async () => {
    const cookie = await getAuthCookie();

    // Create a task and archive it
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Will be archived for include test' }),
    });
    const created = (await createRes.json()) as { id: string };
    await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}/archive`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    const res = await SELF.fetch('http://localhost/api/v1/tasks?include_archived=true', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ status: string }> };
    const hasArchived = data.tasks.some((t) => t.status === 'archived');
    expect(hasArchived).toBe(true);
  });
});
