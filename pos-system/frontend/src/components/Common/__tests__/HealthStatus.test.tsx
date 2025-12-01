import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import HealthStatus from '../HealthStatus';

// Mock del cliente API y del backendStatus
vi.mock('@/lib/api', () => {
  let listeners: any[] = [];
  let status = 'ok';
  return {
    api: {
      get: vi.fn().mockResolvedValue({
        data: {
          success: true,
          message: 'OK',
          version: '1.0.0',
          db: { healthy: true, latency: 3 },
          config: { ok: true, errors: 0, warnings: 0 },
        }
      }),
    },
    backendStatus: {
      onStatus: (fn: any) => { listeners.push(fn); fn(status); },
      offStatus: (fn: any) => { listeners = listeners.filter((l) => l !== fn); },
    }
  };
});

describe('HealthStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renderiza versión y estados básicos', async () => {
    vi.useFakeTimers();
    render(<HealthStatus intervalMs={10_000} />);
    vi.advanceTimersByTime(1);
    vi.useRealTimers();
    // Elementos base
    expect(screen.getByText(/Servidor/i)).toBeInTheDocument();
    // Espera la primera carga
    await waitFor(() => {
      expect(screen.getByText(/v1.0.0/i)).toBeInTheDocument();
      expect(screen.getByText(/DB: OK/i)).toBeInTheDocument();
      expect(screen.getByText(/Cfg: OK/i)).toBeInTheDocument();
    });
  });

  it('tolera fallo de fetch y mantiene estado degradado', async () => {
    const { api } = await import('@/lib/api');
    (api.get as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    vi.useRealTimers();
    render(<HealthStatus intervalMs={10_000} />);
    // Primera carga falla, el componente no explota
    await waitFor(() => {
      // Puede mostrar elementos base aún sin payload
      expect(screen.getByText(/Servidor/i)).toBeInTheDocument();
    });
  });
});
