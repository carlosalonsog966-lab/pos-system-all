import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { assertSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import ClientsPage from './ClientsPage';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => {
      // Pequeña demora para mantener visible el spinner en modo no-test
      await new Promise((r) => setTimeout(r, 25));
      return { data: { success: true, data: [] } };
    }),
  },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
  normalizeListPayload: vi.fn((x: any) => x?.data ?? []),
}));

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('@/store/offlineStore', () => ({
  useOfflineStore: () => ({ isOffline: false, addPendingAction: vi.fn() }),
}));

vi.mock('@/store/clientsStore', () => {
  const state = { clients: [], setClients: vi.fn() };
  const useClientsStore: any = () => state;
  useClientsStore.getState = () => state;
  return { useClientsStore };
});

describe('ClientsPage integración - render básico con testMode', () => {
  it('renderiza sin spinner y muestra búsqueda', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/clients' }]}> 
        <ClientsPage testMode />
      </MemoryRouter>
    );

    // Header presente indica que no está en modo de carga
    expect(await screen.findByText('Clientes')).toBeTruthy();

    // SearchBar visible por placeholder
    expect(screen.getByPlaceholderText('Buscar clientes...')).toBeTruthy();

    // Botón de filtros presente
    expect(screen.getByText('Filtros')).toBeTruthy();
  });

  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/clients' }]}> 
        <ClientsPage />
      </MemoryRouter>
    );

    // Spinner genérico por data-testid en modo normal
    await assertSpinner();
  });
});
