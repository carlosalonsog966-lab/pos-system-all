import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobsPage from './JobsPage';

vi.mock('@/services/jobsService', () => {
  const fetchJobs = vi.fn(async () => ({ success: true, jobs: [
    { id: '1', type: 'echo', status: 'completed', payload: { message: 'Hola' }, attempts: 1, maxAttempts: 3, scheduledAt: null, availableAt: null, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: '2', type: 'echo', status: 'failed', payload: { message: 'Error' }, attempts: 3, maxAttempts: 3, error: 'Boom', scheduledAt: null, availableAt: null, createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
    { id: '3', type: 'sync', status: 'queued', payload: { entity: 'product' }, attempts: 0, maxAttempts: 3, scheduledAt: null, availableAt: null, createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
  ] }));
  const fetchJobsHealth = vi.fn(async () => ({ success: true, running: true, intervalMs: 2000 }));
  const enqueueJob = vi.fn(async () => ({ success: true, job: { id: '4', type: 'echo', status: 'queued', payload: { message: 'Hola desde test' }, attempts: 0, maxAttempts: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }));
  const retryJob = vi.fn(async () => ({ success: true }));
  return { fetchJobs, fetchJobsHealth, enqueueJob, retryJob };
});

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
  }),
}));

describe('JobsPage integración', () => {
  it('renderiza sin spinner en testMode y muestra resumen', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jobs' }]}> 
        <JobsPage testMode />
      </MemoryRouter>
    );

    // Header
    expect(await screen.findByText('Jobs')).toBeTruthy();

    // Resumen de estados
    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();

    // Tabla y acciones básicas (encabezados de columna)
    expect(screen.getByRole('columnheader', { name: 'Tipo' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Programado' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Disponible' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeTruthy();
  });

  it('muestra spinner inicial cuando no está en testMode', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jobs' }]}> 
        <JobsPage />
      </MemoryRouter>
    );

    // LoadingSpinner genérico por data-testid
    expect(await screen.findByTestId('loading-spinner')).toBeTruthy();
  });

  it('ordena por fecha Creado al alternar encabezado', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jobs' }]}> 
        <JobsPage />
      </MemoryRouter>
    );

    // Esperar a que se carguen filas
    const rowsDesc = await screen.findAllByTestId(/job-row-/);
    // Por defecto sortKey=createdAt desc (más reciente primero)
    expect(rowsDesc[0]).toHaveTextContent('3');
    expect(rowsDesc[1]).toHaveTextContent('2');
    expect(rowsDesc[2]).toHaveTextContent('1');

    // Toggle a asc
    const createdHeader = screen.getAllByRole('columnheader', { name: /Creado/i })[0];
    fireEvent.click(createdHeader);
    const rowsAsc = await screen.findAllByTestId(/job-row-/);
    expect(rowsAsc[0]).toHaveTextContent('1');
    expect(rowsAsc[1]).toHaveTextContent('2');
    expect(rowsAsc[2]).toHaveTextContent('3');
  });
});

describe('JobsPage acciones', () => {
  it('encola un trabajo echo al darle al botón', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jobs' }]}> 
        <JobsPage testMode />
      </MemoryRouter>
    );

    const enqueueBtns = await screen.findAllByText('Encolar echo');
    fireEvent.click(enqueueBtns[0]);
    const { enqueueJob } = await import('@/services/jobsService');
    expect(enqueueJob).toHaveBeenCalledTimes(1);
  });

  it('reintenta un job fallido al hacer clic en Reintentar', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jobs' }]}> 
        <JobsPage />
      </MemoryRouter>
    );

    const retryBtns = await screen.findAllByText('Reintentar');
    fireEvent.click(retryBtns[0]);
    const { retryJob } = await import('@/services/jobsService');
    expect(retryJob).toHaveBeenCalledTimes(1);
    expect(retryJob).toHaveBeenCalledWith('2');
  });
});
