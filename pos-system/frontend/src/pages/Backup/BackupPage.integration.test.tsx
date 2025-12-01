import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BackupPage } from './BackupPage';

// Mocks mínimos para stores utilizados por BackupPage
vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    addNotification: vi.fn(),
  }),
}));

describe('BackupPage integración - render básico con testMode', () => {
  it('muestra encabezado y secciones sin spinner inicial', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/backup' }]}> 
        <BackupPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible
    expect(await screen.findByText('Gestión de Respaldos')).toBeTruthy();
    expect(screen.getByText('Administra los respaldos de tu base de datos')).toBeTruthy();

    // Acciones y secciones clave
    expect(screen.getByText('Crear Respaldo Manual')).toBeTruthy();
    expect(screen.getByText('Respaldos Automáticos')).toBeTruthy();
    expect(screen.getByText('Respaldos Disponibles')).toBeTruthy();

    // Sin spinner inicial en modo prueba
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
  });
});

