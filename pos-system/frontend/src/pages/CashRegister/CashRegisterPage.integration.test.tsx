import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CashRegisterPage from './CashRegisterPage';

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    addNotification: vi.fn(),
  }),
}));

vi.mock('@/store/offlineStore', () => ({
  useOfflineStore: () => ({ isOffline: false, addPendingAction: vi.fn() }),
}));

describe('CashRegisterPage integración - render básico con testMode', () => {
  it('muestra encabezado sin spinner inicial', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/cash-register' }]}> 
        <CashRegisterPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible
    expect(await screen.findByText('Caja Registradora')).toBeTruthy();
    expect(screen.getByText('Gestión de sesiones de caja y operaciones de efectivo')).toBeTruthy();

    // Sin spinner inicial en modo prueba
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
  });
});

