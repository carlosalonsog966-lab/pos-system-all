import { test, expect } from '@playwright/test';

test.describe('Status Dashboard Smoke', () => {
  test('index.html carga y expone enlaces a endpoints', async ({ page }) => {
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
    await expect(page.locator('header h1')).toContainText(/Dashboard API/i);

    // Enlaces hacia endpoints (puede haber más de uno: nav y descargas)
    await expect(page.locator('a[href$="endpoints.html"]').first()).toBeVisible();

    await expect(page.locator('a[href$="endpoints.yaml"]').first()).toBeVisible();
    await expect(page.locator('a[href$="endpoints.csv"]').first()).toBeVisible();
    await expect(page.locator('a[href$="endpoints.jsonl"]').first()).toBeVisible();

    // Bloque de Descargas rápidas presente
    const downloadsSection = page.locator('[data-testid="downloads-quick"]');
    await expect(downloadsSection).toBeVisible();
    // Debe listar enlaces de descargas con data-testid prefijado "dl-"
    const downloadLinks = page.locator('[data-testid^="dl-"]');
    await expect(downloadLinks.first()).toBeVisible();

    // Accesos directos disponibles
    const ql = page.locator('[data-testid="quick-links"]');
    await expect(ql).toBeVisible();
    await expect(ql.getByTestId('ql-get')).toBeVisible();
  });

  test('endpoints.html carga y contiene contenido', async ({ page }) => {
    await page.goto('http://localhost:8080/endpoints.html', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/Índice de Endpoints/i);
    await expect(page.locator('table')).toBeVisible();
  });

  test('navegación por hash: Acceso directo GET aplica filtro y copia enlace', async ({ page }) => {
    // Ir al dashboard y abrir acceso directo GET en nueva pestaña
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' });
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByTestId('ql-get').click()
    ]);
    await newPage.waitForLoadState('domcontentloaded');

    // Debe contener hash con método GET
    const url = newPage.url();
    expect(url).toMatch(/#(GET|method=GET)/);

    // Debe tener botón copiar enlace y funcionar
    const btnCopy = newPage.getByTestId('btn-copy-link');
    await expect(btnCopy).toBeVisible();
    await btnCopy.click();
  });

  test('endpoints: selector de dirección afecta orden y se refleja en hash', async ({ page }) => {
    await page.goto('http://localhost:8080/endpoints.html', { waitUntil: 'networkidle' });
    // Asegurar controles visibles
    const sortSelect = page.locator('#sort');
    const dirSelect = page.locator('#dir');
    await expect(sortSelect).toBeVisible();
    await expect(dirSelect).toBeVisible();

    // Forzar orden por ruta ascendente
    await sortSelect.selectOption('path');
    await dirSelect.selectOption('asc');

    // Cambiar a descendente y validar que cambie el primer elemento
    await dirSelect.selectOption('desc');
    // Esperar a que el hash refleje la dirección
    await expect(page).toHaveURL(/dir=desc/);
    // Asegurar que el selector esté en descendente
    await expect(dirSelect).toHaveValue('desc');

    // Copiar enlace y verificar que incluya dir=desc
    const btnCopy = page.getByTestId('btn-copy-link');
    await expect(btnCopy).toBeVisible();
    await btnCopy.click();
    const url = page.url();
    expect(url).toMatch(/dir=desc/);
  });

  test('endpoints: exportaciones filtradas CSV y JSONL descargan archivos', async ({ page }) => {
    await page.goto('http://localhost:8080/endpoints.html', { waitUntil: 'networkidle' });
    // Asegurar botones visibles
    const btnCsv = page.getByTestId('btn-export-csv');
    const btnJsonl = page.getByTestId('btn-export-jsonl');
    await expect(btnCsv).toBeVisible();
    await expect(btnJsonl).toBeVisible();

    // Disparar descarga CSV
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      btnCsv.click(),
    ]);
    const csvName = await csvDownload.suggestedFilename();
    expect(csvName).toMatch(/endpoints\.filtered\.csv/);

    // Disparar descarga JSONL
    const [jsonlDownload] = await Promise.all([
      page.waitForEvent('download'),
      btnJsonl.click(),
    ]);
    const jsonlName = await jsonlDownload.suggestedFilename();
    expect(jsonlName).toMatch(/endpoints\.filtered\.jsonl/);
  });
});
