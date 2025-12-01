import { describe, it, expect } from 'vitest';

describe('API deduplicación de GET', () => {
  it('dos GET idénticos comparten la misma promesa (adapter llamado una vez)', async () => {
    const { api, backendStatus } = await import('@/lib/api');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}
    let calls = 0;
    const adapter = async (c: any) => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      return {
        data: { success: true, data: { msg: 'ok' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: c,
      } as any;
    };
    const p1 = api.get('/dedup', { adapter });
    const p2 = api.get('/dedup', { adapter });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data.data.msg).toBe('ok');
    expect(r2.data.data.msg).toBe('ok');
    expect(calls).toBe(1);
  });
});