import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

test('console: no errores al cargar la app', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await navigateTo(page, '/');
  await expect(page.locator('body')).toBeVisible();
  expect(errors, 'No debe haber errores de consola').toHaveLength(0);
});
