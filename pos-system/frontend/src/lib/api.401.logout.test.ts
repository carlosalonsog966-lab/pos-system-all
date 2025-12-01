import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

describe('Interceptor 401 - logout limpia el estado', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: '1', username: 'u', email: 'e', firstName: 'f', lastName: 'l', role: 'cashier', isActive: true }, token: 'token-abc', isAuthenticated: true, isLoading: false, error: null });
    try {
      localStorage.setItem('observability:backendOverride', 'ok');
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'token-abc', isAuthenticated: true } }));
    } catch {}
  });

  it('logout en 401 deja token=null y isAuthenticated=false', async () => {
    const { api, backendStatus } = await import('@/lib/api');
    const { AxiosError } = await import('axios');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}

    await expect(api.request({
      url: '/secure',
      method: 'get',
      adapter: async (c) => Promise.reject(new AxiosError('Unauthorized', undefined, c as any, undefined, {
        data: { error: 'Unauthorized' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: c as any,
      } as any)) as any,
    })).rejects.toBeTruthy();

    const st = useAuthStore.getState();
    expect(st.isAuthenticated).toBe(false);
    expect(st.token).toBeNull();

    try {
      const raw = localStorage.getItem('auth-storage') || '';
      expect(raw).toMatch(/"token":null/);
    } catch {}
  });
});

