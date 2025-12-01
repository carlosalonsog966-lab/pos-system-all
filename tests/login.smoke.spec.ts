import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

test('login: la pantalla de login se renderiza', async ({ page }) => {
  await navigateTo(page, '/#/login?tm=1');
  await expect(page.getByPlaceholder('Ingresa tu usuario')).toBeVisible();
  await expect(page.getByPlaceholder('Ingresa tu contraseña')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
});
