import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5176';

test.describe('Smoke E2E', () => {
  test('Carga index y presenta navegación básica', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/POS/i);
  });

  test('Login page accesible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const username = page.locator('input[name="username"]');
    const password = page.locator('input[name="password"]');
    await expect(username).toBeVisible();
    await expect(password).toBeVisible();
  });
});

