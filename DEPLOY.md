# Deployment Guide

## Prerequisites
- Cloudflare account with Workers, D1, R2, and Workers AI enabled
- Google Cloud project with OAuth 2.0 credentials
- wrangler CLI authenticated (`wrangler login`)

## Steps

### 1. Create Cloudflare resources
```bash
# Create D1 database
wrangler d1 create muscat-db
# Note the database_id from output

# Create R2 bucket
wrangler r2 bucket create muscat-attachments
```

### 2. Update wrangler configs
Update `database_id` in both:
- `backend/wrangler.toml`
- `email-worker/wrangler.toml`

### 3. Set secrets
```bash
cd backend
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

### 4. Run migrations
```bash
cd backend
pnpm db:migrate:remote
```

### 5. Deploy
```bash
# Backend API
cd backend && pnpm deploy

# Email worker
cd email-worker && pnpm deploy

# Frontend (Cloudflare Pages)
cd frontend && pnpm build
npx wrangler pages deploy dist --project-name=muscat
```

### 6. Configure Google OAuth
Add your deployed backend URL as an authorized redirect URI:
`https://your-worker.workers.dev/api/v1/auth/callback`

### 7. Configure Email Routing
In Cloudflare dashboard, set up Email Routing to forward emails to the email worker.

## Local Development
```bash
# Start both backend and frontend
pnpm dev

# Backend only
pnpm --filter @muscat/backend dev

# Frontend only
pnpm --filter @muscat/frontend dev

# Run backend tests
pnpm --filter @muscat/backend test

# Run shared tests
pnpm --filter @muscat/shared test
```
