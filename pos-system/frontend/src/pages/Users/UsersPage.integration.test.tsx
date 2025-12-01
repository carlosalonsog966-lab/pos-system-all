import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './UsersPage';

// Mocks mínimos para evitar efectos de red y tiendas globales
vi.mock('@/lib/api', () => ({
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'admin' } }),
}));

describe('UsersPage integración - render básico con testMode', () => {
  it('renderiza encabezado y filtros sin carga inicial', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/users' }]}> 
        <UsersPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible
    expect(await screen.findByText('Usuarios')).toBeTruthy();
    expect(screen.getByText('Gestión de usuarios del sistema')).toBeTruthy();

    // Filtros visibles
    expect(screen.getByPlaceholderText('Buscar por usuario o email')).toBeTruthy();
    expect(screen.getByText('Todos los roles')).toBeTruthy();

    // Tabla presente aunque sin datos
    expect(screen.getByText('Usuario')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });
});
