# Cloudflare-Native Personal Task OS — Design Document

## Overview

A serverless, multi-user Personal Task Management PWA on Cloudflare. Zero-friction capture via natural language input, email-to-task pipeline, and Web Share Target API. Dense, productive UI (Todoist-style).

## Architecture

**Approach:** Monorepo with three separate Wrangler projects.

```
muscat/
├── frontend/          # Vue 3 + Vite + Tailwind + PWA (Cloudflare Pages)
├── backend/           # Hono on Workers (D1, R2, Workers AI bindings)
├── email-worker/      # Email ingestion Worker (D1 binding, postal-mime)
├── shared/            # TypeScript types + recurrence logic
├── playwright.config.ts
└── package.json       # pnpm workspaces
```

**Why three projects:**
- Email Workers need a separate entry point (`email()` export, not `fetch()`)
- Frontend on Pages gets edge caching and preview deployments
- Backend Worker owns all D1/R2/AI bindings

**Local dev:** `pnpm dev` runs `wrangler dev` (backend) + `vite dev` (frontend) in parallel. Frontend proxies `/api` to backend's local port.

## Authentication

Google OAuth flow:
1. `GET /auth/login` → redirect to Google
2. Google redirects back with code → `GET /auth/callback`
3. Backend exchanges code for token, fetches userinfo
4. Checks email exists in `users` table (rejects unknown users)
5. Sets `HttpOnly`, `Secure`, `SameSite=Strict` cookie with JWT (`{ sub: user_id, email }`)
6. JWT signed with `JWT_SECRET` env var

Auth middleware on all `/api/v1/*` routes validates JWT, injects `user_id` into Hono context.

**Multi-user:** Any Google account can attempt login, but only users seeded in the `users` table are allowed. Initial user (`andrew.hunt@fundamentalmedia.com`) seeded via D1 migration.

## Database Schema (D1 SQLite)

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
    user_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, setting_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE task_tags (
    task_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

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

CREATE VIRTUAL TABLE tasks_fts USING fts5(
    title, notes, content='tasks', content_rowid='rowid'
);

CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due_date ON tasks(user_id, due_date);
CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_attachments_task ON attachments(task_id);
```

## Recurrence Rules

Stored as JSON TEXT in `recurrence_rule`:

```typescript
type RecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];   // 0=Sun..6=Sat
  dayOfMonth?: number;     // 1-31
  weekOfMonth?: number;    // 1-5
  monthOfYear?: number;    // 1-12
};
```

**Examples:**
- Every day: `{ frequency: "daily", interval: 1 }`
- Every 2 weeks on Monday: `{ frequency: "weekly", interval: 2, daysOfWeek: [1] }`
- 2nd Tuesday every month: `{ frequency: "monthly", interval: 1, daysOfWeek: [2], weekOfMonth: 2 }`
- Yearly on March 15: `{ frequency: "yearly", interval: 1, monthOfYear: 3, dayOfMonth: 15 }`

**Next occurrence:** Calculated from the **original due date**, stepping forward by the recurrence rule until the result is in the future. Never based on archive date.

## API Routes

All under `/api/v1`, all require auth (except `/auth/*`).

| Method | Route | Purpose |
|--------|-------|---------|
| GET | /auth/login | Redirect to Google OAuth |
| GET | /auth/callback | Handle OAuth callback |
| POST | /auth/logout | Clear cookie |
| GET | /auth/me | Current user info |
| GET | /tasks | List tasks (filter: status, search, date range) |
| POST | /tasks | Create task |
| GET | /tasks/:id | Get task with tags + attachments |
| PUT | /tasks/:id | Update task |
| POST | /tasks/:id/archive | Archive (triggers recurrence) |
| GET | /tags | List user's tags |
| POST | /tags | Create tag |
| PUT | /tags/:id | Update tag |
| POST | /tasks/:id/attachments/upload-url | Presigned R2 upload URL |
| GET | /tasks/:id/attachments/:aid/download-url | Presigned R2 download URL |
| DELETE | /tasks/:id/attachments/:aid | Delete attachment |
| POST | /ai/parse | NL text to structured task JSON |
| GET | /share-target | Web Share Target receiver |
| GET | /settings | Get user settings |
| PUT | /settings/:name | Update setting |

## Data Flows

**Natural Language Input:**
1. User types text in NL bar
2. `POST /ai/parse` sends to Llama 3.3 (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
3. AI returns structured JSON (title, due_date, tags, recurrence, notes, url, status)
4. Frontend pre-fills New Task form — user reviews and saves

**Archive + Recurrence:**
1. `POST /tasks/:id/archive` sets `status='archived'`, `archived_at=now`
2. If `recurrence_rule` exists, compute next due date from original
3. Create new task with `status='inbox'` and the next due date

**Link Preview:**
1. On task create/update with URL, backend fetches target URL
2. Extracts `<title>` and `<link rel="icon">` (favicon)
3. Stores in `url_title` and `url_favicon` columns

**Email Ingestion:**
1. Email Worker receives raw email
2. `postal-mime` parses sender, subject, body, attachments
3. Checks sender against user_settings allowlist (drops non-matching)
4. Creates task (`status='inbox'`, title=subject, notes=body)
5. Saves attachments to R2, creates attachment records in D1

**Web Share Target:**
1. User shares URL/text from phone browser
2. PWA manifest routes to `GET /share-target`
3. Creates inbox task immediately (title from page title, URL populated)

## Frontend

**Views:**
- `/` — Inbox (unprocessed tasks)
- `/active` — Active tasks sorted by due date
- `/archived` — Archived tasks
- `/settings` — Email allowlist, preferences

**Layout (dense/productive):**
- Collapsible sidebar: nav links, tag filter, NL input bar at top
- Main area: task list with title, due date badge, tag chips, URL card preview
- Task row: click to expand inline (notes, attachments, URL card)
- Mobile swipe: left = archive, right = move to active

**New Task Modal:**
- Title, notes, URL, due date picker, recurrence picker, tag multi-select with inline "Add New", file upload

**Search:**
- Top of main area, debounced FTS5 query
- Toggle to include archived tasks

**PWA:**
- `manifest.json` with `share_target` for text/URL sharing
- Service worker for offline app shell caching

## Testing

**Unit (Vitest):** Recurrence logic, NL prompt building, Vue composables, components.
**Integration (Vitest + Miniflare):** API routes against local D1/R2.
**E2E (Playwright):** Full browser flows — login, create task, NL input, swipe, search, file upload.

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| GOOGLE_CLIENT_ID | backend | OAuth |
| GOOGLE_CLIENT_SECRET | backend | OAuth |
| JWT_SECRET | backend | Sign session JWTs |

D1, R2, and Workers AI are configured as Wrangler bindings, not env vars.
