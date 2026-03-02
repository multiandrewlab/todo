# Muscat

A Cloudflare-native personal task management PWA. Built with Vue 3, Hono, D1, R2, Workers AI, and Email Workers.

## Architecture

```
muscat/
  frontend/       Vue 3 + Vite + Tailwind CSS 4 + PWA (Cloudflare Pages)
  backend/        Hono on Cloudflare Workers (API + D1 + R2 + Workers AI)
  email-worker/   Cloudflare Email Worker (email-to-task ingestion)
  shared/         Shared TypeScript types and recurrence logic
```

**Stack:** pnpm monorepo, TypeScript throughout, Vitest + Playwright for testing.

**Cloudflare services:** Workers (API), D1 (SQLite database), R2 (file attachments), Workers AI (natural language parsing with Llama 3.3 70B), Email Workers (inbound email-to-task).

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI (`npm install -g wrangler`)
- A Google Cloud project with OAuth 2.0 credentials (for authentication)

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

The backend reads secrets from `backend/.dev.vars` for local development. The file ships with placeholders:

```env
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
JWT_SECRET=dev-secret-change-in-prod
```

To test Google OAuth locally, replace `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with real values from your [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Add `http://localhost:5173/api/v1/auth/callback` as an authorized redirect URI.

For local development without OAuth, you can use the app with the test JWT cookie approach used in the test suite.

### 3. Set up the local database

```bash
pnpm --filter @muscat/backend db:migrate:local
```

This creates a local D1 database and runs all migrations (schema + seed data).

### 4. Start the dev servers

```bash
pnpm dev
```

This starts both servers concurrently:
- **Frontend:** http://localhost:5173 (Vite dev server with HMR)
- **Backend:** http://localhost:8787 (Wrangler local Workers runtime)

The frontend proxies all `/api` requests to the backend automatically.

To start them individually:

```bash
# Backend only
pnpm --filter @muscat/backend dev

# Frontend only
pnpm --filter @muscat/frontend dev
```

### 5. Run tests

```bash
# All tests (backend + shared + email-worker)
pnpm test

# Backend only (62 integration + 16 unit + 20 security tests)
pnpm --filter @muscat/backend test

# Watch mode
pnpm --filter @muscat/backend test:watch

# Shared library only (15 recurrence logic tests)
pnpm --filter @muscat/shared test

# Email worker only (3 tests)
pnpm --filter @muscat/email-worker test

# E2E tests (requires both servers running)
pnpm test:e2e

# Type checking
pnpm typecheck
```

## Production Deployment

### 1. Create Cloudflare resources

```bash
# Create D1 database
wrangler d1 create muscat-db
# Note the database_id from the output

# Create R2 bucket
wrangler r2 bucket create muscat-attachments
```

### 2. Update wrangler configs

Set the `database_id` from step 1 in both files:

**`backend/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "muscat-db"
database_id = "<YOUR_DATABASE_ID>"
```

**`email-worker/wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "muscat-db"
database_id = "<YOUR_DATABASE_ID>"
```

Also update `FRONTEND_URL` in `backend/wrangler.toml` to your production frontend URL:
```toml
[vars]
FRONTEND_URL = "https://muscat.your-domain.com"
```

### 3. Set production secrets

```bash
cd backend
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

Use a strong random string for `JWT_SECRET` (e.g., `openssl rand -base64 32`).

### 4. Run database migrations

```bash
cd backend
pnpm db:migrate:remote
```

### 5. Deploy

```bash
# Backend API worker
cd backend && pnpm deploy

# Email worker
cd email-worker && pnpm deploy

# Frontend (Cloudflare Pages)
cd frontend && pnpm build
npx wrangler pages deploy dist --project-name=muscat
```

### 6. Configure Google OAuth

In your [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add the deployed backend callback URL as an authorized redirect URI:

```
https://muscat-api.<your-subdomain>.workers.dev/api/v1/auth/callback
```

### 7. Configure Email Routing

In the [Cloudflare dashboard](https://dash.cloudflare.com/), set up Email Routing on your domain to forward inbound emails to the `muscat-email-worker` worker. Any email sent to your configured address (e.g., `tasks@your-domain.com`) will be parsed and added as a task to the sender's inbox, provided the sender is on the user's email allowlist.

### 8. Seed your user

Edit `backend/migrations/0002_seed_initial_user.sql` with your email and allowlist before running migrations, or insert directly:

```sql
INSERT INTO users (id, email) VALUES ('user_001', 'you@example.com');
INSERT INTO user_settings (user_id, setting_name, setting_value)
VALUES ('user_001', 'email_allowlist', '["you@example.com"]');
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/auth/login` | Redirect to Google OAuth |
| `GET` | `/api/v1/auth/callback` | OAuth callback |
| `POST` | `/api/v1/auth/logout` | Clear auth cookie |
| `GET` | `/api/v1/auth/me` | Current user info |
| `GET` | `/api/v1/tasks` | List tasks (filters: `status`, `search`, `due_before`, `due_after`, `include_archived`, `limit`, `offset`) |
| `POST` | `/api/v1/tasks` | Create task |
| `GET` | `/api/v1/tasks/:id` | Get task with tags and attachments |
| `PUT` | `/api/v1/tasks/:id` | Update task |
| `POST` | `/api/v1/tasks/:id/archive` | Archive task (creates next occurrence if recurring) |
| `GET` | `/api/v1/tags` | List tags |
| `POST` | `/api/v1/tags` | Create tag |
| `PUT` | `/api/v1/tags/:id` | Update tag |
| `POST` | `/api/v1/tasks/:taskId/attachments` | Upload file (100MB limit) |
| `GET` | `/api/v1/tasks/:taskId/attachments/:id/download` | Download file |
| `DELETE` | `/api/v1/tasks/:taskId/attachments/:id` | Delete file |
| `POST` | `/api/v1/ai/parse` | Natural language to task fields |
| `GET` | `/api/v1/settings` | List user settings |
| `PUT` | `/api/v1/settings/:name` | Update setting |
| `GET` | `/api/v1/share-target` | Web Share Target (creates inbox task) |

## Project Structure

```
backend/
  src/
    index.ts              Main Hono app, mounts all routes
    bindings.ts           Env and AppEnv type definitions
    middleware/auth.ts     JWT cookie verification middleware
    routes/
      auth.ts             Google OAuth flow
      tasks.ts            Task CRUD + archive + recurrence
      tags.ts             Tag CRUD
      attachments.ts      File upload/download via R2
      ai.ts               Workers AI NL parsing endpoint
      settings.ts         User settings CRUD
      share.ts            Web Share Target handler
    services/
      nl-parser.ts        Llama 3.3 prompt + response parsing
      link-preview.ts     URL title/favicon extraction
    lib/
      jwt.ts              HMAC-SHA256 JWT via Web Crypto API
      id.ts               Prefixed ID generation
  migrations/
    0001_initial_schema.sql
    0002_seed_initial_user.sql
  tests/
    unit/                 JWT, link preview, NL parser tests
    integration/          Full API integration tests per route

frontend/
  src/
    components/           Vue SFCs (AppLayout, TaskRow, TaskModal, etc.)
    composables/          useAuth, useTasks
    api/client.ts         Typed fetch wrapper
    views/                Inbox, Active, Archived, Settings views
    router/               Vue Router config

email-worker/
  src/index.ts            Email handler with allowlist + postal-mime

shared/
  src/
    types.ts              All shared TypeScript interfaces
    recurrence.ts         getNextOccurrence() with full recurrence support
```

## License

Private project.
