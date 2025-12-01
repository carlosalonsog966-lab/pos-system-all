import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useSalesUrlSync } from './useSalesUrlSync';

function HookProbe({ initialTab }: { initialTab: 'new-sale' | 'guide-sale' | 'sales-history' | 'analytics' }) {
  const { salesFilters, handleSalesFilterChange } = useSalesUrlSync(initialTab);
  const location = useLocation();
  return (
    <div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="filters">{JSON.stringify(salesFilters)}</div>
      <button onClick={() => handleSalesFilterChange({ minAmount: 345 })} data-testid="set-min">set-min</button>
      <button onClick={() => handleSalesFilterChange({ minAmount: undefined })} data-testid="unset-min">unset-min</button>
      <button onClick={() => handleSalesFilterChange({ hasReference: true })} data-testid="set-ref">set-ref</button>
    </div>
  );
}

describe('useSalesUrlSync', () => {
  it('lee y convierte filtros desde la URL al abrir Historial', async () => {
    const initialUrl = '/sales?tab=sales-history&dateFrom=2025-01-01&minAmount=100&maxAmount=200&hasReference=1&paymentMethod=cash';
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <HookProbe initialTab="sales-history" />
      </MemoryRouter>
    );

    await waitFor(() => {
      const filters = JSON.parse(screen.getByTestId('filters').textContent || '{}');
      expect(filters.dateFrom).toBe('2025-01-01');
      expect(filters.minAmount).toBe(100);
      expect(filters.maxAmount).toBe(200);
      expect(filters.hasReference).toBe(true);
      expect(filters.paymentMethod).toBe('cash');
    });
  });

  it('escribe filtros en la URL cuando cambian en Historial', async () => {
    const initialUrl = '/sales?tab=sales-history';
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <HookProbe initialTab="sales-history" />
      </MemoryRouter>
    );

    // Establecer minAmount
    (screen.getAllByTestId('set-min').at(-1) as HTMLButtonElement).click();
    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const search = (searchEls.at(-1)?.textContent) || '';
      expect(search).toContain('tab=sales-history');
      expect(search).toContain('minAmount=345');
    });

    // Remover minAmount (debe desaparecer de la URL)
    (screen.getAllByTestId('unset-min').at(-1) as HTMLButtonElement).click();
    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const search = (searchEls.at(-1)?.textContent) || '';
      expect(search).toContain('tab=sales-history');
      expect(search).not.toContain('minAmount=');
    });
  });

  it('serializa booleanos correctamente (true/false)', async () => {
    const initialUrl = '/sales?tab=sales-history&hasReference=0';
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <HookProbe initialTab="sales-history" />
      </MemoryRouter>
    );

    // URL inicial indica false
    await waitFor(() => {
      const filtersEls = screen.getAllByTestId('filters');
      const raw = filtersEls.at(-1)?.textContent || '{}';
      const filters = JSON.parse(raw);
      expect(filters.hasReference).toBe(false);
    });

    // Cambiar a true y verificar URL
    (screen.getAllByTestId('set-ref').at(-1) as HTMLButtonElement).click();
    await waitFor(() => {
      const searchEls = screen.getAllByTestId('search');
      const search = (searchEls.at(-1)?.textContent) || '';
      expect(search).toContain('hasReference=true');
    });
  });
});
