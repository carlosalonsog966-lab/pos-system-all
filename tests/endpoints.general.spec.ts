import { test, expect } from '@playwright/test';

test.describe('Endpoints General (exports)', () => {
  const baseUrl = 'http://localhost:8081/endpoints.html';

  test('carga y muestra controles esperados', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await expect(page.locator('header h1')).toContainText(/Índice de Endpoints API/i);

    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('#module')).toBeVisible();
    await expect(page.locator('#method')).toBeVisible();
    await expect(page.locator('#dir')).toBeVisible();

    await expect(page.locator('#copyLink')).toBeVisible();
    await expect(page.locator('#exportCsv')).toBeVisible();
    await expect(page.locator('#exportJsonl')).toBeVisible();
    await expect(page.locator('table#table')).toBeVisible();
  });

  test('selector de dirección actualiza hash y refleja estado', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const dirSelect = page.locator('#dir');
    await expect(dirSelect).toBeVisible();

    await dirSelect.selectOption('desc');
    await expect(page).toHaveURL(/dir=desc/);
    await expect(dirSelect).toHaveValue('desc');

    await dirSelect.selectOption('asc');
    await expect(page).not.toHaveURL(/dir=desc/);
    await expect(dirSelect).toHaveValue('asc');
  });

  test('exportaciones filtradas CSV y JSONL descargan archivos', async ({ page }) => {
    await page.goto(`${baseUrl}#method=GET&dir=asc`, { waitUntil: 'domcontentloaded' });

    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportCsv'),
    ]);
    const csvName = await csvDownload.suggestedFilename();
    expect(csvName).toBe('endpoints.filtered.csv');

    const [jsonlDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportJsonl'),
    ]);
    const jsonlName = await jsonlDownload.suggestedFilename();
    expect(jsonlName).toBe('endpoints.filtered.jsonl');
  });

  test('orden asc/desc invierte primera y última ruta', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const dirSelect = page.locator('#dir');
    await expect(dirSelect).toBeVisible();

    // Ascendente
    await dirSelect.selectOption('asc');
    await expect(dirSelect).toHaveValue('asc');
    const firstAsc = (await page.locator('#rows tr').first().locator('code').textContent())?.trim();
    const lastAsc = (await page.locator('#rows tr').last().locator('code').textContent())?.trim();
    expect(firstAsc && lastAsc).toBeTruthy();

    // Descendente
    await dirSelect.selectOption('desc');
    await expect(page).toHaveURL(/dir=desc/);
    await expect(dirSelect).toHaveValue('desc');
    const firstDesc = (await page.locator('#rows tr').first().locator('code').textContent())?.trim();
    const lastDesc = (await page.locator('#rows tr').last().locator('code').textContent())?.trim();

    // Verificar inversión
    expect(firstDesc).toBe(lastAsc);
    expect(lastDesc).toBe(firstAsc);
  });
});
