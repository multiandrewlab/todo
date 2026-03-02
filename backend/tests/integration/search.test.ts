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
INSERT OR IGNORE INTO users (id, email) VALUES ('user_001', 'test-user@example.com');
INSERT OR IGNORE INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["test-user@example.com","test-alt@example.com","test-other@example.com"]');
`;

async function getAuthCookie(): Promise<string> {
  const token = await createToken(
    { sub: 'user_001', email: 'test-user@example.com' },
    'dev-secret-change-in-prod'
  );
  return `token=${token}`;
}

describe('FTS5 Search', () => {
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

    // Create test tasks for search
    const cookie = await getAuthCookie();
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Buy groceries', status: 'inbox' }),
    });
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Call dentist', status: 'inbox' }),
    });
    await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Prepare presentation',
        notes: 'Important meeting with stakeholders',
        status: 'inbox',
      }),
    });
  });

  it('search by title matches correct tasks', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks?search=groceries', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string }> };
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].title).toBe('Buy groceries');
  });

  it('search in notes matches tasks', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tasks?search=meeting', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string; notes: string }> };
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].title).toBe('Prepare presentation');
  });

  it('search excludes archived tasks by default', async () => {
    const cookie = await getAuthCookie();

    // Create and archive a task with a unique keyword
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Archived xylophone task', status: 'inbox' }),
    });
    const created = (await createRes.json()) as { id: string };
    await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}/archive`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    const res = await SELF.fetch('http://localhost/api/v1/tasks?search=xylophone', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string }> };
    expect(data.tasks.length).toBe(0);
  });

  it('search includes archived tasks when include_archived=true', async () => {
    const cookie = await getAuthCookie();

    // Create and archive a task with a unique keyword
    const createRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Archived zeppelin task', status: 'inbox' }),
    });
    const created = (await createRes.json()) as { id: string };
    await SELF.fetch(`http://localhost/api/v1/tasks/${created.id}/archive`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    // Without include_archived, should not find it
    const resWithout = await SELF.fetch('http://localhost/api/v1/tasks?search=zeppelin', {
      headers: { Cookie: cookie },
    });
    const dataWithout = (await resWithout.json()) as { tasks: Array<{ title: string }> };
    expect(dataWithout.tasks.length).toBe(0);

    // With include_archived, should find it
    const res = await SELF.fetch(
      'http://localhost/api/v1/tasks?search=zeppelin&include_archived=true',
      { headers: { Cookie: cookie } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: Array<{ title: string; status: string }> };
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].status).toBe('archived');
  });
});
