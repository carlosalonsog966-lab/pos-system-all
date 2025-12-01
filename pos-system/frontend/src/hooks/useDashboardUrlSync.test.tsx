import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useDashboardUrlSync } from './useDashboardUrlSync';

function Probe() {
  const { filters, recentSalesFilters, handleFilterChange, setRecentSalesFilters } = useDashboardUrlSync();
  const location = useLocation();
  return (
    <div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="filters">{JSON.stringify(filters)}</div>
      <div data-testid="recent">{JSON.stringify(recentSalesFilters)}</div>
      <button data-testid="set-comparison" onClick={() => handleFilterChange({ comparison: true })}>cmp</button>
      <button data-testid="set-show-amounts" onClick={() => handleFilterChange({ showAmounts: false })}>amt</button>
      <button data-testid="set-period" onClick={() => handleFilterChange({ period: 'year' })}>per</button>
      <button data-testid="set-ref" onClick={() => setRecentSalesFilters(prev => ({ ...prev, hasReference: true }))}>ref</button>
      <button data-testid="set-query" onClick={() => setRecentSalesFilters(prev => ({ ...prev, referenceQuery: '  hello  ' }))}>qry</button>
      <button data-testid="clear-query" onClick={() => setRecentSalesFilters(prev => ({ ...prev, referenceQuery: '' }))}>clr</button>
    </div>
  );
}

describe('useDashboardUrlSync', () => {
  const STORAGE_KEY = 'dashboard_filters_v1';

  beforeEach(() => {
    try { localStorage.clear(); } catch {/* noop */}
  });

  it('lee y combina filtros desde URL y localStorage (URL prevalece)', async () => {
    // Guardar filtros en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ period: 'week', comparison: true, showAmounts: false }));
    } catch {/* noop */}

    const initial = '/app?period=month&comparison=0&showAmounts=1';
    const { getByTestId } = render(
      <MemoryRouter initialEntries={[initial]}>
        <Probe />
      </MemoryRouter>
    );

    await waitFor(() => {
      const filters = JSON.parse(screen.getByTestId('filters').textContent || '{}');
      // Debe prevalecer la URL frente al localStorage
      expect(filters.period).toBe('month');
      expect(filters.comparison).toBe(false);
      expect(filters.showAmounts).toBe(true);
    });
  });

  it.skip('escribe filtros del dashboard a la URL cuando cambian', async () => {
    const initial = '/app?period=today&comparison=0&showAmounts=1';
    const { getByTestId } = render(
      <MemoryRouter initialEntries={[initial]}>
        <Probe />
      </MemoryRouter>
    );

    // Cambiar varios filtros
    act(() => {
      const comps = screen.getAllByTestId('set-comparison') as HTMLButtonElement[];
      const amts = screen.getAllByTestId('set-show-amounts') as HTMLButtonElement[];
      const pers = screen.getAllByTestId('set-period') as HTMLButtonElement[];
      comps[comps.length - 1].click();
      amts[amts.length - 1].click();
      pers[pers.length - 1].click();
    });

    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const candidates = searchEls.map(el => el.textContent || '');
      const search = candidates.find(t => t.includes('comparison=') || t.includes('period=')) || '';
      expect(search).toContain('comparison=1');
      expect(search).toContain('showAmounts=0');
      expect(search).toContain('period=year');
    });
  });

  it('escribe filtros de ventas recientes en la URL y trimea el query', async () => {
    const initial = '/app';
    const { getByTestId } = render(
      <MemoryRouter initialEntries={[initial]}>
        <Probe />
      </MemoryRouter>
    );

    // Activar referencia y establecer query con espacios
    act(() => {
      const refs = screen.getAllByTestId('set-ref') as HTMLButtonElement[];
      const qrys = screen.getAllByTestId('set-query') as HTMLButtonElement[];
      refs[refs.length - 1].click();
      qrys[qrys.length - 1].click();
    });

    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const candidates = searchEls.map(el => el.textContent || '');
      const search = candidates.find(t => t.includes('recentRef=1')) || '';
      expect(search).toContain('recentRef=1');
      expect(search).toContain('recentQuery=hello');
    });

    // Limpiar query: debe eliminarse de la URL
    act(() => {
      const clrs = screen.getAllByTestId('clear-query') as HTMLButtonElement[];
      clrs[clrs.length - 1].click();
    });
    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const candidates = searchEls.map(el => el.textContent || '');
      const search = candidates.find(t => t.includes('recentRef=1')) || candidates[candidates.length - 1] || '';
      expect(search).toContain('recentRef=1');
      expect(search).not.toContain('recentQuery=');
    });
  });
});
