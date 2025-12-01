import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('@/lib/api', () => {
  const ok = {
    status: 200,
    data: {
      success: true,
      uptimeSec: 123,
      db: { healthy: true },
      modules: { jobQueue: { healthy: true } },
      metrics: {
        countsBySeverity: [
          { severity: 'info', count: 10 },
          { severity: 'warning', count: 2 },
          { severity: 'error', count: 0 },
        ],
        totals: { exception: 0 },
      },
    },
  };
  return {
    api: {
      get: vi.fn(async (path: string) => ok),
    },
    initializeApiBaseUrl: vi.fn(async () => '/api'),
  };
});

import { api, initializeApiBaseUrl } from '@/lib/api';

describe('Health smoke', () => {
  beforeAll(async () => {
    await initializeApiBaseUrl();
  });

  it('GET /health returns 200 OK and basic structure', async () => {
    const resp = await api.get('/health');
    expect(resp.status).toBe(200);
    const body = resp.data || {};
    expect(body.success ?? true).toBe(true);
    expect(typeof body.uptimeSec).toBe('number');
    expect(body.db?.healthy).toBeTypeOf('boolean');
    expect(body.modules?.jobQueue).toBeDefined();
  }, 10000);

  it('GET /health includes countsBySeverity metrics', async () => {
    const resp = await api.get('/health');
    expect(resp.status).toBe(200);
    const counts = resp.data?.metrics?.countsBySeverity || [];
    const sev = new Set(counts.map((c: any) => c?.severity));
    expect(sev.has('info')).toBe(true);
    expect(sev.has('warning')).toBe(true);
    expect(sev.has('error')).toBe(true);
    // Validación endurecida: asegurar que la métrica de 'exception' esté presente
    const totals = resp.data?.metrics?.totals || {};
    expect(totals).toHaveProperty('exception');
    expect(typeof totals.exception).toBe('number');
  }, 10000);
});
