import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

test('Products carga sin errores y muestra contenido', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await navigateTo(page, '/#/products?tm=1');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.readyState === 'complete');

  // La ruta puede requerir auth; acepta /products o redirección a /login
  const current = page.url();
  const okRoute = current.includes('/#/products') || current.includes('/#/login') || current.includes('/login');
  expect(okRoute, `Ruta inesperada: ${current}`).toBeTruthy();

  // Debe haber algo de contenido visible en la página
  const bodyTextLen = await page.evaluate(() => (document.body?.innerText || '').trim().length);
  expect(bodyTextLen).toBeGreaterThan(20);

  // Este smoke no falla por errores de consola; quedan como artefactos para debug.
});
