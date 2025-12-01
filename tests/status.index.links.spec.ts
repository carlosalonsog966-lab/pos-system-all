import { test, expect } from '@playwright/test';

test.describe('Status Index enlaces rápidos', () => {
  const indexUrl = 'http://localhost:8080/index.html';

  test('enlace rápido GET abre endpoints con method=GET', async ({ page }) => {
    await page.goto(indexUrl, { waitUntil: 'networkidle' });
    const link = page.locator('[data-testid="ql-get"]');
    await expect(link).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      link.click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(/endpoints\.html#(GET|method=GET)/);

    const methodSelect = popup.locator('#method');
    await expect(methodSelect).toHaveValue('GET');
  });

  test('enlace GET+texto clientes sincroniza method y q', async ({ page }) => {
    await page.goto(indexUrl, { waitUntil: 'networkidle' });
    const link = page.locator('[data-testid="ql-get-clientes"]');
    await expect(link).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      link.click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(/endpoints\.html#.*method=GET.*q=clientes/);

    const methodSelect = popup.locator('#method');
    const qInput = popup.locator('#q');
    await expect(methodSelect).toHaveValue('GET');
    await expect(qInput).toHaveValue(/clientes/i);
  });
});
