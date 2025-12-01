import { describe, it, expect, beforeEach } from 'vitest';

describe('API circuito y caché', () => {
  beforeEach(() => {
    try {
      localStorage.setItem('observability:backendOverride', 'ok');
      localStorage.setItem('observability:useMocks', 'true');
    } catch {}
  });

  it('rechaza GET sin caché cuando backend está caído', async () => {
    const { api, backendStatus } = await import('@/lib/api');
    const { AxiosError } = await import('axios');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('down'); } catch {}
    await expect(api.get('/foo')).rejects.toMatchObject({ code: 'ERR_CIRCUIT_OPEN' } as Partial<AxiosError>);
  });

  it('sirve caché cuando backend está caído y x-cache-permit=1', async () => {
    const { api, backendStatus } = await import('@/lib/api');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}
    const first = await api.get('/settings/public', { headers: { 'x-cache-permit': '1' } });
    expect(first.status).toBe(200);
    try { localStorage.setItem('observability:useMocks', 'false'); } catch {}
    try { backendStatus.applyOverride('down'); } catch {}
    const cached = await api.get('/settings/public', { headers: { 'x-cache-permit': '1' } });
    expect(String(cached.statusText)).toContain('cached');
  });
});