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
