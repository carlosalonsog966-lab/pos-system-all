import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useOfflineStore } from './store/offlineStore';
import { useNotificationStore } from './store/notificationStore';
import { useProductsStore } from './store/productsStore';
import { useClientsStore } from './store/clientsStore';
import { api, initializeApiBaseUrl, checkBackendStatus, backendStatus } from './lib/api';

// Componentes de layout
import Layout from './components/Layout/Layout';
import LoginPage from './pages/Auth/LoginPage';

// PÃ¡ginas principales (carga diferida)
const DashboardPage = React.lazy(() => import('./pages/Dashboard/DashboardPage'));
const SalesPage = React.lazy(() => import('./pages/Sales/SalesPage'));
const ProductsPage = React.lazy(() => import('./pages/Products/ProductsPage'));
const ClientsPage = React.lazy(() => import('./pages/Clients/ClientsPage'));
const CodesPage = React.lazy(() => import('./pages/Codes/CodesPage'));
const ReportsPage = React.lazy(() => import('./pages/Reports/ReportsPage'));
const RankingsPage = React.lazy(() => import('./pages/Rankings/RankingsPage'));
const SettingsPage = React.lazy(() => import('./pages/Settings/SettingsPage'));
const BackupPage = React.lazy(() => import('./pages/Backup/BackupPage').then(m => ({ default: m.BackupPage })));
const CashRegisterPage = React.lazy(() => import('./pages/CashRegister/CashRegisterPage'));
const UsersPage = React.lazy(() => import('./pages/Users/UsersPage'));
const ObservabilityPage = React.lazy(() => import('./pages/Observability/ObservabilityPage'));
const JobsDetailPage = React.lazy(() => import('./pages/Observability/JobsDetailPage'));
const HealthPage = React.lazy(() => import('./pages/Observability/HealthPage').then(m => ({ default: m.HealthPage })));
const JobsPage = React.lazy(() => import('./pages/Jobs/JobsPage'));
const InventoryPage = React.lazy(() => import('./pages/Inventory/InventoryPage'));
const AssetDocumentsPage = React.lazy(() => import('./pages/Assets/AssetDocumentsPage'));

// Componentes de utilidad
import OfflineIndicator from './components/Common/OfflineIndicator';
import ToastContainer from './components/Common/ToastContainer';
import LoadingSpinner from './components/Common/LoadingSpinner';
import { SyncStatus } from './components/Common/SyncStatus';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { initGlobalErrorHandlers } from './lib/globalErrorHandler';
import BackendStatusIndicator from './components/Common/BackendStatusIndicator';

