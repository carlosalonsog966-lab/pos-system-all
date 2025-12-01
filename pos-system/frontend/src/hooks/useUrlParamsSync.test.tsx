import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useUrlParamsSync } from './useUrlParamsSync';

function Probe() {
  const { dashboardFromUrl, recentFromUrl, updateSearch } = useUrlParamsSync();
  const location = useLocation();
  return (
    <div>
      <div data-testid="search">{location.search}</div>
      <div data-testid="dashboard">{JSON.stringify(dashboardFromUrl)}</div>
      <div data-testid="recent">{JSON.stringify(recentFromUrl)}</div>
      <button
        data-testid="update"
        onClick={() => updateSearch({ period: 'week', comparison: '0', showAmounts: '1', recentQuery: 'xyz' })}
      >update</button>
    </div>
  );
}

describe('useUrlParamsSync', () => {
  it('lee dashboard/recent desde la URL y convierte tipos', async () => {
    const initial = '/app?period=month&comparison=1&showAmounts=0&recentRef=true&recentQuery=abc';
    render(
      <MemoryRouter initialEntries={[initial]}>
        <Probe />
      </MemoryRouter>
    );

    await waitFor(() => {
      const dashboard = JSON.parse(screen.getByTestId('dashboard').textContent || '{}');
      const recent = JSON.parse(screen.getByTestId('recent').textContent || '{}');
      expect(dashboard.period).toBe('month');
      expect(dashboard.comparison).toBe(true);
      expect(dashboard.showAmounts).toBe(false);
      expect(recent.hasReference).toBe(true);
      expect(recent.referenceQuery).toBe('abc');
    });
  });

  it('escribe cambios en la URL con merge y reemplazo', async () => {
    const initial = '/app?period=today&comparison=0&showAmounts=1';
    render(
      <MemoryRouter initialEntries={[initial]}>
        <Probe />
      </MemoryRouter>
    );

    act(() => {
      (screen.getAllByTestId('update').at(-1) as HTMLButtonElement).click();
    });

    await waitFor(() => {
      const all = screen.getAllByTestId('search');
      const search = (all.at(-1)?.textContent) || '';
      expect(search).toContain('period=week');
      expect(search).toContain('comparison=0');
      expect(search).toContain('showAmounts=1');
      expect(search).toContain('recentQuery=xyz');
    });
  });
});
