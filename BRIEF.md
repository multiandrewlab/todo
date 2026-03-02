# Project Brief: Cloudflare-Native Personal Task OS

## 1. Context & Goal
Build a serverless, highly optimized Personal Task Management Progressive Web App (PWA) hosted entirely on the Cloudflare ecosystem. The app focuses on zero-friction capture via Natural Language, an inbound Email-to-Task pipeline, and the Web Share Target API.

## 2. Tech Stack & Infrastructure
*   **Monorepo:** Standard Vite/Hono split (`/frontend` and `/backend`).
*   **Frontend:** Vue, Vite, TypeScript, Tailwind CSS, `vite-plugin-pwa`. Hosted on Cloudflare Pages.
*   **Backend API:** Cloudflare Workers using the **Hono** framework.
*   **Database:** Cloudflare D1 (Serverless SQLite).
*   **Storage:** Cloudflare R2 (for task attachments and inbound email attachments).
*   **AI:** Cloudflare Workers AI strictly using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
*   **Email Ingestion:** Cloudflare Email Workers (using a library like `postal-mime` to parse raw emails).

## 3. Security & Authentication
*   **Web UI / API Auth:** Implement Google OAuth. **Strict constraint:** Only allow login for exactly one email address per user, OG user set to: `andrew.hunt@fundamentalmedia.com`.
*   **Email Pipeline Allowlist:** The Email Worker must silently drop/reject any inbound emails UNLESS the sender (`From` address) is exactly to the emails set in the user settings, OG user set to:
    1. `andrew.hunt@fundamentalmedia.com`
    2. `andy@mrhunt.co.uk`
    3. `ahunt83@gmail.com`

## 4. Core Business Logic & Constraints
*   **Dates & Status:** Due dates ONLY (stored as `YYYY-MM-DD`, no times). No push notifications. 
*   **Archive Only:** No hard deletes. Completed tasks are marked `status = 'archived'`.
*   **Recurring Tasks:** When a recurring task (e.g., 'daily', 'weekly') is archived, generate the next occurrence based strictly on the **original due date**, NOT the date it was archived.
*   **Natural Language Input:** A text input in the UI for commands (e.g., *"Call Andy next week #urgent"*). The backend passes this to Llama 3.3 to output strict JSON. **Constraint:** This must NOT auto-save the task. It must pre-fill the "New Task" UI form so the user can review it before saving.
*   **Tags:** Predefined tag list using a select/dropdown UI. **Constraint:** The dropdown must have an inline "Add New" option so users can create a new tag without leaving the form or losing context.
*   **Link Previews:** A dedicated `url` field on tasks. When saved, a backend process must fetch the target URL's `<title>` and `<link rel="icon">` (favicon), saving them to the DB to display a rich visual card in the UI.

## 5. UI/UX & Mobile Requirements
*   **PWA:** Must be installable. Implement the **Web Share Target API** in the manifest so the user can share text/URLs directly from their phone's browser into the app's Inbox.
*   **Views:** A dedicated "Inbox" view for unprocessed tasks, plus standard date-sorted views.
*   **Gestures & Layout:** Implement mobile swipe gestures (e.g., swipe left to archive). Task notes must be hidden behind an expandable/collapsible toggle to keep the list clean. 
*   **Attachments:** UI must support uploading/downloading files attached to tasks (backed by presigned URLs from R2).
*   **Search:** Full-text search functionality across task titles, notes, and tags.

## 6. Database Schema (Cloudflare D1 SQLite)
Use exactly this schema as the source of truth:
```sql
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
    status TEXT DEFAULT 'inbox', -- 'inbox', 'active', 'archived'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE task_tags (
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
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
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    setting_name TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);