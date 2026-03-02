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
