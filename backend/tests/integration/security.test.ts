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
INSERT OR IGNORE INTO users (id, email) VALUES ('user_001', 'alice@example.com');
INSERT OR IGNORE INTO users (id, email) VALUES ('user_002', 'bob@example.com');
INSERT OR IGNORE INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["alice@example.com"]');
INSERT OR IGNORE INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_002', 'email_allowlist', '["bob@example.com"]');
`;

async function getCookie(userId: string, email: string): Promise<string> {
  const token = await createToken(
    { sub: userId, email },
    'dev-secret-change-in-prod'
  );
  return `token=${token}`;
}

// File-level schema setup — shared across all describe blocks
beforeAll(async () => {
  const db = env.DB;

  const schemaStatements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of schemaStatements) {
    await db.prepare(stmt).run();
  }

  await db.prepare(FTS_SQL.trim()).run();

  for (const trigger of TRIGGERS_SQL) {
    await db.prepare(trigger).run();
  }

  for (const idx of INDEXES_SQL) {
    await db.prepare(idx).run();
  }

  const seedStatements = SEED_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of seedStatements) {
    await db.prepare(stmt).run();
  }
});

describe('Multi-user isolation', () => {
  let aliceCookie: string;
  let bobCookie: string;
  let aliceTaskId: string;
  let aliceTagId: string;

  beforeAll(async () => {
    aliceCookie = await getCookie('user_001', 'alice@example.com');
    bobCookie = await getCookie('user_002', 'bob@example.com');

    // Create a tag for Alice
    const aliceTagRes = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ name: 'alice-tag' }),
    });
    aliceTagId = ((await aliceTagRes.json()) as { id: string }).id;

    // Create a tag for Bob
    await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ name: 'bob-tag' }),
    });

    // Create a task for Alice
    const aliceTaskRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ title: 'Alice private task', tag_ids: [aliceTagId] }),
    });
    aliceTaskId = ((await aliceTaskRes.json()) as { id: string }).id;
  });

  it('Bob cannot see Alice tasks in list', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: bobCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ id: string }> };
    const found = data.tasks.find((t) => t.id === aliceTaskId);
    expect(found).toBeUndefined();
  });

  it('Bob cannot get Alice task by ID', async () => {
    const res = await SELF.fetch(`http://localhost/api/v1/tasks/${aliceTaskId}`, {
      headers: { Cookie: bobCookie },
    });
    expect(res.status).toBe(404);
  });

  it('Bob cannot update Alice task', async () => {
    const res = await SELF.fetch(`http://localhost/api/v1/tasks/${aliceTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ title: 'Hacked by Bob' }),
    });
    expect(res.status).toBe(404);
  });

  it('Bob cannot archive Alice task', async () => {
    const res = await SELF.fetch(`http://localhost/api/v1/tasks/${aliceTaskId}/archive`, {
      method: 'POST',
      headers: { Cookie: bobCookie },
    });
    expect(res.status).toBe(404);
  });

  it('Bob cannot see Alice tags', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tags', {
      headers: { Cookie: bobCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tags: Array<{ id: string; name: string }> };
    const found = data.tags.find((t) => t.id === aliceTagId);
    expect(found).toBeUndefined();
  });

  it('Bob cannot update Alice tag', async () => {
    const res = await SELF.fetch(`http://localhost/api/v1/tags/${aliceTagId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ name: 'hacked-tag' }),
    });
    expect(res.status).toBe(404);
  });

  it('Bob cannot create task with Alice tag IDs', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ title: 'Bob task with stolen tag', tag_ids: [aliceTagId] }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Invalid tag IDs');
  });

  it('Bob cannot update task to use Alice tag IDs', async () => {
    // Create a task for Bob first
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ title: 'Bob task' }),
    });
    const bobTask = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/api/v1/tasks/${bobTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ tag_ids: [aliceTagId] }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Invalid tag IDs');
  });

  it('Bob cannot see Alice settings', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/settings', {
      headers: { Cookie: bobCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      settings: Array<{ setting_name: string; setting_value: string }>;
    };
    const aliceAllowlist = data.settings.find(
      (s) => s.setting_value.includes('alice@example.com')
    );
    expect(aliceAllowlist).toBeUndefined();
  });
});

describe('Input validation edge cases', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await getCookie('user_001', 'alice@example.com');
  });

  it('POST /api/v1/tasks with empty title returns 400', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Title is required');
  });

  it('POST /api/v1/tasks with whitespace-only title returns 400', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/tasks with nonexistent tag IDs returns 400', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Test', tag_ids: ['tag_nonexistent'] }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Invalid tag IDs');
  });

  it('search with FTS5 special characters does not error', async () => {
    const res = await SELF.fetch(
      'http://localhost/api/v1/tasks?search=' + encodeURIComponent('test AND "quoted" OR *wildcard'),
      { headers: { Cookie: cookie } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: unknown[] };
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it('search with only special characters returns empty', async () => {
    const res = await SELF.fetch(
      'http://localhost/api/v1/tasks?search=' + encodeURIComponent('"" * - !'),
      { headers: { Cookie: cookie } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: unknown[] };
    expect(data.tasks.length).toBe(0);
  });
});

describe('Date filters and pagination', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await getCookie('user_001', 'alice@example.com');

    // Create tasks with different due dates
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Past task', due_date: '2026-01-01' }),
    });
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Future task', due_date: '2026-12-31' }),
    });
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Mid task', due_date: '2026-06-15' }),
    });
  });

  it('due_before filters tasks', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks?due_before=2026-03-01', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string; due_date: string | null }> };
    for (const task of data.tasks) {
      if (task.due_date) {
        expect(task.due_date <= '2026-03-01').toBe(true);
      }
    }
  });

  it('due_after filters tasks', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks?due_after=2026-10-01', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string; due_date: string }> };
    expect(data.tasks.length).toBeGreaterThan(0);
    for (const task of data.tasks) {
      expect(task.due_date >= '2026-10-01').toBe(true);
    }
  });

  it('limit restricts number of results', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tasks?limit=1', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: unknown[] };
    expect(data.tasks.length).toBe(1);
  });

  it('offset skips results', async () => {
    const allRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    const allData = (await allRes.json()) as { tasks: Array<{ id: string }> };

    const offsetRes = await SELF.fetch('http://localhost/api/v1/tasks?offset=1&limit=1', {
      headers: { Cookie: cookie },
    });
    const offsetData = (await offsetRes.json()) as { tasks: Array<{ id: string }> };

    expect(offsetData.tasks.length).toBe(1);
    if (allData.tasks.length > 1) {
      expect(offsetData.tasks[0].id).toBe(allData.tasks[1].id);
    }
  });
});

describe('Tag update on tasks', () => {
  let cookie: string;
  let tagAId: string;
  let tagBId: string;

  beforeAll(async () => {
    cookie = await getCookie('user_001', 'alice@example.com');

    const tagARes = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'tag-update-a' }),
    });
    tagAId = ((await tagARes.json()) as { id: string }).id;

    const tagBRes = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'tag-update-b' }),
    });
    tagBId = ((await tagBRes.json()) as { id: string }).id;
  });

  it('PUT updates tag associations on a task', async () => {
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Tag swap test', tag_ids: [tagAId] }),
    });
    const task = (await createRes.json()) as { id: string };

    // Verify tag A is assigned
    const getRes1 = await SELF.fetch(`http://localhost/api/v1/tasks/${task.id}`, {
      headers: { Cookie: cookie },
    });
    const taskData1 = (await getRes1.json()) as { tags: Array<{ id: string }> };
    expect(taskData1.tags.length).toBe(1);
    expect(taskData1.tags[0].id).toBe(tagAId);

    // Update to tag B
    await SELF.fetch(`http://localhost/api/v1/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ tag_ids: [tagBId] }),
    });

    // Verify tag B replaced tag A
    const getRes2 = await SELF.fetch(`http://localhost/api/v1/tasks/${task.id}`, {
      headers: { Cookie: cookie },
    });
    const taskData2 = (await getRes2.json()) as { tags: Array<{ id: string }> };
    expect(taskData2.tags.length).toBe(1);
    expect(taskData2.tags[0].id).toBe(tagBId);
  });

  it('PUT with empty tag_ids removes all tags', async () => {
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Tag removal test', tag_ids: [tagAId] }),
    });
    const task = (await createRes.json()) as { id: string };

    // Remove all tags
    await SELF.fetch(`http://localhost/api/v1/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ tag_ids: [] }),
    });

    const getRes = await SELF.fetch(`http://localhost/api/v1/tasks/${task.id}`, {
      headers: { Cookie: cookie },
    });
    const taskData = (await getRes.json()) as { tags: Array<{ id: string }> };
    expect(taskData.tags.length).toBe(0);
  });
});
