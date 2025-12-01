import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/test/setupIntegration';
import { stubWindowListeners } from '@/test/setupIntegration';
import { assertSpinner } from '@/test/renderWithApp';
import { MemoryRouter } from 'react-router-dom';
import RankingsPage from './RankingsPage';

// Mocks mínimos para evitar efectos o dependencias innecesarias
vi.mock('@/store/rankingStore', () => ({
  useRankingStore: () => ({
    rankings: null,
    loading: false,
    error: null,
    currentPeriod: 'weekly',
    loadRankings: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe('RankingsPage integración - render básico con testMode', () => {
  it('muestra encabezado, período y estado vacío sin spinner', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/rankings' }]}> 
        <RankingsPage testMode />
      </MemoryRouter>
    );

    // Encabezado presente
    expect(screen.getByText('Rankings')).toBeTruthy();

    // Período visible (por defecto semanal)
    expect(screen.getByText(/Período: Semanal/)).toBeTruthy();

    // Estado vacío visible cuando no hay datos
    expect(screen.getByText('No hay datos de rankings')).toBeTruthy();
  });
});

describe('RankingsPage integración - carga inicial sin testMode', () => {
  beforeEach(() => {
    // Evita bloqueos por listeners globales en entorno forks/Windows
    stubWindowListeners();
  });
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('@/store/rankingStore', () => ({
      useRankingStore: () => ({
        rankings: null,
        loading: true,
        error: null,
        currentPeriod: 'weekly',
        loadRankings: vi.fn(),
        clearError: vi.fn(),
      }),
    }));
  });

  it('muestra spinner inicial cuando no está en testMode', async () => {
    const { default: RankingsPage } = await import('./RankingsPage');
    render(
      <MemoryRouter initialEntries={[{ pathname: '/rankings' }]}> 
        <RankingsPage />
      </MemoryRouter>
    );

    // Consulta síncrona para evitar esperas potencialmente bloqueantes en Windows
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  });
});
