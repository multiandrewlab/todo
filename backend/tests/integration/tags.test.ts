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

describe('Tag CRUD', () => {
  beforeAll(async () => {
    const db = env.DB;

    // Apply schema - run each statement separately
    const schemaStatements = SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of schemaStatements) {
      await db.prepare(stmt).run();
    }

    // Apply seed data
    const seedStatements = SEED_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of seedStatements) {
      await db.prepare(stmt).run();
    }
  });

  it('returns 401 without auth cookie', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/tags');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/tags creates a tag', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'urgent' }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string; name: string; user_id: string };
    expect(data.name).toBe('urgent');
    expect(data.id).toMatch(/^tag_/);
    expect(data.user_id).toBe('user_001');
  });

  it('GET /api/v1/tags lists all tags for the user', async () => {
    const cookie = await getAuthCookie();

    // Create two tags
    await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'list-tag-a' }),
    });
    await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'list-tag-b' }),
    });

    const res = await SELF.fetch('http://localhost/api/v1/tags', {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tags: Array<{ id: string; name: string }> };
    expect(data.tags.length).toBeGreaterThanOrEqual(2);
    // Should be ordered by name
    const names = data.tags.map((t) => t.name);
    expect(names).toContain('list-tag-a');
    expect(names).toContain('list-tag-b');
  });

  it('PUT /api/v1/tags/:id updates tag name', async () => {
    const cookie = await getAuthCookie();

    // Create a tag to update
    const createRes = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'old-name' }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/api/v1/tags/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'new-name' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string; name: string };
    expect(data.name).toBe('new-name');
    expect(data.id).toBe(created.id);
  });

  it('POST /api/v1/tags with duplicate name returns 409', async () => {
    const cookie = await getAuthCookie();

    // Create a tag first
    await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'dup-test' }),
    });

    // Try to create the same tag again
    const res = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'dup-test' }),
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Tag already exists');
  });

  it('PUT /api/v1/tags/:id with duplicate name returns 409', async () => {
    const cookie = await getAuthCookie();

    // Create two tags
    await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'existing-tag' }),
    });
    const createRes = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'will-conflict' }),
    });
    const created = (await createRes.json()) as { id: string };

    // Try to rename to 'existing-tag' which already exists
    const res = await SELF.fetch(`http://localhost/api/v1/tags/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'existing-tag' }),
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Tag name already exists');
  });

  it('POST /api/v1/tags with empty name returns 400', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Tag name is required');
  });

  it('PUT /api/v1/tags/:id for non-existent tag returns 404', async () => {
    const cookie = await getAuthCookie();
    const res = await SELF.fetch('http://localhost/api/v1/tags/tag_nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'whatever' }),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Tag not found');
  });
});
