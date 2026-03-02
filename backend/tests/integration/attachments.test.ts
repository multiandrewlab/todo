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

const TEST_TASK_ID = 'task_attach_test';

async function getAuthCookie(): Promise<string> {
  const token = await createToken(
    { sub: 'user_001', email: 'andrew.hunt@fundamentalmedia.com' },
    'dev-secret-change-in-prod'
  );
  return `token=${token}`;
}

describe('Attachment CRUD', () => {
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

    // Create a test task for attachment tests
    await db
      .prepare(
        "INSERT OR IGNORE INTO tasks (id, user_id, title, status) VALUES (?, 'user_001', 'Task for attachments', 'inbox')"
      )
      .bind(TEST_TASK_ID)
      .run();
  });

  it('POST upload — creates attachment, returns 201 with metadata', async () => {
    const cookie = await getAuthCookie();
    const formData = new FormData();
    formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));

    const res = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: formData,
      }
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      id: string;
      user_id: string;
      task_id: string;
      file_name: string;
      r2_key: string;
      content_type: string;
      file_size: number;
    };
    expect(data.id).toMatch(/^att_/);
    expect(data.user_id).toBe('user_001');
    expect(data.task_id).toBe(TEST_TASK_ID);
    expect(data.file_name).toBe('test.txt');
    expect(data.content_type).toBe('text/plain');
    expect(data.file_size).toBe(12); // 'test content'.length
    expect(data.r2_key).toContain('user_001');
    expect(data.r2_key).toContain(TEST_TASK_ID);
  });

  it('GET download — returns file body with correct headers', async () => {
    const cookie = await getAuthCookie();

    // First upload a file
    const formData = new FormData();
    formData.append('file', new File(['download me'], 'download.txt', { type: 'text/plain' }));

    const uploadRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: formData,
      }
    );
    expect(uploadRes.status).toBe(201);
    const uploadData = (await uploadRes.json()) as { id: string };

    // Now download it
    const downloadRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments/${uploadData.id}/download`,
      {
        headers: { Cookie: cookie },
      }
    );

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('Content-Type')).toBe('text/plain');
    expect(downloadRes.headers.get('Content-Disposition')).toBe(
      'attachment; filename="download.txt"'
    );
    const body = await downloadRes.text();
    expect(body).toBe('download me');
  });

  it('DELETE — removes from R2 and D1', async () => {
    const cookie = await getAuthCookie();

    // Upload a file first
    const formData = new FormData();
    formData.append('file', new File(['delete me'], 'delete.txt', { type: 'text/plain' }));

    const uploadRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: formData,
      }
    );
    expect(uploadRes.status).toBe(201);
    const uploadData = (await uploadRes.json()) as { id: string };

    // Delete it
    const deleteRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments/${uploadData.id}`,
      {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }
    );

    expect(deleteRes.status).toBe(200);
    const deleteData = (await deleteRes.json()) as { ok: boolean };
    expect(deleteData.ok).toBe(true);

    // Verify download returns 404 now
    const downloadRes = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments/${uploadData.id}/download`,
      {
        headers: { Cookie: cookie },
      }
    );
    expect(downloadRes.status).toBe(404);
  });

  it('POST upload for non-existent task — returns 404', async () => {
    const cookie = await getAuthCookie();
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.txt', { type: 'text/plain' }));

    const res = await SELF.fetch(
      'http://localhost/api/v1/tasks/nonexistent_task/attachments',
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: formData,
      }
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Task not found');
  });

  it('POST upload without file — returns 400', async () => {
    const cookie = await getAuthCookie();
    const formData = new FormData();
    // No file appended

    const res = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments`,
      {
        method: 'POST',
        headers: { Cookie: cookie },
        body: formData,
      }
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('No file provided');
  });

  it('GET download for non-existent attachment — returns 404', async () => {
    const cookie = await getAuthCookie();

    const res = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments/att_nonexistent/download`,
      {
        headers: { Cookie: cookie },
      }
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Attachment not found');
  });

  it('DELETE for non-existent attachment — returns 404', async () => {
    const cookie = await getAuthCookie();

    const res = await SELF.fetch(
      `http://localhost/api/v1/tasks/${TEST_TASK_ID}/attachments/att_nonexistent`,
      {
        method: 'DELETE',
        headers: { Cookie: cookie },
      }
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Attachment not found');
  });
});
