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

describe('Settings CRUD', () => {
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
    const res = await SELF.fetch('http://localhost/api/v1/settings');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/settings returns settings for user', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/settings', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      settings: Array<{ setting_name: string; setting_value: string }>;
    };
    expect(Array.isArray(data.settings)).toBe(true);
    // Should include the seeded email_allowlist
    const allowlist = data.settings.find((s) => s.setting_name === 'email_allowlist');
    expect(allowlist).toBeTruthy();
  });

  it('PUT /api/v1/settings/:name creates a new setting', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/settings/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ value: 'dark' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { setting_name: string; setting_value: string };
    expect(data.setting_name).toBe('theme');
    expect(data.setting_value).toBe('dark');
  });

  it('PUT /api/v1/settings/:name updates an existing setting', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/settings/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ value: 'light' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { setting_name: string; setting_value: string };
    expect(data.setting_name).toBe('theme');
    expect(data.setting_value).toBe('light');

    // Verify via GET
    const getRes = await SELF.fetch('http://localhost/api/v1/settings', {
      headers: { Cookie: cookie },
    });
    const getData = (await getRes.json()) as {
      settings: Array<{ setting_name: string; setting_value: string }>;
    };
    const theme = getData.settings.find((s) => s.setting_name === 'theme');
    expect(theme?.setting_value).toBe('light');
  });

  it('PUT /api/v1/settings/:name without value returns 400', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/settings/broken', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Value is required');
  });
});
