import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

describe('AuthStore setToken', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false, error: null });
  });

  it('actualiza token y refreshToken y marca autenticado', () => {
    const st0 = useAuthStore.getState();
    expect(st0.isAuthenticated).toBe(false);
    useAuthStore.getState().setToken('new-token', 'rt-xyz');
    const st = useAuthStore.getState();
    expect(st.token).toBe('new-token');
    expect(st.refreshToken).toBe('rt-xyz');
    expect(st.isAuthenticated).toBe(true);
  });
});