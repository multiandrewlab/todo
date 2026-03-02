# Task OS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a serverless Personal Task Management PWA on Cloudflare (D1, R2, Workers AI, Email Workers) with Vue 3, Hono, and natural language capture.

**Architecture:** pnpm monorepo with three Wrangler projects — `frontend/` (Vue+Vite on Pages), `backend/` (Hono Worker with D1/R2/AI), `email-worker/` (Email Worker) — plus `shared/` for types. Auth via Google OAuth with JWT cookies.

**Tech Stack:** Vue 3, Vite, Tailwind CSS, Hono, Cloudflare Workers/D1/R2/Workers AI, Playwright, Vitest, pnpm workspaces.

**Design doc:** `docs/plans/2026-03-02-task-os-design.md`

---

## Phase 1: Project Scaffolding

### Task 1: Initialize pnpm monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Step 1: Create root package.json**

```json
{
  "name": "muscat",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter backend dev\" \"pnpm --filter frontend dev\"",
    "test": "pnpm -r test",
    "test:e2e": "playwright test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - frontend
  - backend
  - email-worker
  - shared
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.wrangler/
.dev.vars
*.local
.context/
```

**Step 5: Create .npmrc**

```
shamefully-hoist=false
strict-peer-dependencies=false
```

**Step 6: Run pnpm install**

Run: `pnpm install`

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: initialize pnpm monorepo scaffolding"
```

---

### Task 2: Scaffold shared package

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/recurrence.ts`
- Create: `shared/src/index.ts`

**Step 1: Create shared/package.json**

```json
{
  "name": "@muscat/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**Step 2: Create shared/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create shared/src/types.ts**

Define all types used across packages:

```typescript
// Database row types
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  url_title: string | null;
  url_favicon: string | null;
  due_date: string | null;
  recurrence_rule: string | null; // JSON string of RecurrenceRule
  status: 'inbox' | 'active' | 'archived';
  created_at: string;
  archived_at: string | null;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  task_id: string;
  file_name: string;
  r2_key: string;
  content_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface UserSetting {
  user_id: string;
  setting_name: string;
  setting_value: string;
  created_at: string;
}

// Recurrence
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];   // 0=Sun..6=Sat
  dayOfMonth?: number;     // 1-31
  weekOfMonth?: number;    // 1-5
  monthOfYear?: number;    // 1-12
}

// API request/response types
export interface CreateTaskRequest {
  title: string;
  notes?: string;
  url?: string;
  due_date?: string;
  recurrence_rule?: RecurrenceRule;
  status?: 'inbox' | 'active';
  tag_ids?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  notes?: string;
  url?: string;
  due_date?: string;
  recurrence_rule?: RecurrenceRule | null;
  status?: 'inbox' | 'active';
  tag_ids?: string[];
}

export interface TaskWithRelations extends Task {
  tags: Tag[];
  attachments: Attachment[];
}

export interface NLParseRequest {
  text: string;
}

export interface NLParseResponse {
  title: string;
  notes?: string;
  url?: string;
  due_date?: string;
  recurrence_rule?: RecurrenceRule;
  status?: 'inbox' | 'active';
  tags?: string[]; // tag names (may include new ones)
}
```

**Step 4: Create shared/src/index.ts**

```typescript
export * from './types.js';
export * from './recurrence.js';
```

**Step 5: Create shared/src/recurrence.ts (stub)**

```typescript
import type { RecurrenceRule } from './types.js';

/**
 * Calculate the next occurrence date from an original due date and recurrence rule.
 * Steps forward from originalDueDate until the result is strictly after referenceDate.
 */
export function getNextOccurrence(
  originalDueDate: string,
  rule: RecurrenceRule,
  referenceDate: string
): string {
  // Stub — implemented with TDD in Task 7
  throw new Error('Not implemented');
}
```

**Step 6: Commit**

```bash
git add shared/ && git commit -m "feat: scaffold shared package with types"
```

---

### Task 3: Scaffold backend package

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/wrangler.toml`
- Create: `backend/src/index.ts`
- Create: `backend/src/bindings.ts`

**Step 1: Create backend/package.json**

```json
{
  "name": "@muscat/backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "wrangler d1 migrations apply DB --remote"
  },
  "dependencies": {
    "@muscat/shared": "workspace:*",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20250214.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

**Step 2: Create backend/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "paths": {
      "@muscat/shared": ["../shared/src"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 3: Create backend/wrangler.toml**

```toml
name = "muscat-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "muscat-db"
database_id = "local"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "muscat-attachments"

[ai]
binding = "AI"

[vars]
FRONTEND_URL = "http://localhost:5173"
```

**Step 4: Create backend/src/bindings.ts**

```typescript
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  AI: Ai;
  FRONTEND_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
}
```

**Step 5: Create backend/src/index.ts**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './bindings.js';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

export default app;
```

**Step 6: Create backend/.dev.vars**

```
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
JWT_SECRET=dev-secret-change-in-prod
```

Note: `.dev.vars` is in `.gitignore`.

**Step 7: Install deps and verify**

Run: `cd backend && pnpm install && pnpm dev` — verify health endpoint returns `{"status":"ok"}` on `http://localhost:8787/api/v1/health`

**Step 8: Commit**

```bash
git add backend/ && git commit -m "feat: scaffold backend Hono worker with D1/R2/AI bindings"
```

---

### Task 4: Scaffold frontend package

