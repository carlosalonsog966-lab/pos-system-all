import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { renderAt, setTestRole, assertRedirect, assertNoSpinner, assertSpinner } from '@/test/renderWithApp';

// Mocks de stores y API para evitar efectos externos
// Mock de librerías gráficas que requieren mediciones del DOM
vi.mock('recharts', () => ({
  ResponsiveContainer: (props: any) => <div>{props.children}</div>,
  LineChart: () => <div />,
  Line: () => <div />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  BarChart: () => <div />,
  Bar: () => <div />,
  PieChart: () => <div />,
  Pie: () => <div />,
  AreaChart: (props: any) => <div>{props.children}</div>,
  Area: () => <div />,
}));
let currentRole = 'admin';
vi.mock('./store/authStore', () => ({
  useAuthStore: () => ({ 
    isAuthenticated: true, 
    user: { id: 'u1', role: (globalThis as any).__TEST_ROLE__ ?? currentRole }, 
    initializeAuth: vi.fn(),
  }),
}));

vi.mock('./store/offlineStore', () => ({
  useOfflineStore: () => ({ 
    isOffline: false, 
    pendingActions: [], 
    syncInProgress: false,
    syncStatus: {
      isOnline: true,
      lastSync: null,
      syncInProgress: false,
      failedActions: 0,
      totalActions: 0,
      syncErrors: [],
    },
    setAutoSync: vi.fn(),
    setSyncInterval: vi.fn(),
    syncPendingActions: vi.fn(),
    retryFailedActions: vi.fn(),
    clearPendingActions: vi.fn(),
    addPendingAction: vi.fn(),
  }),
}));

const showSuccessSpy = vi.fn();
vi.mock('./store/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
    showSuccess: showSuccessSpy,
    showError: vi.fn(),
    showWarning: vi.fn(),
    notifications: [],
    position: 'top-right',
    clearAllNotifications: vi.fn(),
    removeNotification: vi.fn(),
    setPosition: vi.fn(),
    setMaxNotifications: vi.fn(),
  }),
}));

vi.mock('./lib/api', () => ({
  api: { get: vi.fn(async () => ({ data: { success: true, data: [] } })) },
  initializeApiBaseUrl: vi.fn(async () => 'http://localhost:5656'),
  checkBackendStatus: vi.fn(async () => 'ok'),
}));

// Mock paralelo para ruta con alias '@/lib/api' usada por páginas
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(async () => ({ data: { success: true, data: [] } })) },
  initializeApiBaseUrl: vi.fn(async () => 'http://localhost:5656'),
  checkBackendStatus: vi.fn(async () => 'ok'),
  backendStatus: {
    onStatus: vi.fn(() => vi.fn()),
    offStatus: vi.fn(),
  },
  normalizeListPayload: vi.fn((x: any) => x),
}));

// Evitar efectos globales durante tests
vi.mock('./lib/globalErrorHandler', () => ({
  initGlobalErrorHandlers: vi.fn(),
}));

// Prefs de notificaciones para evitar dependencias de localStorage en páginas como Settings
vi.mock('@/store/notificationPrefsStore', () => ({
  useNotificationPrefsStore: () => ({
    enableSound: true,
    volume: 0.7,
    mutedTypes: [],
    rateLimitWindowMs: 60000,
    rateLimitMaxPerWindow: 12,
    setEnableSound: vi.fn(),
    setVolume: vi.fn(),
    toggleMutedType: vi.fn(),
    setRateLimitWindowMs: vi.fn(),
    setRateLimitMaxPerWindow: vi.fn(),
  }),
}));

