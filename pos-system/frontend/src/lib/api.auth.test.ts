import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { AxiosHeaders } from 'axios';

describe('API request interceptor - Authorization header', () => {
  beforeEach(() => {
    // Reset store entre pruebas
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
    // Habilitar mocks para no golpear red
    try {
      localStorage.setItem('observability:useMocks', 'true');
      localStorage.setItem('observability:backendOverride', 'ok');
    } catch {}
  });

  it('adjunta Authorization cuando existe token en el store', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    const { api, backendStatus } = await import('@/lib/api');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}

    const resp = await api.request({
      url: '/check-auth',
      method: 'get',
      adapter: async (c) => ({
        data: { success: true, data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: c as any,
      }) as any,
    });
    expect(resp.status).toBe(200);
    const auth = AxiosHeaders.from(resp.config.headers).get('Authorization');
    expect(auth).toBe('Bearer test-token');
  });

  it('no sobrescribe Authorization si ya viene en headers', async () => {
    useAuthStore.setState({ token: 'store-token', isAuthenticated: true });
    const { api, backendStatus } = await import('@/lib/api');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}
    const custom = 'Bearer custom-token';
    const resp = await api.request({
      url: '/check-auth',
      method: 'get',
      headers: { Authorization: custom },
      adapter: async (c) => ({
        data: { success: true, data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: c as any,
      }) as any,
    });
    const auth = AxiosHeaders.from(resp.config.headers).get('Authorization');
    expect(auth).toBe(custom);
  });
});
