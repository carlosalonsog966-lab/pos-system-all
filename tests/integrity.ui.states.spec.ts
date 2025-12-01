import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

// Pruebas UI: Estados habilitado/deshabilitado mediante Override del backend y fileId
test.describe('UI Observabilidad - Estados', () => {
  test('CSV y PDF deshabilitados cuando backend está DOWN', async ({ page }) => {
    // Inyectar estado de autenticación antes de cargar la app
    await page.addInitScript((tkn: string) => {
      const defaultUser = {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      };
      const persisted = { state: { token: tkn, isAuthenticated: true, user: defaultUser } };
      try { localStorage.setItem('auth-storage', JSON.stringify(persisted)); } catch {}
      try { localStorage.setItem('observability:backendOverride', 'down'); } catch {}
    }, 'dummy-token');

    await navigateTo(page, '/');
    const observabilidadLink = page.getByTestId('nav-observability');
    await expect(observabilidadLink).toBeVisible();
    await observabilidadLink.click();
    await page.waitForURL('**/observability*');

    // Aplicar Override vía combobox y esperar banner DOWN
    const overrideSelect = page.getByRole('combobox', { name: 'Override:' });
    await expect(overrideSelect).toBeVisible();
    await overrideSelect.selectOption('down');
    await expect(page.getByText(/Backend\s+DOWN/i)).toBeVisible({ timeout: 8000 });

    const section = page.getByTestId('section-files-verification');
    await expect(section).toBeVisible();
    const btnCsv = page.getByTestId('btn-download-integrity-csv');
    const btnPdf = page.getByTestId('btn-download-integrity-pdf');
    const btnVerified = page.getByTestId('btn-download-verified');

    await expect(btnCsv).toBeDisabled();
    await expect(btnPdf).toBeDisabled();
    await expect(btnVerified).toBeDisabled();
  });

  test('CSV/PDF habilitados cuando backend UP; verificado habilita con fileId', async ({ page }) => {
    // Inyectar estado de autenticación antes de cargar la app
    await page.addInitScript((tkn: string) => {
      const defaultUser = {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      };
      const persisted = { state: { token: tkn, isAuthenticated: true, user: defaultUser } };
      try { localStorage.setItem('auth-storage', JSON.stringify(persisted)); } catch {}
      try { localStorage.setItem('observability:backendOverride', 'ok'); } catch {}
    }, 'dummy-token');

    await navigateTo(page, '/');
    const observabilidadLink = page.getByTestId('nav-observability');
    await expect(observabilidadLink).toBeVisible();
    await observabilidadLink.click();
    await page.waitForURL('**/observability*');

    // Aplicar Override vía combobox y esperar banner UP
    const overrideSelect = page.getByRole('combobox', { name: 'Override:' });
    await expect(overrideSelect).toBeVisible();
    await overrideSelect.selectOption('ok');
    await expect(page.getByText(/Backend\s+UP/i)).toBeVisible({ timeout: 8000 });

    const section = page.getByTestId('section-files-verification');
    await expect(section).toBeVisible();
    const btnCsv = page.getByTestId('btn-download-integrity-csv');
    const btnPdf = page.getByTestId('btn-download-integrity-pdf');
    const inputId = page.getByTestId('input-file-id');
    const btnVerified = page.getByTestId('btn-download-verified');

    await expect(btnCsv).toBeEnabled();
    await expect(btnPdf).toBeEnabled();
    await expect(btnVerified).toBeDisabled();

    await inputId.fill('abc123');
    await expect(btnVerified).toBeEnabled();
  });
});
