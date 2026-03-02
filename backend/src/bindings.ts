export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  AI: Ai;
  FRONTEND_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
}
