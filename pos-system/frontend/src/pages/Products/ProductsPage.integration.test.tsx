import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assertSpinner, assertNoSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import ProductsPage from './ProductsPage';

// Mocks mínimos para evitar efectos de red y stores
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({ data: { success: true, data: [] } })),
  },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
  normalizeListPayloadWithSchema: vi.fn((x: any) => x),
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
    setOfflineStatus: vi.fn(),
    syncPendingActions: vi.fn(async () => {})
  }),
}));

vi.mock('@/store/productsStore', () => ({
  useProductsStore: () => ({ products: [], setProducts: vi.fn() }),
}));

describe('ProductsPage integración - render básico con testMode', () => {
  it('renderiza sin spinner y muestra filtros de búsqueda', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/products' }]}> 
        <ProductsPage testMode />
      </MemoryRouter>
    );

    // Header presente
    expect(await screen.findByText('Inventario de Productos')).toBeTruthy();

    // No debe mostrarse el spinner principal
    assertNoSpinner('Cargando inventario...');

    // SearchBar visible por placeholder
    expect(
      screen.getByPlaceholderText('Buscar por nombre, SKU, código de barras, marca...')
    ).toBeTruthy();

    // Select de categorías presente con opción por defecto (permitir duplicados en el DOM)
    const opts = screen.queryAllByText('Todas las categorías');
    expect(opts.length).toBeGreaterThan(0);
  });

  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/products' }]}> 
        <ProductsPage />
      </MemoryRouter>
    );

    await assertSpinner('Cargando inventario...');
  });

  it('botón de importación de prueba aparece y procesa importación en testMode', async () => {
    // Limpia localStorage para un conteo estable
    try { localStorage.removeItem('products-store'); } catch {}

    render(
      <MemoryRouter initialEntries={[{ pathname: '/products?testMode=1' }]}> 
        <ProductsPage testMode />
      </MemoryRouter>
    );

    // Debe existir el botón en testMode
    const btns = await screen.findAllByTestId('test-import-button');
    expect(btns.length).toBeGreaterThan(0);
    // Click al botón para simular importación offline
    await userEvent.click(btns[0]);

    // Verificar que el store persistió productos; lectura directa de localStorage
    const raw = localStorage.getItem('products-store');
    const parsed = raw ? JSON.parse(raw) : null;
    const items = parsed && parsed.state && Array.isArray(parsed.state.products) ? parsed.state.products : [];
    expect(items.length).toBeGreaterThanOrEqual(2); // al menos los dos importados
  });
});