**Files:**
- Create: `frontend/` — Vue 3 + Vite + Tailwind scaffolded with `create-vue`
- Modify: `frontend/package.json` — add workspace dep + PWA plugin
- Create: `frontend/vite.config.ts` — configure PWA + API proxy

**Step 1: Scaffold Vue project**

Run: `cd frontend && pnpm create vue@latest . --ts --router --pinia` (accept defaults)

Or manually create the Vue project structure if the CLI is unavailable.

**Step 2: Install dependencies**

```bash
cd frontend
pnpm add @muscat/shared
pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

**Step 3: Configure vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Muscat Tasks',
        short_name: 'Muscat',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#e94560',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        share_target: {
          action: '/_share',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.api\..*/i,
            handler: 'NetworkFirst',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 4: Add Tailwind to main CSS**

In `frontend/src/assets/main.css`:

```css
@import "tailwindcss";
```

**Step 5: Verify dev server starts**

Run: `cd frontend && pnpm dev` — verify it loads on `http://localhost:5173`

**Step 6: Commit**

```bash
git add frontend/ && git commit -m "feat: scaffold frontend with Vue 3, Tailwind, PWA"
```

---

### Task 5: Scaffold email-worker package

**Files:**
- Create: `email-worker/package.json`
- Create: `email-worker/tsconfig.json`
- Create: `email-worker/wrangler.toml`
- Create: `email-worker/src/index.ts`

**Step 1: Create email-worker/package.json**

