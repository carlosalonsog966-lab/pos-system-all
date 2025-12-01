import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

describe('Interceptor respuesta 401 - redirección SPA', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: '1', username: 'u', email: 'e', firstName: 'f', lastName: 'l', role: 'cashier', isActive: true }, token: 't', isAuthenticated: true, isLoading: false, error: null });
    try {
      localStorage.setItem('observability:backendOverride', 'ok');
    } catch {}
  });

  it('emite evento auth:redirect en 401', async () => {
    const { api, backendStatus } = await import('@/lib/api');
    try { backendStatus.stopPolling(); } catch {}
    try { backendStatus.applyOverride('ok'); } catch {}

    let redirectedTo: string | null = null;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ path?: string }>;
      redirectedTo = ev.detail?.path || null;
    };
    window.addEventListener('auth:redirect', handler as EventListener);

    const { AxiosError } = await import('axios');
    await expect(api.request({
      url: '/secure',
      method: 'get',
      // Simular rechazo 401 desde adapter para forzar rama de error
      adapter: async (c) => Promise.reject(new AxiosError('Unauthorized', undefined, c as any, undefined, {
        data: { error: 'Unauthorized' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: c as any,
      } as any)) as any,
    })).rejects.toBeTruthy();

    expect(redirectedTo).toBe('/login');
    window.removeEventListener('auth:redirect', handler as EventListener);
  });
});