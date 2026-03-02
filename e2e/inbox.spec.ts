import { test, expect } from '@playwright/test';

test.describe('Inbox', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Sign in with Google')).toBeVisible();
  });

  test('login page shows app name', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Muscat')).toBeVisible();
    await expect(page.getByText('Personal Task OS')).toBeVisible();
  });

  test('login page shows error for unauthorized users', async ({ page }) => {
    await page.goto('/login?error=unauthorized');
    await expect(page.getByText('not authorized')).toBeVisible();
  });
});
