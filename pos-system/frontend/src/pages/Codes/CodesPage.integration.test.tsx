import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { assertSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import CodesPage from './CodesPage';

// Mantener visible el spinner inicial en modo normal con una pequeña demora
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return { data: { success: true, data: [] } };
    }),
  },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    addNotification: vi.fn(),
  }),
}));

vi.mock('@/store/offlineStore', () => {
  const state = { isOffline: false };
  const useOfflineStore: any = () => state;
  useOfflineStore.getState = () => state;
  return { useOfflineStore };
});

vi.mock('@/store/productsStore', () => ({
  useProductsStore: () => ({ products: [] }),
}));

describe('CodesPage integración - render básico con testMode', () => {
  it('muestra encabezado y secciones sin spinner inicial', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/codes' }]}> 
        <CodesPage testMode />
      </MemoryRouter>
    );

    // Encabezado visible
    expect(await screen.findByText('códigos QR y códigos de Barras')).toBeTruthy();
    expect(screen.getByText('Genera y gestiona códigos QR y códigos de barras para tus productos')).toBeTruthy();

    // Secciones clave
    expect(screen.getByText('Generar códigos')).toBeTruthy();
    expect(screen.getByText(/Historial/)).toBeTruthy();

    // Sin spinner inicial
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
  });
});

describe('CodesPage integración - carga inicial sin testMode', () => {
  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/codes' }]}> 
        <CodesPage />
      </MemoryRouter>
    );

    await assertSpinner('Cargando productos...');
  });
});