```json
{
  "name": "@muscat/email-worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@muscat/shared": "workspace:*",
    "postal-mime": "^2.4.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20250214.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

**Step 2: Create email-worker/wrangler.toml**

```toml
name = "muscat-email-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "muscat-db"
database_id = "local"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "muscat-attachments"
```

**Step 3: Create email-worker/src/index.ts (stub)**

```typescript
import PostalMime from 'postal-mime';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    // Stub — implemented in Task 16
    console.log(`Email received from ${message.from}`);
  },
};
```

**Step 4: Install deps**

Run: `cd email-worker && pnpm install`

**Step 5: Commit**

```bash
git add email-worker/ && git commit -m "feat: scaffold email worker package"
```

---

### Task 6: D1 database migration

**Files:**
- Create: `backend/migrations/0001_initial_schema.sql`

**Step 1: Create migration file**

Run: `cd backend && npx wrangler d1 migrations create DB initial_schema`

This creates a timestamped file in `backend/migrations/`. Edit it with the full schema from the design doc:

```sql
-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings (email allowlist, preferences)
CREATE TABLE user_settings (
    user_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, setting_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tasks
CREATE TABLE tasks (
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

-- Tags (unique per user)
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Task-tag join table
CREATE TABLE task_tags (
    task_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Attachments
CREATE TABLE attachments (
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

-- Full-text search
CREATE VIRTUAL TABLE tasks_fts USING fts5(
    title, notes, content='tasks', content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (NEW.rowid, NEW.title, NEW.notes);
END;

CREATE TRIGGER tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
END;

CREATE TRIGGER tasks_au AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (NEW.rowid, NEW.title, NEW.notes);
END;

-- Indexes
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due_date ON tasks(user_id, due_date);
CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_attachments_task ON attachments(task_id);
```

**Step 2: Create seed migration**

Run: `cd backend && npx wrangler d1 migrations create DB seed_initial_user`

```sql
-- Seed initial user
INSERT INTO users (id, email) VALUES ('user_001', 'andrew.hunt@fundamentalmedia.com');

-- Seed email allowlist
INSERT INTO user_settings (user_id, setting_name, setting_value) VALUES ('user_001', 'email_allowlist', '["andrew.hunt@fundamentalmedia.com","andy@mrhunt.co.uk","ahunt83@gmail.com"]');
```

**Step 3: Apply migrations locally**

Run: `cd backend && pnpm db:migrate:local`
Expected: Migrations applied successfully.

**Step 4: Verify schema**

Run: `cd backend && npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
Expected: users, user_settings, tasks, tags, task_tags, attachments, tasks_fts

**Step 5: Commit**

```bash
git add backend/migrations/ && git commit -m "feat: add D1 schema migration with FTS5 and seed data"
```

---

## Phase 2: Backend Core Logic (TDD)

### Task 7: Recurrence logic (TDD)

**Files:**
- Create: `shared/src/recurrence.test.ts`
- Modify: `shared/src/recurrence.ts`
- Create: `shared/vitest.config.ts`

**Step 1: Set up vitest for shared**

Add to `shared/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

Create `shared/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

Install vitest: `cd shared && pnpm add -D vitest`

**Step 2: Write failing tests**

Create `shared/src/recurrence.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getNextOccurrence } from './recurrence.js';
import type { RecurrenceRule } from './types.js';

describe('getNextOccurrence', () => {
  // Daily
  it('daily: next day from original', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-01-02');
  });

  it('daily: skips past reference date', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-15')).toBe('2025-01-16');
  });

  it('every 3 days', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 3 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-01-04');
  });

  // Weekly
  it('weekly: next week same day', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-01-13'); // Mon -> Mon
  });

  it('every 2 weeks on Monday', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 2, daysOfWeek: [1] };
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-01-20');
  });

  // Monthly by day of month
  it('monthly on the 15th', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 15 };
    expect(getNextOccurrence('2025-01-15', rule, '2025-01-15')).toBe('2025-02-15');
  });

  it('every 3 months on the 1st', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 3, dayOfMonth: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-04-01');
  });

  // Monthly by weekday (2nd Tuesday)
  it('2nd Tuesday every month', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, daysOfWeek: [2], weekOfMonth: 2 };
    // 2025-01-14 is 2nd Tuesday of Jan. Next 2nd Tuesday is Feb 11.
    expect(getNextOccurrence('2025-01-14', rule, '2025-01-14')).toBe('2025-02-11');
  });

  // Yearly
  it('yearly on March 15', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', interval: 1, monthOfYear: 3, dayOfMonth: 15 };
    expect(getNextOccurrence('2025-03-15', rule, '2025-03-15')).toBe('2026-03-15');
  });

  // Edge: reference date far in the future
  it('catches up to future reference date', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    expect(getNextOccurrence('2025-01-06', rule, '2025-03-01')).toBe('2025-03-03'); // next Monday after Mar 1
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd shared && pnpm test`
Expected: All tests FAIL (throws "Not implemented").

**Step 4: Implement getNextOccurrence**

Replace the stub in `shared/src/recurrence.ts` with full implementation. The function:
1. Parses `originalDueDate` and `referenceDate` as dates
2. Steps forward from `originalDueDate` by the rule's interval/frequency
3. For weekly with `daysOfWeek`, finds the next matching weekday in the target week
4. For monthly with `weekOfMonth` + `daysOfWeek`, finds the Nth weekday in target month
5. Continues stepping until result > referenceDate
6. Returns `YYYY-MM-DD` string

Use only `Date` built-ins (no external date library). All dates are date-only, no timezone issues.

**Step 5: Run tests to verify they pass**

Run: `cd shared && pnpm test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add shared/ && git commit -m "feat: implement recurrence rule next-occurrence logic with tests"
```

---

### Task 8: Auth middleware and routes (TDD)

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/lib/jwt.ts`
- Create: `backend/tests/unit/jwt.test.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/vitest.config.ts`

**Step 1: Set up vitest for backend**

Create `backend/vitest.config.ts`:
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

**Step 2: Write JWT unit tests**

Create `backend/tests/unit/jwt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from '../../src/lib/jwt.js';

describe('JWT', () => {
  const secret = 'test-secret';

  it('creates and verifies a token', async () => {
    const payload = { sub: 'user_001', email: 'test@example.com' };
    const token = await createToken(payload, secret);
    const decoded = await verifyToken(token, secret);
    expect(decoded.sub).toBe('user_001');
    expect(decoded.email).toBe('test@example.com');
  });

  it('rejects a token with wrong secret', async () => {
    const payload = { sub: 'user_001', email: 'test@example.com' };
    const token = await createToken(payload, secret);
    await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const payload = { sub: 'user_001', email: 'test@example.com' };
    const token = await createToken(payload, secret, -1); // expired
    await expect(verifyToken(token, secret)).rejects.toThrow();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd backend && pnpm test`
Expected: FAIL (jwt module doesn't exist).

**Step 4: Implement JWT lib**

Create `backend/src/lib/jwt.ts` using the Web Crypto API (available in Workers):
- `createToken(payload, secret, expiresInSeconds = 86400)` — HMAC-SHA256 signed JWT
- `verifyToken(token, secret)` — validates signature and expiry, returns payload

Use the Web Crypto API `crypto.subtle.importKey` + `crypto.subtle.sign/verify` with HMAC SHA-256. Manually build JWT (header.payload.signature) — no external library needed in Workers.

**Step 5: Run tests to verify they pass**

Run: `cd backend && pnpm test`
Expected: PASS.

**Step 6: Implement auth routes**

Create `backend/src/routes/auth.ts`:

```typescript
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../bindings.js';
import { createToken, verifyToken } from '../lib/jwt.js';

const auth = new Hono<{ Bindings: Env }>();

// Redirect to Google OAuth
auth.get('/login', (c) => {
  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// OAuth callback
auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'No code provided' }, 400);

  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/callback`;

  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json() as { access_token: string };

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userRes.json() as { email: string };

  // Check user exists in DB
  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
    .bind(userInfo.email)
    .first();

  if (!user) {
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=unauthorized`);
  }

  // Create JWT and set cookie
  const token = await createToken(
    { sub: user.id as string, email: user.email as string },
    c.env.JWT_SECRET,
  );

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 86400, // 24 hours
  });

  return c.redirect(c.env.FRONTEND_URL);
});

// Logout
auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

// Current user
auth.get('/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    return c.json({ id: payload.sub, email: payload.email });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export { auth };
```

**Step 7: Implement auth middleware**

Create `backend/src/middleware/auth.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Env } from '../bindings.js';
import { verifyToken } from '../lib/jwt.js';

type AuthEnv = {
  Bindings: Env;
  Variables: { userId: string; userEmail: string };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
```

**Step 8: Wire into main app**

Update `backend/src/index.ts` to mount auth routes:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './bindings.js';
import { auth } from './routes/auth.js';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));
app.route('/api/v1/auth', auth);

export default app;
```

**Step 9: Commit**

```bash
git add backend/ && git commit -m "feat: add Google OAuth auth flow with JWT middleware"
```

---

### Task 9: Task CRUD routes (TDD)

**Files:**
- Create: `backend/tests/integration/tasks.test.ts`
- Create: `backend/src/routes/tasks.ts`
- Create: `backend/src/lib/id.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing integration tests**

Create `backend/tests/integration/tasks.test.ts`. Use `@cloudflare/vitest-pool-workers` which provides real D1 bindings. Tests should:

1. **POST /api/v1/tasks** — create a task, verify 201 response with task data
2. **GET /api/v1/tasks** — list tasks, verify returns array filtered by status
3. **GET /api/v1/tasks/:id** — get single task with tags and attachments
4. **PUT /api/v1/tasks/:id** — update task fields
5. **POST /api/v1/tasks/:id/archive** — archive task, verify status change
6. Verify tasks are scoped to authenticated user

For test auth: create a test helper that generates a valid JWT and sets the cookie header.

**Step 2: Run tests to verify they fail**

Run: `cd backend && pnpm test`
Expected: FAIL.

**Step 3: Implement ID generation**

Create `backend/src/lib/id.ts`:
```typescript
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
```

**Step 4: Implement task routes**

Create `backend/src/routes/tasks.ts` with Hono route group:

- `GET /` — query tasks by user_id, optional `status` filter, optional `search` query (FTS5 MATCH), optional `due_before`/`due_after` date filters. Paginated with `limit`/`offset`.
- `POST /` — create task with `generateId('task')`, insert into D1, handle tag_ids (insert into task_tags). If URL provided, trigger link preview fetch (fire-and-forget via `ctx.waitUntil`).
- `GET /:id` — join tasks + tags + attachments, return `TaskWithRelations`.
- `PUT /:id` — update fields, handle tag_ids replacement (delete old, insert new). If URL changed, re-fetch link preview.
- `POST /:id/archive` — set `status='archived'`, `archived_at=CURRENT_TIMESTAMP`. If `recurrence_rule` exists, call `getNextOccurrence()` and create new task with `status='inbox'`.

All routes protected by `requireAuth` middleware. All queries scoped by `c.var.userId`.

**Step 5: Wire into main app**

Add to `backend/src/index.ts`:
```typescript
import { tasks } from './routes/tasks.js';
import { requireAuth } from './middleware/auth.js';

app.use('/api/v1/tasks/*', requireAuth);
app.route('/api/v1/tasks', tasks);
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && pnpm test`
Expected: PASS.

**Step 7: Commit**

```bash
git add backend/ && git commit -m "feat: add task CRUD routes with archive and recurrence"
```

---

### Task 10: Tag routes (TDD)

**Files:**
- Create: `backend/tests/integration/tags.test.ts`
- Create: `backend/src/routes/tags.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing tests**

Tests:
1. **POST /api/v1/tags** — create tag, verify 201
2. **GET /api/v1/tags** — list tags for user
3. **PUT /api/v1/tags/:id** — update tag name
4. **POST /api/v1/tags** with duplicate name — verify 409 conflict
5. Verify tags scoped to user

**Step 2: Run to verify failure**

Run: `cd backend && pnpm test`

**Step 3: Implement tag routes**

Create `backend/src/routes/tags.ts`:
- `GET /` — `SELECT * FROM tags WHERE user_id = ?`
- `POST /` — insert new tag, handle UNIQUE constraint (409 on duplicate)
- `PUT /:id` — update name, verify ownership

**Step 4: Wire and run tests**

Run: `cd backend && pnpm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add tag CRUD routes"
```

---

### Task 11: Attachment routes with R2 (TDD)

**Files:**
- Create: `backend/tests/integration/attachments.test.ts`
- Create: `backend/src/routes/attachments.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing tests**

Tests:
1. **POST /api/v1/tasks/:id/attachments/upload-url** — returns presigned URL and attachment record
2. **GET /api/v1/tasks/:id/attachments/:aid/download-url** — returns presigned download URL
3. **DELETE /api/v1/tasks/:id/attachments/:aid** — removes from DB and R2

**Step 2: Run to verify failure**

**Step 3: Implement attachment routes**

- Upload: Generate `r2_key` as `{user_id}/{task_id}/{uuid}/{filename}`. Create attachment record in D1. Use R2 bucket's `createMultipartUpload` or return a presigned PUT URL. If `bucket.createPresignedUrl` isn't available, use a direct upload through the worker (`PUT` body → `bucket.put(key, body)`).
- Download: `bucket.get(key)` → return presigned URL or stream directly.
- Delete: `bucket.delete(key)` + delete from D1.

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add attachment upload/download routes with R2"
```

---

### Task 12: NL parsing route with Workers AI (TDD)

**Files:**
- Create: `backend/tests/integration/ai.test.ts`
- Create: `backend/src/routes/ai.ts`
- Create: `backend/src/services/nl-parser.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing tests**

Test the NL parser service (unit-testable with mocked AI binding):

```typescript
describe('NL Parser', () => {
  it('extracts title and due date from simple input', async () => {
    const mockAI = {
      run: async () => ({
        response: JSON.stringify({
          title: 'Call Andy',
          due_date: '2025-01-13', // "next week" from a Monday reference
        }),
      }),
    };
    const result = await parseNaturalLanguage('Call Andy next week', mockAI as any);
    expect(result.title).toBe('Call Andy');
    expect(result.due_date).toBeDefined();
  });

  it('extracts tags prefixed with #', async () => {
    const mockAI = {
      run: async () => ({
        response: JSON.stringify({
          title: 'Review PR',
          tags: ['urgent'],
        }),
      }),
    };
    const result = await parseNaturalLanguage('Review PR #urgent', mockAI as any);
    expect(result.tags).toContain('urgent');
  });
});
```

**Step 2: Run to verify failure**

**Step 3: Implement NL parser service**

Create `backend/src/services/nl-parser.ts`:

```typescript
import type { NLParseResponse } from '@muscat/shared';

export async function parseNaturalLanguage(
  text: string,
  ai: Ai,
  today: string = new Date().toISOString().split('T')[0]
): Promise<NLParseResponse> {
  const result = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: `You are a task parser. Extract structured data from natural language task descriptions.
Today's date is ${today}. Return ONLY valid JSON with these optional fields:
- title (string, required): the task title
- notes (string): additional details
- url (string): any URL mentioned
- due_date (string): YYYY-MM-DD format
- recurrence_rule (object): { frequency, interval, daysOfWeek?, dayOfMonth?, weekOfMonth?, monthOfYear? }
- status (string): "inbox" or "active"
- tags (string[]): tag names (from #hashtags or inferred categories)

Return ONLY the JSON object, no markdown, no explanation.`,
      },
      { role: 'user', content: text },
    ],
  });

  const response = (result as { response: string }).response;
  return JSON.parse(response);
}
```

**Step 4: Create route**

Create `backend/src/routes/ai.ts`:
```typescript
import { Hono } from 'hono';
import type { Env } from '../bindings.js';
import { parseNaturalLanguage } from '../services/nl-parser.js';