describe('App integración - testMode por query param', () => {
  beforeEach(() => {
    showSuccessSpy.mockClear();
    currentRole = 'admin';
    setTestRole('admin');
  });

  it('Sales respeta testMode=1 via URL y no realiza refresh', async () => {
    // Forzar HashRouter a ruta con testMode
    renderAt('#/sales?testMode=1');

    // Encabezado de Ventas visible (sin spinner de carga inicial)
    expect(await screen.findByText('Ventas')).toBeTruthy();

    // Validar que no se emiten notificaciones de "datos actualizados"
    // en modo de prueba (sin auto-refresh).
    await waitFor(() => {
      expect(showSuccessSpy).not.toHaveBeenCalled();
    });
  });

  it('Reports respeta testMode=1 via URL y no muestra spinner inicial', async () => {
    setTestRole('admin');
    renderAt('#/reports?testMode=1');

    // Ausencia de spinner inicial y UI base visible
    await waitFor(() => {
      expect(screen.queryByText('Cargando reportes avanzados...')).toBeNull();
    });
    expect(await screen.findByRole('button', { name: /Filtros/i })).toBeTruthy();
  });

  it('Sales respeta tm=1 via URL y no realiza carga inicial', async () => {
    renderAt('#/sales?tm=1');

    // UI de Ventas visible (placeholder de búsqueda)
    expect(
      await screen.findByPlaceholderText('Buscar productos por nombre, código o categoría...')
    ).toBeTruthy();

    // Validación de ausencia de refresh/éxito en testMode
    await waitFor(() => {
      expect(showSuccessSpy).not.toHaveBeenCalled();
    });
  });

  it('Users protegido: admin puede ver la página con testMode', async () => {
    setTestRole('admin');
    renderAt('#/users?testMode=1');

    expect(await screen.findByText('Usuarios')).toBeTruthy();
  });

  it('Users protegido: employee es redirigido a /dashboard', async () => {
    setTestRole('employee');
    renderAt('#/users?testMode=1');

    await assertRedirect('/dashboard');
    expect(screen.queryByText('Usuarios')).toBeNull();
  });

  it('Settings protegido: admin puede ver la página con testMode', async () => {
    setTestRole('admin');
    renderAt('#/settings?testMode=1');

    expect(await screen.findByText('Configuración')).toBeTruthy();
  });

  it('Settings protegido: manager es redirigido a /dashboard', async () => {
    setTestRole('manager');
    renderAt('#/settings?testMode=1');

    await assertRedirect('/dashboard');
    expect(screen.queryByText('Configuración')).toBeNull();
  });

  it('Backup protegido: admin puede ver la página con testMode', async () => {
    setTestRole('admin');
    renderAt('#/backup?testMode=1');

    const headings = await screen.findAllByText('Gestión de Respaldos');
    expect(headings[0]).toBeTruthy();
  });

  it('Backup protegido: manager es redirigido a /dashboard', async () => {
    setTestRole('manager');
    renderAt('#/backup?testMode=1');

    await waitFor(() => {
      expect(window.location.hash).toContain('#/dashboard');
    });
    expect(screen.queryByText('Gestión de Respaldos')).toBeNull();
  });

  it('CashRegister accesible: cashier puede ver la página con testMode', async () => {
    setTestRole('cashier');
    renderAt('#/cash-register?testMode=1');

    expect(await screen.findByText('Caja Registradora')).toBeTruthy();
  });

  it('Rankings protegido: employee puede ver la página con testMode', async () => {
    setTestRole('employee');
    renderAt('#/rankings?testMode=1');

    expect(await screen.findByText('Rankings')).toBeTruthy();
    expect(await screen.findByText(/Período:/)).toBeTruthy();
  });

  it('Dashboard respeta testMode=1 via URL y muestra UI base', async () => {
    setTestRole('manager');
    renderAt('#/dashboard?testMode=1');

    // UI base visible sin carga inicial
    const resetEls = await screen.findAllByText('Reset');
    expect(resetEls[0]).toBeTruthy();
    const refEls = await screen.findAllByLabelText('Con referencia');
    expect(refEls[0]).toBeTruthy();
  });

  it('Reports protegido: employee es redirigido a /dashboard', async () => {
    setTestRole('employee');
    renderAt('#/reports?testMode=1');

    await assertRedirect('/dashboard');
    expect(screen.queryByText('Reportes Avanzados')).toBeNull();
  });

  it('Reports con testMode=true no activa testMode y muestra spinner', async () => {
    setTestRole('admin');
    renderAt('#/reports?testMode=true');

    // En este alias, testMode queda desactivado, debe mostrar spinner inicial
    await assertSpinner('Cargando reportes avanzados...');
  });

  it.skip('Products respeta testMode=1 via URL y no muestra spinner inicial', async () => {
    renderAt('#/products?testMode=1');

    // Spinner principal no debería mostrarse en testMode
    assertNoSpinner('Cargando inventario...');
    // UI base visible: buscar por placeholder o por role textbox como fallback
    const inputsByPh = await screen.queryAllByPlaceholderText('Buscar por nombre, SKU, código de barras, marca...');
    if (inputsByPh.length > 0) {
      expect(inputsByPh[0]).toBeTruthy();
    } else {
      const textboxes = await screen.findAllByRole('textbox');
      expect(textboxes.length).toBeGreaterThan(0);
    }
  });

  it('Products respeta tm=1 via URL y muestra búsqueda', async () => {
    renderAt('#/products?tm=1');

    const phInputs = await screen.findAllByPlaceholderText('Buscar por nombre, SKU, código de barras, marca...');
    expect(phInputs.length).toBeGreaterThan(0);
  });

  it('Products con tm=true no activa testMode y muestra spinner', async () => {
    renderAt('#/products?tm=true');

    // En este alias negativo, testMode queda desactivado, debe mostrar spinner
    await assertSpinner('Cargando inventario...');
  });

  it('Clients respeta testMode=1 via URL y muestra UI sin carga', async () => {
    renderAt('#/clients?testMode=1');

    // SearchBar visible indica UI cargada sin spinner
    expect(await screen.findByPlaceholderText('Buscar clientes...')).toBeTruthy();
    // Botón de filtros presente
    expect(await screen.findByText('Filtros')).toBeTruthy();
  });

  it('Clients respeta tm=1 via URL y muestra UI sin carga', async () => {
    renderAt('#/clients?tm=1');

    // SearchBar visible
    expect(await screen.findByPlaceholderText('Buscar clientes...')).toBeTruthy();
  });

  it('Clients con testMode=0 no activa testMode y muestra spinner', async () => {
    renderAt('#/clients?testMode=0');

    // En este alias negativo, debe mostrar spinner inicial
    await assertSpinner();
  });

  it('Rankings con tm=true no activa testMode y muestra spinner', async () => {
    renderAt('#/rankings?tm=true');

    // En alias negativo, debe mostrar spinner inicial
    await assertSpinner();
  });

  it('Rankings con testMode=true no activa testMode y muestra spinner', async () => {
    renderAt('#/rankings?testMode=true');

    // Alias booleano incorrecto: el valor no es "1", por lo que no activa testMode
    await assertSpinner();
  });

  it('Reports respeta testMode=1 y no muestra spinner inicial', async () => {
    setTestRole('admin');
    renderAt('#/reports?testMode=1');

    // Ausencia de spinner inicial en testMode y UI base renderizada
    await waitFor(() => {
      expect(screen.queryByText('Cargando reportes avanzados...')).toBeNull();
    });
    expect(await screen.findByText('Filtros')).toBeTruthy();
  });

  it('Codes respeta testMode=1 y no muestra spinner inicial', async () => {
    renderAt('#/codes?testMode=1');

    // UI estable visible y sin spinner
    expect(await screen.findByText('códigos QR y códigos de Barras')).toBeTruthy();
    assertNoSpinner('Cargando productos...');
  });

  it('Codes con tm=true no activa testMode y muestra spinner inicial', async () => {
    renderAt('#/codes?tm=true');

    await assertSpinner('Cargando productos...');
  });

  it('Settings con testMode=true no activa testMode y muestra spinner inicial', async () => {
    setTestRole('admin');
    renderAt('#/settings?testMode=true');

    await assertSpinner();
  });
});
