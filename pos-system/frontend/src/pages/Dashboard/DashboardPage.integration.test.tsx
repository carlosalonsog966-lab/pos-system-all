import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import DashboardPage from './DashboardPage';

// Helper para observar la URL dentro del Router
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

// Mocks mínimos para evitar llamadas reales y stores
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/store/notificationStore', () => ({ useNotificationStore: () => ({ addNotification: vi.fn() }) }));
vi.mock('@/store/offlineStore', () => ({ useOfflineStore: () => ({ isOffline: false }) }));
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(async () => ({ data: { success: true, data: {} } })) },
  initializeApiBaseUrl: vi.fn(async () => {}),
  backendStatus: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/utils/clipboard', () => ({ copyUrlWithParams: vi.fn(async () => {}) }));

describe('DashboardPage integración - reset', () => {
  it('Reset restablece filtros por defecto y refleja en URL y localStorage', async () => {
    try { localStorage.setItem('dashboard_filters_v1', JSON.stringify({ period: 'year', comparison: true, showAmounts: false })); } catch {}

    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', search: '?period=year&comparison=1&showAmounts=0' }]}> 
        <DashboardPage />
        <LocationProbe />
      </MemoryRouter>
    );

    const resetBtn = await screen.findByText('Reset');
    fireEvent.click(resetBtn);

    await waitFor(() => {
      const els = screen.getAllByTestId('search');
      const search = (els[els.length - 1].textContent) || '';
      expect(search).toContain('period=today');
      expect(search).toContain('comparison=0');
      expect(search).toContain('showAmounts=1');
      const raw = localStorage.getItem('dashboard_filters_v1');
      const saved = JSON.parse(raw || '{}');
      expect(saved.period).toBe('today');
      expect(saved.comparison).toBe(false);
      expect(saved.showAmounts).toBe(true);
    });
  });
  
  it.skip('Actualiza filtros de Ventas Recientes y sincroniza URL', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', search: '' }]}> 
        <DashboardPage testMode />
        <LocationProbe />
      </MemoryRouter>
    );

    // Activar "Con referencia"
    const refCheckboxes = await screen.findAllByLabelText('Con referencia');
    fireEvent.click(refCheckboxes[0]);

    // Escribir referencia con espacios
    const refInputs = await screen.findAllByPlaceholderText('Buscar referencia');
    fireEvent.change(refInputs[0], { target: { value: '  hello  ' } });

    await waitFor(() => {
      const els = screen.getAllByTestId('search');
      const search = (els[els.length - 1].textContent) || '';
      expect(search).toContain('recentRef=1');
      expect(search).toContain('recentQuery=hello');
    });

    // Vaciar referencia: debe eliminar recentQuery pero mantener recentRef
    fireEvent.change(refInput, { target: { value: '' } });
    await waitFor(() => {
      const els = screen.getAllByTestId('search');
      const search = (els[els.length - 1].textContent) || '';
      expect(search).toContain('recentRef=1');
      expect(search).not.toContain('recentQuery=');
    });
  });
});

describe('DashboardPage integración - testMode y carga', () => {
  it('UI base visible sin spinner cuando testMode=1', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/dashboard', search: '' }]}> 
        <DashboardPage testMode />
      </MemoryRouter>
    );

    // Controles básicos visibles en testMode (sin carga)
    const resetEls = await screen.findAllByText('Reset');
    expect(resetEls[0]).toBeTruthy();
    const refEls = await screen.findAllByLabelText('Con referencia');
    expect(refEls[0]).toBeTruthy();
    // Asegurar que el spinner genérico no aparece
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
  });
});
