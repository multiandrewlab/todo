import PostalMime from 'postal-mime';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    // Stub — implemented in Task 17
    console.log(`Email received from ${message.from}`);
  },
};