// Componente de ruta protegida
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string[] }> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  // 🚨 BYPASS DE EMERGENCIA PARA PANTALLA NEGRA - Solo ejecutar si es necesario
  React.useEffect(() => {
    // Verificar si el sistema está atascado en modo offline
    const backendStatus = localStorage.getItem('__lastBackendStatus');
    const healthStatus = localStorage.getItem('__healthCheckStatus');
    const overrideStatus = localStorage.getItem('__backendStatusOverride');
    
    // Solo aplicar bypass si hay indicadores de problemas graves
    const shouldApplyBypass = backendStatus === 'down' || 
                             overrideStatus === 'offline' || 
                             (healthStatus && JSON.parse(healthStatus)?.status === 'error');
    
    if (shouldApplyBypass) {
      console.log('🚨 APLICANDO BYPASS DE EMERGENCIA PARA PANTALLA NEGRA');
      
      // Limpiar todo el estado de offline
      const keysToRemove = [
        '__lastBackendStatus',
        '__backendStatusOverride', 
        '__healthCheckStatus',
        'backendStatus',
        'lastHealthCheck',
        'offlineMode',
        'backendDown',
        'lastConnectionError'
      ];
      
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🧹 Limpiado: ${key}`);
        }
      });
      
      // Forzar sistema a modo online
      localStorage.setItem('__lastBackendStatus', 'up');
      localStorage.setItem('__backendStatusOverride', 'online');
      localStorage.setItem('__healthCheckStatus', JSON.stringify({ 
        status: 'healthy', 
        timestamp: Date.now(),
        forced: true 
      }));
      
      console.log('✅ BYPASS DE EMERGENCIA APLICADO');
    }
  }, []);

  // 🔊 CONFIGURACIÓN AUDIOCONTEXT PARA TAURI
  React.useEffect(() => {
    // Función para resumir AudioContext cuando el usuario interactúe
    const resumeAudioContext = () => {
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioCtx();
        
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
        }
      }
    };

    // Agregar listeners para eventos de usuario
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudioContext, { once: true });
    });

    // Limpiar listeners
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resumeAudioContext);
      });
    };
  }, []);

  // 🚨 MODO OFFLINE: Forzar backend como ready cuando esté en modo offline
  React.useEffect(() => {
    if (isOffline || (window as any).__TAURI_OFFLINE_MODE__) {
      console.log('🚨 MODO OFFLINE DETECTADO: Forzando backend como ready');
      setBackendReady(true);
      setCheckingBackend(false);
    }
  }, []);

  const { isAuthenticated, initializeAuth } = useAuthStore();
  const { isOffline } = useOfflineStore();
  const { notifications, position, removeNotification, showWarning, showError, clearAllNotifications } = useNotificationStore();
  
  // Estado de salud del backend
  const [backendReady, setBackendReady] = React.useState(false);
  const [checkingBackend, setCheckingBackend] = React.useState(true);
  const [currentBaseUrl, setCurrentBaseUrl] = React.useState<string>(api.defaults?.baseURL || '');

  // Inicializar baseURL del API y autenticación al cargar la app
  React.useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // Inicializar capturadores globales una sola vez
      initGlobalErrorHandlers();
      
      // 🚨 EN MODO OFFLINE, NO INTENTAR CONECTAR AL BACKEND
      if (isOffline || (window as any).__TAURI_OFFLINE_MODE__) {
        console.log('🚨 MODO OFFLINE: Saltando inicialización de backend');
        initializeAuth();
        setCurrentBaseUrl('/offline');
        return;
      }
      
      const base = await initializeApiBaseUrl();
      initializeAuth();
      if (!cancelled) {
        setCurrentBaseUrl(base);
      }
      if (import.meta.env.DEV) {
        try { backendStatus.applyOverride('ok'); } catch {}
      }
      if (!cancelled && base.includes('5656')) {
        showWarning('Conectado al backend en puerto 5656');
      }
    };
    init();
    return () => { cancelled = true; };
  }, [initializeAuth, showWarning, isOffline]);

  // Auto‑autenticación en desarrollo para habilitar API sin login manual
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      const st = useAuthStore.getState();
      if (!st.isAuthenticated || !st.token) {
        st.setToken('dev-token', 'dev-refresh');
        useAuthStore.setState({
          user: {
            id: 'dev-user',
            username: 'dev',
            email: 'dev@example.com',
            firstName: 'Dev',
            lastName: 'User',
            role: 'admin',
            isActive: true,
          } as any,
          isAuthenticated: true,
        } as any);
      }
    }
  }, []);

  // Chequeo de salud del backend al iniciar la app
  React.useEffect(() => {
    // 🚨 SALTAR CHEQUEO DE SALUD EN MODO OFFLINE
    if (isOffline || (window as any).__TAURI_OFFLINE_MODE__) {
      console.log('🚨 MODO OFFLINE: Saltando chequeo de salud del backend');
      return;
    }
    
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const status = await checkBackendStatus();
        if (cancelled) return;
        if (status === 'no_health') {
  showWarning('Servidor disponible sin /health. Usando endpoints públicos.');
        } else if (status === 'down') {
          showError('No se pudo contactar el backend (health/public).');
        }
      } catch {
        if (!cancelled) {
          showError('No se pudo contactar el backend (health/public).');
        }
      }
    };
    checkHealth();
    return () => { cancelled = true; };
  }, [showWarning, showError, isOffline]);
  React.useEffect(() => {
    // 🚨 EN MODO OFFLINE, MARCAR BACKEND COMO READY INMEDIATAMENTE
    if (isOffline || (window as any).__TAURI_OFFLINE_MODE__) {
      console.log('🚨 MODO OFFLINE: Backend marcado como ready sin chequeo');
      setBackendReady(true);
      setCheckingBackend(false);
      return;
    }
    
    let cancelled = false;
    const run = async () => {
      setCheckingBackend(true);
      try {
        const status = await checkBackendStatus();
        if (!cancelled) {
          setBackendReady(status === 'ok' || status === 'no_health');
        }
      } catch (err: unknown) {
        const code = (err as { response?: { status?: number } })?.response?.status;
        if (!cancelled && (code === 429 || code === 401)) {
          setBackendReady(true);
        } else if (!cancelled) {
          setBackendReady(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingBackend(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isOffline]);

  // Atajo global: ESC cierra la última notificación visible
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notifications.length > 0) {
        const last = notifications[notifications.length - 1];
        removeNotification(last.id);
      }
      const withCtrl = e.ctrlKey || e.metaKey
      const withShift = e.shiftKey
      if (withCtrl && withShift) {
        let path = ''
        if (e.code === 'KeyC') path = '/cash-register'
        else if (e.code === 'KeyP') path = '/products'
        else if (e.code === 'KeyS') path = '/sales'
        else if (e.code === 'KeyD') path = '/dashboard'
        else if (e.code === 'KeyF') {
          try { window.dispatchEvent(new CustomEvent('shortcut:focusSearch')) } catch {}
        }
        else if (e.code === 'KeyX') {
          try { clearAllNotifications() } catch { void 0 }
        }
        if (path) {
          try { window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: { path } })) } catch { void 0 }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [notifications, removeNotification, clearAllNotifications]);

  React.useEffect(() => {
    const smoke = async () => {
      try {
        const auth = useAuthStore.getState();
        auth.setToken('smoke-token', 'rt-smoke');
        useAuthStore.setState({ user: { id: 'u-smoke', username: 'smoke', email: 'smoke@example.com', firstName: 'Smoke', lastName: 'Test', role: 'admin', isActive: true }, isAuthenticated: true } as any);
        try { window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: { path: '/products' } })); } catch {}
        try { await useProductsStore.getState().loadProducts(); } catch {}
        try { window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: { path: '/sales' } })); } catch {}
        try { window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: { path: '/cash-register' } })); } catch {}
        try { useOfflineStore.getState().setOfflineStatus(true); } catch {}
        try { await useProductsStore.getState().loadProducts(); } catch {}
        try { useOfflineStore.getState().setOfflineStatus(false); } catch {}
        try { useOfflineStore.getState().addPendingAction({ type: 'CREATE_CLIENT', data: { firstName: 'Smoke', lastName: 'Test', email: 'smoke@example.com' }, priority: 'high', maxRetries: 3 }); } catch {}
        try { await useOfflineStore.getState().syncPendingActions(); } catch {}
        try { await useClientsStore.getState().loadClients(); } catch {}
        try { useNotificationStore.getState().showSuccess('Smoke', 'OK'); } catch {}
      } catch {}
    };
    try { (window as any).__smokeRun = smoke; } catch {}
  }, []);

  

  const recheckHealth = async () => {
    setCheckingBackend(true);
    try {
      const base = await initializeApiBaseUrl();
      setCurrentBaseUrl(base);
      const status = await checkBackendStatus(base);
      setBackendReady(status === 'ok' || status === 'no_health');
    } catch (err: unknown) {
      const code = (err as { response?: { status?: number } })?.response?.status;
      if (code === 429 || code === 401) {
        setBackendReady(true);
      } else {
        setBackendReady(false);
      }
    } finally {
      setCheckingBackend(false);
    }
  };

    // Gating: solo bloquear UI si el usuario ya está autenticado
    // y el backend está en verificación o caído. Permitir login siempre.
    if (isAuthenticated && (checkingBackend || !backendReady)) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
          <LoadingSpinner size="lg" />
          <div className="text-gray-700">
          {checkingBackend ? 'Conectando al servidor...' : 'Servidor no disponible'}
          </div>
          <div className="text-sm text-gray-500">
          Base URL: {currentBaseUrl || api.defaults?.baseURL}
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={recheckHealth}
            disabled={checkingBackend}
          >
            {checkingBackend ? 'Reintentando...' : 'Reintentar conexión'}
          </button>
        </div>
      );
    }

  // En desarrollo, usar HashRouter para facilitar rutas profundas en previews
  const isDev = import.meta.env.DEV;
  const RouterComponent = BrowserRouter;

  // Rutas internas que leen testMode desde query params y lo propagan a páginas
  function AppInnerRoutes() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const testMode = (searchParams.get('testMode') ?? searchParams.get('tm')) === '1';
    React.useEffect(() => {
      const handler = (e: Event) => {
        try {
          const ev = e as CustomEvent<{ path?: string }>;
          const path = ev.detail?.path || '/login';
          navigate(path, { replace: true });
        } catch {}
      };
      window.addEventListener('auth:redirect', handler as EventListener);
      window.addEventListener('shortcut:navigate', handler as EventListener);
      return () => window.removeEventListener('auth:redirect', handler as EventListener);
    }, [navigate]);
    return (
      <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Ruta de login */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            } 
          />

          {/* Ruta de prueba para driver dual */}


          {/* Ruta sin protección para /codes en modo desarrollo */}
          {isDev && (
            <Route
              path="/codes/*"
              element={
                <Layout>
                  <React.Suspense fallback={<LoadingSpinner size="lg" />}> 
                    <CodesPage testMode={testMode} />
                  </React.Suspense>
                </Layout>
              }
            />
        )}

        {/* Rutas protegidas */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <React.Suspense fallback={<LoadingSpinner size="lg" />}> 
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage testMode={testMode} />} />
                  <Route path="/sales/*" element={<SalesPage testMode={testMode} />} />
                  <Route path="/products/*" element={<ProductsPage testMode={testMode} />} />
                  <Route path="/inventory/*" element={<InventoryPage testMode={testMode} />} />
                  <Route path="/assets/:assetId/docs" element={<AssetDocumentsPage />} />
                  <Route path="/clients/*" element={<ClientsPage testMode={testMode} />} />
                  <Route 
                    path="/users/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <UsersPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/codes/*" element={<CodesPage testMode={testMode} />} />
                  <Route path="/cash-register/*" element={<CashRegisterPage testMode={testMode} />} />
                  <Route 
                    path="/reports/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <ReportsPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/rankings/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager', 'employee']}>
                        <RankingsPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/observability/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <ObservabilityPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/observability/health" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <HealthPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/observability/jobs" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <JobsDetailPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/jobs/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin', 'manager']}>
                        <JobsPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/settings/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin']}>
                        <SettingsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/backup/*" 
                    element={
                      <ProtectedRoute requiredRole={['admin']}>
                        <BackupPage testMode={testMode} />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/" element={<Navigate to="/products" replace />} />
                  <Route path="*" element={<Navigate to="/products" replace />} />
                </Routes>
                </React.Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  return (
    <ErrorBoundary>
    <RouterComponent
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <div id="toaster" role="status" data-testid="ui.toast" className="fixed top-2 right-2 z-50 hidden" />
        {/* Indicador de modo offline */}
        {isOffline && <OfflineIndicator />}

        {/* Contenedor de notificaciones */}
        <ToastContainer 
          toasts={notifications} 
          onRemoveToast={removeNotification}
          position={position}
        />

        {/* Botón para cerrar todas las notificaciones */}
        {notifications.length > 0 && (
          <div className="fixed top-2 right-2 z-50 pointer-events-auto">
            <button
              onClick={clearAllNotifications}
              className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded shadow hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
              aria-label="Cerrar todas las notificaciones"
            >
              Cerrar todas
            </button>
          </div>
        )}

        {/* Estado de sincronización (solo para usuarios autenticados) */}
        {isAuthenticated && (
          <div className="fixed bottom-4 right-4 z-40">
            <SyncStatus compact />
          </div>
        )}

        <BackendStatusIndicator />

        <AppInnerRoutes />
      </div>
    </RouterComponent>
    </ErrorBoundary>
  );
}

export default App;
