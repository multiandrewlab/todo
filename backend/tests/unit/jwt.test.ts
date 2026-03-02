import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from '../../src/lib/jwt.js';

describe('JWT', () => {
  const secret = 'test-secret';

  it('creates and verifies a token', async () => {
    const payload = { sub: 'user_001', email: 'test@example.com' };
    const token = await createToken(payload, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

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
    const token = await createToken(payload, secret, -1); // already expired
    await expect(verifyToken(token, secret)).rejects.toThrow();
  });

  it('includes expiration in token', async () => {
    const payload = { sub: 'user_001', email: 'test@example.com' };
    const token = await createToken(payload, secret, 3600);
    const decoded = await verifyToken(token, secret);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
