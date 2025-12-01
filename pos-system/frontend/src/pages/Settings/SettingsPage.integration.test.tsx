import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

// Mocks para stores utilizados por SettingsPage
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'admin' } }),
}));

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('@/store/notificationPrefsStore', () => ({
  useNotificationPrefsStore: () => ({
    enableSound: true,
    volume: 50,
    mutedTypes: [],
    rateLimitWindowMs: 60000,
    rateLimitMaxPerWindow: 100,
    setEnableSound: vi.fn(),
    setVolume: vi.fn(),
    toggleMutedType: vi.fn(),
    setRateLimitWindowMs: vi.fn(),
    setRateLimitMaxPerWindow: vi.fn(),
  }),
}));

describe('SettingsPage integración - render básico con testMode', () => {
  it('muestra encabezado y pestañas sin carga inicial', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/settings' }]}> 
        <SettingsPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible
    expect(await screen.findByText('Configuración')).toBeTruthy();

    // Pestañas visibles
    expect(screen.getByText('Tienda')).toBeTruthy();
    expect(screen.getByText('POS')).toBeTruthy();
    expect(screen.getByText('Notificaciones')).toBeTruthy();
    expect(screen.getByText('Seguridad')).toBeTruthy();
    expect(screen.getByText('Respaldo')).toBeTruthy();
    expect(screen.getByText('Sistema')).toBeTruthy();
    expect(screen.getByText('Turismo')).toBeTruthy();
  });
});

