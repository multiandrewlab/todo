import { test, expect } from '@playwright/test';

test.describe('Task CRUD (requires auth)', () => {
  // These tests require authentication. They serve as a template
  // for when a test auth mechanism is in place.

  test.skip('create new task via modal', async ({ page }) => {
    await page.goto('/');
    await page.getByText('+ New Task').click();
    await page.getByPlaceholder('Task title').fill('Test task from E2E');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Test task from E2E')).toBeVisible();
  });

  test.skip('search filters tasks', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search tasks...').fill('Test');
    // Wait for debounce
    await page.waitForTimeout(400);
    await expect(page.getByText('Test task from E2E')).toBeVisible();
  });

  test.skip('navigate between views', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Active').click();
    await expect(page).toHaveURL(/\/active/);
    await page.getByText('Archived').click();
    await expect(page).toHaveURL(/\/archived/);
    await page.getByText('Inbox').click();
    await expect(page).toHaveURL(/\//);
  });
});
