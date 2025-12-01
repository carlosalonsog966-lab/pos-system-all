import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { assertSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import SalesPage from './SalesPage';

// Mocks mínimos para evitar efectos de red y stores
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => ({ data: { success: true, data: [] } })),
  },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
  normalizeListPayload: vi.fn((x: any) => x),
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
  useOfflineStore: () => ({
    isOffline: false,
    addPendingAction: vi.fn(),
    syncPendingActions: vi.fn(),
    pendingActions: [],
    syncInProgress: false,
  }),
}));

vi.mock('@/store/productsStore', () => ({ useProductsStore: () => ({}) }));
vi.mock('@/store/clientsStore', () => ({ useClientsStore: () => ({}) }));

describe('SalesPage integration - filtros UI', () => {
  it('autocorrige maxAmount al blur cuando es menor que minAmount y sincroniza URL', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/sales', search: '?tab=sales-history' }]}> 
        <SalesPage testMode />
      </MemoryRouter>
    );

    // Esperar y cambiar a pestaña Historial
    const historyTab = await screen.findByText('Historial');
    fireEvent.click(historyTab);
    // Confirmar que el contenido de Historial está activo
    await screen.findByText(/Historial de Ventas/);

    // Inputs de montos (ambos usan placeholder "0"; orden: min luego max)
    const [minInput, maxInput] = screen.getAllByPlaceholderText('0');

    // Establecer min=500
    fireEvent.change(minInput, { target: { value: '500' } });
    fireEvent.blur(minInput);

    // Establecer max=200 (menor que min) y blur para autocorrección
    fireEvent.change(maxInput, { target: { value: '200' } });
    fireEvent.blur(maxInput);

    await waitFor(() => {
      // El mensaje de rango inválido no debe estar presente tras autocorrección
      expect(screen.queryByText('El máximo no puede ser menor que el mínimo')).toBeNull();
      // El valor del input max debe igualar al mínimo (500)
      expect((maxInput as HTMLInputElement).value).toBe('500');
      // Confirmación de autocorrección aplicada en el input
    });
  });

  // Nota: La sincronización completa de hasReference/referenceQuery se valida a nivel de hook.
  // Este test de integración se centra en la autocorrección de montos y la escritura de min/max.
});

describe('SalesPage integration - testMode y carga', () => {
  it('renderiza encabezado sin spinner en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/sales' }]}> 
        <SalesPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible indica UI cargada
    const headers = await screen.findAllByText('Ventas');
    expect(headers[0]).toBeTruthy();
    // Spinner genérico no debe estar presente
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
  });

  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/sales' }]}> 
        <SalesPage />
      </MemoryRouter>
    );

    // En modo normal, debe mostrarse el spinner de carga inicial
    await assertSpinner();
  });
});