const ai = new Hono<{ Bindings: Env }>();

ai.post('/parse', async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'Text is required' }, 400);

  const result = await parseNaturalLanguage(text, c.env.AI);
  return c.json(result);
});

export { ai };
```

**Step 5: Run tests**

Expected: PASS.

**Step 6: Commit**

```bash
git add backend/ && git commit -m "feat: add NL parsing route with Workers AI Llama 3.3"
```

---

### Task 13: Link preview service (TDD)

**Files:**
- Create: `backend/tests/unit/link-preview.test.ts`
- Create: `backend/src/services/link-preview.ts`

**Step 1: Write failing tests**

```typescript
describe('fetchLinkPreview', () => {
  it('extracts title and favicon from HTML', () => {
    const html = `<html><head>
      <title>Example Page</title>
      <link rel="icon" href="/favicon.ico">
    </head></html>`;
    const result = parseLinkPreview(html, 'https://example.com');
    expect(result.title).toBe('Example Page');
    expect(result.favicon).toBe('https://example.com/favicon.ico');
  });

  it('handles relative favicon paths', () => {
    const html = `<html><head><title>Test</title><link rel="shortcut icon" href="img/fav.png"></head></html>`;
    const result = parseLinkPreview(html, 'https://example.com/page');
    expect(result.favicon).toBe('https://example.com/img/fav.png');
  });

  it('returns null values for missing elements', () => {
    const result = parseLinkPreview('<html><body>No head</body></html>', 'https://example.com');
    expect(result.title).toBeNull();
    expect(result.favicon).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

**Step 3: Implement link preview**

Create `backend/src/services/link-preview.ts`:
- `parseLinkPreview(html: string, baseUrl: string)` — regex/string parsing to extract `<title>` and `<link rel="icon">`
- `fetchLinkPreview(url: string)` — fetch URL, get HTML, call parse, return `{ title, favicon }`

Use regex for HTML parsing (no DOM parser in Workers). Keep it simple — find first `<title>...</title>` and first `<link` with `rel` containing `icon`.

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add link preview service for URL title/favicon extraction"
```

---

### Task 14: Search route (TDD)

**Files:**
- Create: `backend/tests/integration/search.test.ts`
- Modify: `backend/src/routes/tasks.ts` (add search to GET /tasks)

**Step 1: Write failing tests**

```typescript
describe('Task search', () => {
  it('finds tasks by title via FTS5', async () => {
    // Create tasks "Buy groceries" and "Call dentist"
    // Search for "groceries" — should return only "Buy groceries"
  });

  it('finds tasks by notes content', async () => {
    // Create task with notes containing "important meeting"
    // Search for "meeting" — should return it
  });

  it('excludes archived tasks by default', async () => {
    // Create archived task "Old task"
    // Search for "Old" — should return empty
  });

  it('includes archived when include_archived=true', async () => {
    // Search for "Old" with include_archived=true — should return it
  });
});
```

**Step 2: Run to verify failure**

**Step 3: Implement search**

In the `GET /tasks` route, add search support:
- When `search` query param is present, join with `tasks_fts` using `MATCH`
- Add `include_archived` query param (defaults to false)
- FTS5 query: `SELECT tasks.* FROM tasks JOIN tasks_fts ON tasks.rowid = tasks_fts.rowid WHERE tasks_fts MATCH ? AND tasks.user_id = ?`

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add FTS5 search to task listing"
```

---

### Task 15: Settings routes (TDD)

**Files:**
- Create: `backend/tests/integration/settings.test.ts`
- Create: `backend/src/routes/settings.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing tests**

Tests:
1. **GET /api/v1/settings** — returns all settings for user
2. **PUT /api/v1/settings/:name** — upserts a setting
3. Verify settings scoped to user

**Step 2: Run to verify failure**

**Step 3: Implement settings routes**

- `GET /` — `SELECT * FROM user_settings WHERE user_id = ?`
- `PUT /:name` — `INSERT OR REPLACE INTO user_settings (user_id, setting_name, setting_value) VALUES (?, ?, ?)`

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add user settings CRUD routes"
```

---

### Task 16: Share target route

**Files:**
- Modify: `backend/src/routes/tasks.ts` or create `backend/src/routes/share.ts`
- Modify: `backend/src/index.ts`

**Step 1: Implement share target route**

```typescript
// GET /api/v1/share-target?title=...&text=...&url=...
share.get('/', requireAuth, async (c) => {
  const title = c.req.query('title') || c.req.query('text') || 'Shared item';
  const url = c.req.query('url') || null;

  const id = generateId('task');
  await c.env.DB.prepare(
    'INSERT INTO tasks (id, user_id, title, url, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, c.var.userId, title, url, 'inbox').run();

  // If URL provided, fetch link preview in background
  if (url) {
    c.executionCtx.waitUntil(fetchAndUpdateLinkPreview(c.env.DB, id, url));
  }

  // Redirect to app inbox
  return c.redirect(c.env.FRONTEND_URL);
});
```

**Step 2: Test manually**

Open: `http://localhost:8787/api/v1/share-target?title=Test&url=https://example.com` (with auth cookie)
Expected: Creates inbox task and redirects.

**Step 3: Commit**

```bash
git add backend/ && git commit -m "feat: add web share target route"
```

---

### Task 17: Email Worker implementation

**Files:**
- Modify: `email-worker/src/index.ts`
- Create: `email-worker/tests/integration/email.test.ts`

**Step 1: Write failing tests**

```typescript
describe('Email Worker', () => {
  it('creates task from allowed sender email', async () => {
    // Mock email message from andrew.hunt@fundamentalmedia.com
    // Verify task created in D1 with status='inbox'
  });

  it('rejects email from unknown sender', async () => {
    // Mock email from unknown@hacker.com
    // Verify no task created
  });

  it('saves attachments to R2', async () => {
    // Mock email with a PDF attachment
    // Verify attachment record in D1 and file in R2
  });
});
```

**Step 2: Run to verify failure**

**Step 3: Implement email worker**

```typescript
import PostalMime from 'postal-mime';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
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
      const allowlist: string[] = JSON.parse(row.setting_value as string);
      if (allowlist.includes(senderEmail)) {
        matchedUserId = row.user_id as string;
        break;
      }
    }

    if (!matchedUserId) {
      // Silently drop
      return;
    }

    // Parse email
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(rawEmail);

    // Create task
    const taskId = `task_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`;
    await env.DB.prepare(
      'INSERT INTO tasks (id, user_id, title, notes, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(taskId, matchedUserId, parsed.subject || 'Email task', parsed.text || parsed.html || '', 'inbox').run();

    // Save attachments
    if (parsed.attachments?.length) {
      for (const att of parsed.attachments) {
        const attId = `att_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`;
        const r2Key = `${matchedUserId}/${taskId}/${attId}/${att.filename || 'attachment'}`;

        await env.BUCKET.put(r2Key, att.content);
        await env.DB.prepare(
          'INSERT INTO attachments (id, user_id, task_id, file_name, r2_key, content_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(attId, matchedUserId, taskId, att.filename || 'attachment', r2Key, att.mimeType, att.content.byteLength).run();
      }
    }
  },
};
```

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add email-worker/ && git commit -m "feat: implement email-to-task ingestion worker"
```

---

## Phase 3: Frontend

### Task 18: Frontend layout and routing

**Files:**
- Create: `frontend/src/views/InboxView.vue`
- Create: `frontend/src/views/ActiveView.vue`
- Create: `frontend/src/views/ArchivedView.vue`
- Create: `frontend/src/views/SettingsView.vue`
- Create: `frontend/src/views/LoginView.vue`
- Create: `frontend/src/views/ShareTargetView.vue`
- Create: `frontend/src/components/AppLayout.vue`
- Create: `frontend/src/components/Sidebar.vue`
- Modify: `frontend/src/router.ts` (or `router/index.ts`)
- Modify: `frontend/src/App.vue`

**Step 1: Set up router**

```typescript
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  {
    path: '/',
    component: () => import('../components/AppLayout.vue'),
    children: [
      { path: '', name: 'inbox', component: () => import('../views/InboxView.vue') },
      { path: 'active', name: 'active', component: () => import('../views/ActiveView.vue') },
      { path: 'archived', name: 'archived', component: () => import('../views/ArchivedView.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    ],
  },
  { path: '/_share', name: 'share', component: () => import('../views/ShareTargetView.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

// Auth guard
router.beforeEach(async (to) => {
  if (to.name === 'login' || to.name === 'share') return;
  // Check /api/v1/auth/me — redirect to /login on 401
});

export default router;
```

**Step 2: Create AppLayout.vue**

Dense layout with collapsible sidebar (Sidebar component) and `<router-view>` main area. Use Tailwind for all styling. Dark-ish productive theme.

**Step 3: Create Sidebar.vue**

- Navigation links (Inbox with count badge, Active, Archived, Settings)
- NL input bar at top
- Tag filter list
- Collapsible on mobile (hamburger menu)

**Step 4: Create placeholder views**

Each view is a simple `<div>` with the view name — will be fleshed out in subsequent tasks.

**Step 5: Verify routing works**

Run: `pnpm dev` — navigate between views.

**Step 6: Commit**

```bash
git add frontend/ && git commit -m "feat: add frontend layout, routing, and sidebar"
```

---

### Task 19: API client and auth composable

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/composables/useAuth.ts`
- Modify: `frontend/src/views/LoginView.vue`

**Step 1: Create API client**

```typescript
// frontend/src/api/client.ts
const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

**Step 2: Create useAuth composable**

```typescript
// frontend/src/composables/useAuth.ts
import { ref, onMounted } from 'vue';
import { api } from '../api/client.js';

const user = ref<{ id: string; email: string } | null>(null);
const loading = ref(true);

export function useAuth() {
  async function checkAuth() {
    try {
      user.value = await api.get('/auth/me');
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  function login() {
    window.location.href = '/api/v1/auth/login';
  }

  async function logout() {
    await api.post('/auth/logout');
    user.value = null;
    window.location.href = '/login';
  }

  return { user, loading, checkAuth, login, logout };
}
```

**Step 3: Implement LoginView**

Simple centered card with "Sign in with Google" button that calls `login()`.

**Step 4: Commit**

```bash
git add frontend/ && git commit -m "feat: add API client and auth composable"
```

---

### Task 20: Task list and task composable

**Files:**
- Create: `frontend/src/composables/useTasks.ts`
- Create: `frontend/src/components/TaskList.vue`
- Create: `frontend/src/components/TaskRow.vue`
- Modify: `frontend/src/views/InboxView.vue`
- Modify: `frontend/src/views/ActiveView.vue`
- Modify: `frontend/src/views/ArchivedView.vue`

**Step 1: Create useTasks composable**

Manages task state with Pinia or a reactive composable:
- `tasks` — ref of tasks array
- `fetchTasks(status, search?, includeArchived?)` — calls GET /tasks with params
- `archiveTask(id)` — calls POST /tasks/:id/archive
- `updateTask(id, data)` — calls PUT /tasks/:id

**Step 2: Create TaskRow component**

Dense row showing:
- Checkbox (archive on click)
- Title (bold)
- Due date badge (color-coded: red=overdue, orange=today, gray=future)
- Tag chips
- URL card preview (if url_title exists: favicon + title)
- Click to expand notes/attachments

Use Tailwind. Keep it compact — no wasted space.

**Step 3: Create TaskList component**

Receives `status` prop. Calls `fetchTasks(status)` on mount. Renders TaskRow for each task.

**Step 4: Wire into views**

- InboxView: `<TaskList status="inbox" />`
- ActiveView: `<TaskList status="active" />`
- ArchivedView: `<TaskList status="archived" />`

**Step 5: Verify**

Run: `pnpm dev` — create tasks via API/curl, verify they appear in the right views.

**Step 6: Commit**

```bash
git add frontend/ && git commit -m "feat: add task list and task row components"
```

---

### Task 21: New/edit task modal

**Files:**
- Create: `frontend/src/components/TaskModal.vue`
- Create: `frontend/src/components/RecurrencePicker.vue`
- Create: `frontend/src/components/TagSelect.vue`
- Create: `frontend/src/composables/useTags.ts`

**Step 1: Create useTags composable**

- `tags` — ref of tags array
- `fetchTags()` — GET /tags
- `createTag(name)` — POST /tags, returns new tag

**Step 2: Create TagSelect component**

Multi-select dropdown with:
- Search/filter existing tags
- Inline "Add New" option at bottom — creates tag on the fly, adds to selection
- Selected tags shown as chips

**Step 3: Create RecurrencePicker component**

Dropdown UI that builds a `RecurrenceRule`:
- Frequency selector (daily/weekly/monthly/yearly)
- Interval input ("every N...")
- Conditional fields based on frequency:
  - Weekly: day-of-week checkboxes
  - Monthly: radio between "day of month" (number input) or "Nth weekday" (week selector + day selector)
  - Yearly: month selector + day input

**Step 4: Create TaskModal component**

Modal/dialog with form fields:
- Title (text input)
- Notes (textarea, collapsible)
- URL (text input)
- Due date (date picker)
- Recurrence (RecurrencePicker)
- Tags (TagSelect)
- File upload (multiple, shows file list)
- Save / Cancel buttons

Props: `task?` (for editing), `prefill?` (from NL parse). Emits `save` with `CreateTaskRequest | UpdateTaskRequest`.

**Step 5: Wire create button**

Add floating "+" button in InboxView/ActiveView that opens TaskModal.

**Step 6: Commit**

```bash
git add frontend/ && git commit -m "feat: add task modal with recurrence picker and tag select"
```

---

### Task 22: Natural language input bar

**Files:**
- Create: `frontend/src/components/NLInputBar.vue`
- Modify: `frontend/src/components/Sidebar.vue`

**Step 1: Create NLInputBar component**

- Text input with placeholder "Add task naturally..."
- On Enter: call `POST /api/v1/ai/parse` with the text
- Show loading spinner while waiting
- On response: open TaskModal with `prefill` data from the AI response
- User reviews, edits if needed, then saves

**Step 2: Add to Sidebar**

Place NLInputBar at the top of the sidebar.

**Step 3: Test manually**

Type "Call Andy next week #urgent" → verify form opens pre-filled.

**Step 4: Commit**

```bash
git add frontend/ && git commit -m "feat: add natural language input bar with AI parsing"
```

---

### Task 23: Search bar

**Files:**
- Create: `frontend/src/components/SearchBar.vue`
- Modify: `frontend/src/components/AppLayout.vue`

**Step 1: Create SearchBar component**

- Text input at top of main area
- Debounced (300ms) — calls `fetchTasks` with search query
- Toggle checkbox: "Include archived"
- Shows result count

**Step 2: Wire into AppLayout**

Place above `<router-view>`. Search results replace the current view's task list.

**Step 3: Commit**

```bash
git add frontend/ && git commit -m "feat: add full-text search bar with archived toggle"
```

---

### Task 24: Swipe gestures

**Files:**
- Modify: `frontend/src/components/TaskRow.vue`

**Step 1: Implement touch swipe**

Add touch event handlers to TaskRow:
- Track `touchstart`, `touchmove`, `touchend`
- Swipe left (> 100px) → archive action (reveal red "Archive" background)
- Swipe right (> 100px) → move to active (reveal green "Activate" background, only from inbox)
- Smooth CSS transition on transform

Keep it lightweight — no external gesture library.

**Step 2: Test on mobile viewport**

Use browser dev tools mobile emulation to verify gestures work.

**Step 3: Commit**

```bash
git add frontend/ && git commit -m "feat: add swipe gestures for archive and activate"
```

---

### Task 25: Attachment upload/download UI

**Files:**
- Create: `frontend/src/components/AttachmentList.vue`
- Modify: `frontend/src/components/TaskModal.vue`
- Modify: `frontend/src/components/TaskRow.vue`

**Step 1: Create AttachmentList component**

- Shows file name, size, type icon
- Download button → calls GET /attachments/:aid/download-url → opens URL
- Delete button (with confirm) → calls DELETE /attachments/:aid

**Step 2: Add upload to TaskModal**

- File input (multiple)
- On save: for each file, call POST /attachments/upload-url → upload to presigned URL
- Show upload progress

**Step 3: Show attachments in expanded TaskRow**

When a task row is expanded, show AttachmentList below notes.

**Step 4: Commit**

```bash
git add frontend/ && git commit -m "feat: add attachment upload/download UI"
```

---

### Task 26: Settings page

**Files:**
- Modify: `frontend/src/views/SettingsView.vue`

**Step 1: Implement settings view**

- Email allowlist: show list of emails from `email_allowlist` setting, with add/remove
- User info: show current email
- Logout button

**Step 2: Commit**

```bash
git add frontend/ && git commit -m "feat: add settings page with email allowlist management"
```

---

### Task 27: Share target handler

**Files:**
- Modify: `frontend/src/views/ShareTargetView.vue`

**Step 1: Implement share target view**

This view handles the PWA share target URL (`/_share?title=...&text=...&url=...`):

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../api/client.js';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const { title, text, url } = route.query;
  await api.get(`/share-target?title=${encodeURIComponent(String(title || text || ''))}&url=${encodeURIComponent(String(url || ''))}`);
  router.push('/');
});
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <p>Adding to inbox...</p>
  </div>
</template>
```

**Step 2: Commit**

```bash
git add frontend/ && git commit -m "feat: add web share target handler view"
```

---

## Phase 4: Testing

### Task 28: E2E tests with Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.setup.ts`
- Create: `e2e/inbox.spec.ts`
- Create: `e2e/task-crud.spec.ts`
- Create: `e2e/search.spec.ts`
- Create: `e2e/nl-input.spec.ts`

**Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
npx playwright install
```

**Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  webServer: [
    {
      command: 'pnpm --filter backend dev',
      port: 8787,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter frontend dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
  },
});
```

**Step 3: Create auth setup**

Create a test helper that seeds a test user in D1 and sets a valid JWT cookie for authenticated tests. Use Playwright's `storageState` to persist auth across tests.

**Step 4: Write E2E tests**

`e2e/inbox.spec.ts`:
- Navigate to inbox
- Verify empty state message
- Create a task → verify it appears in inbox

`e2e/task-crud.spec.ts`:
- Create task with all fields (title, notes, URL, due date, tags, recurrence)
- Edit task — change title
- Archive task — verify it moves to archived view
- Verify recurring task creates next occurrence

`e2e/search.spec.ts`:
- Create several tasks
- Search by title — verify results
- Toggle include archived — verify results change

`e2e/nl-input.spec.ts`:
- Type natural language in the NL bar
- Verify task form opens with pre-filled data
- Save and verify task created

**Step 5: Run E2E tests**

Run: `pnpm test:e2e`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add e2e/ playwright.config.ts && git commit -m "feat: add Playwright E2E tests for core flows"
```

---

## Phase 5: Polish & Deploy

### Task 29: PWA icons and offline support

**Files:**
- Create: `frontend/public/icon-192.png`
- Create: `frontend/public/icon-512.png`
- Verify service worker registration

**Step 1:** Generate PWA icons (simple colored square with "M" letter).
**Step 2:** Verify `vite-plugin-pwa` generates service worker.
**Step 3:** Test offline: disconnect network, verify app shell loads.

**Step 4: Commit**

```bash
git add frontend/public/ && git commit -m "feat: add PWA icons and verify offline support"
```

---

### Task 30: Deployment configuration

**Files:**
- Create: `frontend/wrangler.toml` (Pages config)
- Verify: `backend/wrangler.toml` (production D1/R2 IDs)
- Verify: `email-worker/wrangler.toml`

**Step 1:** Document deployment steps:
1. Create D1 database: `wrangler d1 create muscat-db`
2. Create R2 bucket: `wrangler r2 bucket create muscat-attachments`
3. Update `database_id` in backend and email-worker wrangler.toml
4. Set secrets: `wrangler secret put GOOGLE_CLIENT_ID`, etc.
5. Deploy backend: `cd backend && pnpm deploy`
6. Deploy email-worker: `cd email-worker && pnpm deploy`
7. Deploy frontend: `cd frontend && pnpm pages deploy dist`
8. Configure email routing in Cloudflare dashboard

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add deployment configuration"
```

---

## Summary

| Phase | Tasks | What's Built |
|-------|-------|-------------|
| 1: Scaffolding | 1-6 | Monorepo, packages, D1 schema |
| 2: Backend | 7-17 | Auth, CRUD, AI, search, email worker |
| 3: Frontend | 18-27 | All views, NL input, swipe, search, PWA |
| 4: Testing | 28 | Playwright E2E tests |
| 5: Polish | 29-30 | PWA icons, deployment config |
