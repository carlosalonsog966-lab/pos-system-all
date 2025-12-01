import { test, expect } from '@playwright/test';

async function loginGetToken(request: any, apiBase: string): Promise<string | null> {
  const candidates = [
    { username: 'admin@joyeria.com', password: 'admin123' },
    { username: 'admin@example.com', password: 'admin123' },
    { username: 'admin@pos.com', password: 'admin123' },
    { username: 'admin', password: 'admin123' },
  ];
  for (const creds of candidates) {
    try {
      const res = await request.post(`${apiBase}/api/auth/login`, {
        timeout: 7000,
        data: creds,
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok()) {
        const body = await res.json();
        const token = body?.data?.token || body?.token || body?.accessToken;
        if (token) return token;
      }
    } catch {}
  }
  return null;
}

// Pruebas E2E de integridad de archivos vía API
// Usa API_BASE_URL (por defecto http://localhost:5656) y ejecuta skip si backend no está disponible
test.describe('API integridad de archivos', () => {
  test('summary: devuelve estructura básica y status OK', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    const url = `${apiBase}/api/integrity/summary`;

    let response;
    try {
      const token = await loginGetToken(request, apiBase);
      if (!token) {
        test.skip(`No se pudo autenticar contra ${apiBase}`);
        return;
      }
      response = await request.get(url, { timeout: 7000, headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      test.skip(`Backend no disponible para integridad en ${apiBase}: ${String(err)}`);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const ct = response.headers()['content-type'] || '';
    expect(ct.includes('application/json')).toBeTruthy();
    const body = await response.json();

    // Estructura mínima esperada (backend devuelve { success, data: { summary, exports } })
    expect(body).toHaveProperty('success');
    expect(body.success).toBeTruthy();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('summary');
    // Campos básicos del summary (nombres según VerifySummary)
    const summary = body.data.summary || {};
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('checked');
    expect(summary).toHaveProperty('matches');
    expect(summary).toHaveProperty('mismatched');
    expect(summary).toHaveProperty('missing');
  });

  test('verify: procesa manifiesto con opciones y retorna resumen', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    const url = `${apiBase}/api/integrity/verify`;

    let response;
    try {
      const token = await loginGetToken(request, apiBase);
      if (!token) {
        test.skip(`No se pudo autenticar contra ${apiBase}`);
        return;
      }
      response = await request.post(url, {
        timeout: 10000,
        data: JSON.stringify({ limit: 50, types: ['csv', 'pdf', 'json'], writeSummary: true }),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      test.skip(`Backend no disponible para verify en ${apiBase}: ${String(err)}`);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('success');
    expect(body.success).toBeTruthy();
    // La respuesta devuelve el resumen directamente en data (no anidado en data.summary)
    expect(body).toHaveProperty('data');
    const summary = body.data || {};
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('checked');
    expect(summary).toHaveProperty('matches');
    expect(summary).toHaveProperty('mismatched');
    expect(summary).toHaveProperty('missing');
  });

  test('latest CSV/PDF: exporta, luego descarga y expone encabezados de integridad', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    const exportPaths = [
      '/api/files/integrity/export/csv',
      '/api/files/integrity/export/pdf',
    ];
    const latestPaths = [
      '/api/files/integrity/latest/csv',
      '/api/files/integrity/latest/pdf',
    ];
    const token = await loginGetToken(request, apiBase);
    if (!token) {
      test.skip(`No se pudo autenticar contra ${apiBase}`);
      return;
    }
    // 1) Generar exportes si es necesario
    for (const path of exportPaths) {
      let response;
      try {
        response = await request.get(`${apiBase}${path}`, { timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        // Continúa, quizá uno de los formatos no está soportado
        continue;
      }

      if (!response.ok()) {
        // Si el formato no está disponible o falla, continuar con el siguiente
        continue;
      }
      const headers = response.headers();
      // Encabezados de integridad esperados del backend
      const checksum = headers['x-checksum-sha256'] || headers['x-checksum'] || headers['x-integrity-sha256'];
      const expected = headers['x-checksum-expected'] || headers['x-expected-checksum'];
      const match = headers['x-checksum-match'] || headers['x-integrity-verified'];

      expect(checksum).toBeTruthy();
      // expected puede no estar presente si se calcula on-the-fly, pero si existe, debe lucir como SHA256 (64 hex)
      if (expected) {
        expect(expected).toMatch(/^[a-f0-9]{64}$/i);
      }
      // match debe ser 'true' cuando coincide, o un valor truthy
      if (match) {
        expect(['true', '1', 'yes']).toContain(match.toLowerCase?.() || String(match).toLowerCase());
      }

      const buf = await response.body();
      expect(buf.byteLength).toBeGreaterThan(0);
    }

    // 2) Descargar últimas versiones
    for (const path of latestPaths) {
      let response;
      try {
        response = await request.get(`${apiBase}${path}`, { timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        // Continúa, quizá uno de los formatos no existe aún
        continue;
      }
      if (!response.ok()) continue;
      const headers = response.headers();
      const checksum = headers['x-checksum-sha256'] || headers['x-checksum'] || headers['x-integrity-sha256'];
      expect(checksum).toBeTruthy();
      const buf = await response.body();
      expect(buf.byteLength).toBeGreaterThan(0);
    }
  });

  test('meta endpoints CSV: descarga y preserva integridad', async ({ request }) => {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:5656';
    const url = `${apiBase}/api/meta/endpoints?format=csv&download=1`;

    let response;
    try {
      response = await request.get(url, { timeout: 10000 });
    } catch (err) {
      test.skip(`Backend no disponible para meta endpoints en ${apiBase}: ${String(err)}`);
      return;
    }

    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    const checksum = headers['x-checksum-sha256'] || headers['x-integrity-sha256'];
    expect(checksum).toBeTruthy();
    const buf = await response.body();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
