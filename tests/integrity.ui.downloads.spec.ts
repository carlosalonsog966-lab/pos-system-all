import { test, expect } from '@playwright/test';
import { navigateTo } from './utils/navigation';

async function loginGetToken(request: any, apiBase: string): Promise<string | null> {
  try {
    const resp = await request.post(`${apiBase}/api/auth/login`, {
      data: { username: 'admin', password: 'admin' },
    });
    if (resp.ok()) {
      const json = await resp.json();
      const token = json?.token || json?.data?.token || null;
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

// Pruebas UI adicionales: Descargas en Observabilidad (PDF y verificado)
test.describe('UI Observabilidad - Descargas', () => {
  test('permite descargar PDF con encabezados de integridad', async ({ page, request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    let token = await loginGetToken(request, apiBase);
    if (!token) token = 'dummy-token';

    // Inyectar auth y backend OK
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
    }, token);

    // Añadir Authorization a /api/**
    await page.route('**/api/**', (route) => {
      const headers = { ...route.request().headers(), Authorization: `Bearer ${token}` };
      route.continue({ headers });
    });

    // Stub de PDF si backend no está accesible
    await page.route('**/api/files/integrity/export/pdf', async (route) => {
      const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'content-disposition': 'attachment; filename="files_integrity_test.pdf"',
          'x-integrity-verified': 'true',
          'x-checksum-match': 'true',
        },
        body: pdfBytes,
      });
    });

    // Navegar y entrar a Observabilidad
    await navigateTo(page, '/');
    const observabilidadLink = page.getByTestId('nav-observability');
    await expect(observabilidadLink).toBeVisible();
    await observabilidadLink.click();
    await page.waitForURL('**/observability*');

    const section = page.getByTestId('section-files-verification');
    await expect(section).toBeVisible();

    const btnPdf = page.getByTestId('btn-download-integrity-pdf');
    await expect(btnPdf).toBeVisible();
    await expect(btnPdf).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btnPdf.click(),
    ]);

    const suggested = download.suggestedFilename();
    expect(suggested.toLowerCase()).toContain('.pdf');
  });

  test('habilita descarga verificada con ID y muestra Integridad: OK', async ({ page, request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    let token = await loginGetToken(request, apiBase);
    if (!token) token = 'dummy-token';

    // Inyectar auth y backend OK
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
    }, token);

    await page.route('**/api/**', (route) => {
      const headers = { ...route.request().headers(), Authorization: `Bearer ${token}` };
      route.continue({ headers });
    });

    // Stub de descarga verificada por fileId
    await page.route('**/api/files/*/download', async (route) => {
      const headers = {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="file_test123.pdf"',
        'x-checksum-expected': 'abc123',
        'x-checksum-sha256': 'abc123',
        'x-checksum-match': 'true',
        'x-integrity-verified': 'true',
      };
      const body = Buffer.from('%PDF-1.4\n%stub');
      await route.fulfill({ status: 200, headers, body });
    });

    // Navegar a Observabilidad
    await navigateTo(page, '/');
    const observabilidadLink = page.getByTestId('nav-observability');
    await expect(observabilidadLink).toBeVisible();
    await observabilidadLink.click();
    await page.waitForURL('**/observability*');

    const inputId = page.getByTestId('input-file-id');
    const btnVerified = page.getByTestId('btn-download-verified');
    await expect(inputId).toBeVisible();
    await expect(btnVerified).toBeVisible();

    // Deshabilitado sin ID
    await expect(btnVerified).toBeDisabled();

    // Habilitar con ID y descargar
    await inputId.fill('test123');
    await expect(btnVerified).toBeEnabled();
    const [download2] = await Promise.all([
      page.waitForEvent('download'),
      btnVerified.click(),
    ]);
    const suggested2 = download2.suggestedFilename();
    expect(suggested2.toLowerCase()).toContain('test123');

    // Verifica feedback de integridad en UI
    const integrityBadge = page.getByText('Integridad: OK');
    await expect(integrityBadge).toBeVisible();
  });
});
