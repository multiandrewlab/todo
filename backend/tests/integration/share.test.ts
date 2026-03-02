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

describe('Share Target', () => {
  beforeAll(async () => {
    const db = env.DB;

    const schemaStatements = SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of schemaStatements) {
      await db.prepare(stmt).run();
    }

    const seedStatements = SEED_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of seedStatements) {
      await db.prepare(stmt).run();
    }
  });

  it('returns 401 without auth cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/share-target?title=Test', {
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
  });

  it('creates a task from title and redirects', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch(
      'http://localhost/api/v1/share-target?title=Shared+Article',
      { headers: { Cookie: cookie }, redirect: 'manual' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('http://localhost:5173');

    // Verify task was created
    const tasksRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    const data = (await tasksRes.json()) as { tasks: Array<{ title: string; status: string }> };
    const shared = data.tasks.find((t) => t.title === 'Shared Article');
    expect(shared).toBeTruthy();
    expect(shared!.status).toBe('inbox');
  });

  it('creates a task with URL', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch(
      'http://localhost/api/v1/share-target?title=Cool+Link&url=https://example.com',
      { headers: { Cookie: cookie }, redirect: 'manual' }
    );
    expect(res.status).toBe(302);

    // Verify task was created with URL
    const tasksRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    const data = (await tasksRes.json()) as {
      tasks: Array<{ title: string; url: string | null }>;
    };
    const shared = data.tasks.find((t) => t.title === 'Cool Link');
    expect(shared).toBeTruthy();
    expect(shared!.url).toBe('https://example.com');
  });

  it('falls back to text param when title is missing', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch(
      'http://localhost/api/v1/share-target?text=From+text+param',
      { headers: { Cookie: cookie }, redirect: 'manual' }
    );
    expect(res.status).toBe(302);

    const tasksRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    const data = (await tasksRes.json()) as { tasks: Array<{ title: string }> };
    const shared = data.tasks.find((t) => t.title === 'From text param');
    expect(shared).toBeTruthy();
  });

  it('uses default title when no title or text provided', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/share-target', {
      headers: { Cookie: cookie },
      redirect: 'manual',
    });
    expect(res.status).toBe(302);

    const tasksRes = await SELF.fetch('http://localhost/api/v1/tasks', {
      headers: { Cookie: cookie },
    });
    const data = (await tasksRes.json()) as { tasks: Array<{ title: string }> };
    const shared = data.tasks.find((t) => t.title === 'Shared item');
    expect(shared).toBeTruthy();
  });
});
