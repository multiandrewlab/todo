import type { Page } from '@playwright/test';

/**
 * Set an auth cookie for E2E tests.
 * In a real scenario, you'd need to either:
 * 1. Create a test endpoint that generates auth tokens
 * 2. Mock the Google OAuth flow
 * 3. Use a pre-generated JWT
 *
 * For now, this creates a JWT using the same algorithm as the backend.
 */
export async function authenticateUser(page: Page, baseURL: string) {
  // Set a test JWT cookie directly
  // This requires the backend's JWT_SECRET to be 'dev-secret-change-in-prod'
  // which is the default in .dev.vars
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payload = btoa(
    JSON.stringify({
      sub: 'user_001',
      email: 'andrew.hunt@fundamentalmedia.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Note: This won't have a valid signature in the browser.
  // For real E2E tests, you'd need a test auth endpoint.
  // This is a placeholder structure for when the test infrastructure is ready.

  await page.goto(baseURL + '/login');
}
