// Mockear el cliente API y utilidades ANTES de importar la app
vi.mock('@/lib/api', () => {
  const defaults: any = { headers: { common: {} }, baseURL: '/api' };
  return {
    api: {
      defaults,
      post: vi.fn(async (path: string, body: any) => {
        if (path === '/auth/login') {
          // Simular login exitoso con payload esperado por el store
          return {
            data: {
              success: true,
              message: 'Login exitoso',
              data: {
                user: {
                  id: 'u-admin-1',
                  username: body?.username ?? 'admin',
                  email: 'admin@joyeria.com',
                  firstName: 'Admin',
                  lastName: 'User',
                  role: 'admin',
                  isActive: true,
                  lastLogin: new Date().toISOString(),
                },
                token: 'test-token-123',
              },
            },
          } as any;
        }
        throw new Error('Unexpected API call: ' + path);
      }),
    },
    initializeApiBaseUrl: vi.fn(async () => '/api'),
    checkBackendStatus: vi.fn(async () => 'ok'),
  };
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/test/setupIntegration';
import { renderAt, assertRedirect } from '@/test/renderWithApp';
import { useAuthStore } from '@/store/authStore';

describe('Smoke: flujo de login y persistencia en auth-storage', () => {
  it('realiza login, redirige a /dashboard y persiste token/usuario', async () => {
    const { api: apiClient }: any = await import('@/lib/api');
    const postSpy = vi.spyOn(apiClient, 'post');
    // Arrancar la app en la ruta de login
    renderAt('#/login');

    // Confirmar que estamos en la pantalla de login usando placeholders confiables
    const userInput = await screen.findByPlaceholderText('Ingresa tu usuario');
    const passInput = await screen.findByPlaceholderText('Ingresa tu contraseña');
    fireEvent.change(userInput, { target: { value: 'admin' } });
    fireEvent.change(passInput, { target: { value: 'admin123' } });

    // Enviar formulario
    const submit = screen.getByRole('button', { name: 'Iniciar Sesión' });
    fireEvent.click(submit);
    const form = submit.closest('form') as HTMLFormElement | null;
    if (form) {
      fireEvent.submit(form);
    }

    // Esperar que se haya llamado al endpoint de login
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/auth/login', { username: 'admin', password: 'admin123' });
    });

    // Esperar redirección al dashboard (ruta protegida)
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    await waitFor(() => {
      const raw = window.localStorage.getItem('auth-storage');
      const parsed = raw ? JSON.parse(raw) : null;
      expect(parsed?.state?.isAuthenticated).toBe(true);
    });
    await waitFor(() => {
      const isHashDashboard = window.location.hash.includes('#/dashboard');
      const isPathDashboard = window.location.pathname.includes('/dashboard');
      expect(isHashDashboard || isPathDashboard).toBe(true);
    });

    // Validar persistencia de auth-storage en localStorage
    const raw = window.localStorage.getItem('auth-storage');
    expect(raw).toBeTruthy();

    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed?.state?.isAuthenticated).toBe(true);
    expect(parsed?.state?.token).toBe('test-token-123');
    expect(parsed?.state?.user?.username).toBe('admin');

    // Validar que el header Authorization de axios se haya configurado
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer test-token-123');
  });
});
