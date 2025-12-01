import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

test('smoke: la aplicación carga y muestra contenido', async ({ page }) => {
  await navigateTo(page, '/');
  await expect(page.locator('body')).toBeVisible();
});
