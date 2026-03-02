import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';

// Setup DB schema
beforeAll(async () => {
  // Create tables and seed data
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT NOT NULL, setting_name TEXT NOT NULL, setting_value TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, setting_name));
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, notes TEXT, url TEXT, url_title TEXT, url_favicon TEXT, due_date TEXT, recurrence_rule TEXT, status TEXT DEFAULT 'inbox', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, archived_at DATETIME);
    CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, task_id TEXT NOT NULL, file_name TEXT NOT NULL, r2_key TEXT UNIQUE NOT NULL, content_type TEXT, file_size INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    INSERT OR IGNORE INTO users (id, email) VALUES ('user_001', 'andrew.hunt@fundamentalmedia.com');
    INSERT OR IGNORE INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["andrew.hunt@fundamentalmedia.com","andy@mrhunt.co.uk","ahunt83@gmail.com"]');
  `);
});

describe('Email Worker', () => {
  it('creates task from allowed sender email', async () => {
    // Import and call the email handler with a mock message
    const worker = await import('../../src/index.js');

    // Create a minimal RFC822 email
    const emailContent = [
      'From: andy@mrhunt.co.uk',
      'To: tasks@example.com',
      'Subject: Buy groceries',
      'Content-Type: text/plain',
      '',
      'Remember to buy milk and eggs',
    ].join('\r\n');

    const mockMessage = {
      from: 'andy@mrhunt.co.uk',
      to: 'tasks@example.com',
      raw: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(emailContent));
          controller.close();
        },
      }),
      forward: async () => {},
      reply: async () => {},
      setReject: () => {},
    };

    await worker.default.email(mockMessage as any, env as any, { waitUntil: () => {} } as any);

    // Verify task was created
    const tasks = await env.DB.prepare("SELECT * FROM tasks WHERE title = 'Buy groceries'").all();
    expect(tasks.results.length).toBe(1);
    expect(tasks.results[0].user_id).toBe('user_001');
    expect(tasks.results[0].status).toBe('inbox');
  });

  it('rejects email from unknown sender', async () => {
    const worker = await import('../../src/index.js');

    const emailContent = [
      'From: unknown@hacker.com',
      'Subject: Spam task',
      'Content-Type: text/plain',
      '',
      'This should be dropped',
    ].join('\r\n');

    const mockMessage = {
      from: 'unknown@hacker.com',
      to: 'tasks@example.com',
      raw: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(emailContent));
          controller.close();
        },
      }),
      forward: async () => {},
      reply: async () => {},
      setReject: () => {},
    };

    await worker.default.email(mockMessage as any, env as any, { waitUntil: () => {} } as any);

    // Verify no task was created
    const tasks = await env.DB.prepare("SELECT * FROM tasks WHERE title = 'Spam task'").all();
    expect(tasks.results.length).toBe(0);
  });
});
