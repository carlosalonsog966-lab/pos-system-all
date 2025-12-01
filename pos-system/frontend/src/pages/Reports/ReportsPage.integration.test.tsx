import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { assertSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from './ReportsPage';
import { api } from '@/lib/api';
import '../../test/setupIntegration';
import { stubWindowListeners } from '../../test/setupIntegration';

// Mocks mínimos para evitar efectos en montaje
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/store/offlineStore', () => ({ useOfflineStore: () => ({ isOffline: false }) }));
vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}));
// Reducir carga de renderizado: mock de componentes pesados
vi.mock('./components/DashboardMetrics', () => ({ DashboardMetrics: () => <div /> }));
vi.mock('./components/SalesCharts', () => ({ SalesCharts: () => <div /> }));
vi.mock('./components/InventoryCharts', () => ({ InventoryCharts: () => <div /> }));
vi.mock('./components/FinancialCharts', () => ({ FinancialCharts: () => <div /> }));
vi.mock('./components/JewelryCharts', () => ({ JewelryCharts: () => <div /> }));
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(async () => ({ data: { success: true, data: {} } })) },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
}));

describe('ReportsPage integración - Filtros Avanzados', () => {
  beforeEach(() => {
    // Evitar listeners globales activos durante la prueba
    stubWindowListeners();
  });
  it('abre filtros, cambia preset y groupBy, y restablece por defecto', async () => {
    // Preparar datos offline para evitar spinner prolongado
    window.localStorage.setItem('lastReportData', JSON.stringify({}));
    // Forzar fallo de API para utilizar datos guardados
    (api.get as any).mockRejectedValueOnce(new Error('network'));
    render(
      <MemoryRouter initialEntries={[{ pathname: '/reports' }]}> 
        <ReportsPage testMode />
      </MemoryRouter>
    );

    // La vista principal debe estar lista inmediatamente en testMode
    screen.getByRole('heading', { level: 1, name: 'Reportes Avanzados' });

    // Abrir panel de filtros
    const filtrosBtn = screen.getByRole('button', { name: /Filtros/i });
    fireEvent.click(filtrosBtn);
    screen.getByText('Período');

    // Seleccionar preset "Este año"
    const presetYearBtn = screen.getByRole('button', { name: 'Este año' });
    fireEvent.click(presetYearBtn);
    expect(presetYearBtn).toHaveClass('text-blue-700');

    // Cambiar groupBy a "Mes"
    const groupBySelect = screen.getByLabelText('Agrupar por');
    fireEvent.change(groupBySelect, { target: { value: 'month' } });
    expect(groupBySelect).toHaveValue('month');

    // Restablecer filtros
    const resetBtn = screen.getByText('Restablecer filtros');
    fireEvent.click(resetBtn);

    // Verificar valores por defecto
    const presetMonthBtn = screen.getByRole('button', { name: 'Este mes' });
    expect(presetMonthBtn).toHaveClass('text-blue-700');
    expect(groupBySelect).toHaveValue('day');

  });
});

describe('ReportsPage integración - carga inicial sin testMode', () => {
  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/reports' }]}> 
        <ReportsPage />
      </MemoryRouter>
    );

    // Consulta síncrona: el spinner está visible inmediatamente en montaje
    screen.getByText('Cargando reportes avanzados...');

  });
});
