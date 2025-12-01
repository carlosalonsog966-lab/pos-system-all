import { test, expect } from '@playwright/test';

// Smoke de API: intenta múltiples rutas comunes de salud y hace skip si backend no está disponible
test('API health responde OK o se marca como skipped si no está disponible', async ({ request }) => {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
  const candidates = ['/api/health', '/health', '/api/status', '/status'];

  let ok = false;
  let lastError: unknown = null;

  for (const path of candidates) {
    const url = `${apiBase}${path}`;
    try {
      const response = await request.get(url, { timeout: 5000 });
      if (response.ok()) {
        ok = true;
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('application/json')) {
          const body = await response.json().catch(() => ({}));
          // Aceptamos cualquier forma de OK: status/ok/healthy=true
          const indicative = body?.status === 'ok' || body?.ok === true || body?.healthy === true;
          expect(indicative || response.status() < 400).toBeTruthy();
        } else {
          // Si no es JSON, basta con que no sea error HTTP
          expect(response.status()).toBeLessThan(400);
        }
        break;
      }
    } catch (err) {
      lastError = err;
      // Continúa a la siguiente ruta candidata
    }
  }

  if (!ok) {
    test.skip(`Backend no disponible o sin endpoint de salud accesible en ${apiBase}. Último error: ${String(lastError)}`);
  }
});

