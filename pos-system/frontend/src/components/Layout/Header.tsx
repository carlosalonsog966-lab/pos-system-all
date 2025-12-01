import React, { useState, useEffect, useCallback } from 'react';
import type { AxiosRequestConfig } from 'axios';
import { Menu, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import { useOfflineStore } from '@/store/offlineStore';
import { backendStatus, api, initializeApiBaseUrl } from '@/lib/api';

interface HeaderProps {
  onMenuClick: () => void;
}

interface Alert {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  productId?: string;
  productName?: string;
  currentStock?: number;
  minStock?: number;
}

const Header: React.FC<HeaderProps> = React.memo(({ onMenuClick }) => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const { isOffline, pendingActions } = useOfflineStore();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // Evitar actualizaciones redundantes del estado comparando el hash de alertas normalizadas
  const lastAlertsHashRef = React.useRef<string>('');
  // Estado de notificaciones eliminado por no uso
  const [loading, setLoading] = useState(false);
  const [backendConnectionStatus, setBackendConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [checkingBackend, setCheckingBackend] = useState(false);
  
  // Refs para prevenir actualizaciones de estado cuando el componente está desmontado
  const isMountedRef = React.useRef(true);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      // Leer estado actual directamente para evitar capturar dependencias inestables
      const { isOffline: offlineNow } = useOfflineStore.getState();
      const { isAuthenticated: authNow } = useAuthStore.getState();
      // Si estamos offline, no intentar llamar al backend
      if (offlineNow) {
        if (isMountedRef.current) setAlerts([]);
        return;
      }
      // Evitar llamadas si no hay sesión iniciada
      if (!authNow) {
        if (isMountedRef.current) setAlerts([]);
        return;
      }
      // Asegurar baseURL inicializada antes de llamar
      try { await initializeApiBaseUrl(); } catch (e) { console.debug('initializeApiBaseUrl falló en Header', e); }
      const response = await api.get('/inventory/alerts', { __suppressGlobalError: true } as AxiosRequestConfig & { __suppressGlobalError?: boolean });
      const payload = response.data;
      const alertsData = Array.isArray(payload)
        ? payload
        : (payload?.data?.alerts || payload?.alerts || []);
      const rawAlerts: Alert[] = Array.isArray(alertsData) ? alertsData : [];
      const seenCounts = new Map<string, number>();
      const normalized = rawAlerts.map((a) => {
        const composite = `${a.type}|${a.productId ?? 'na'}|${a.title ?? 'na'}|${a.timestamp ?? 'na'}`;
        const baseId = a.id || composite;
        const prev = seenCounts.get(baseId) || 0;
        seenCounts.set(baseId, prev + 1);
        const id = prev === 0 ? baseId : `${baseId}#${prev}`;
        return { ...a, id };
      });
      const nextHash = JSON.stringify(normalized);
      if (nextHash !== lastAlertsHashRef.current && isMountedRef.current) {
        lastAlertsHashRef.current = nextHash;
        setAlerts(normalized);
      }
    } catch (error) {
      console.warn('Error fetching alerts, using empty list');
      // No mostrar error al usuario para alertas, usar lista vacía sólo si cambia
      if (lastAlertsHashRef.current !== '[]' && isMountedRef.current) {
        lastAlertsHashRef.current = '[]';
        setAlerts([]);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const run = async () => { 
      if (isMountedRef.current) await fetchAlerts(); 
    };
    run();
    // Actualizar alertas cada 5 minutos
    const interval = setInterval(() => { 
      if (isMountedRef.current) fetchAlerts(); 
    }, 5 * 60 * 1000);
    return () => { 
      isMountedRef.current = false; 
      clearInterval(interval); 
    };
  }, [fetchAlerts]);

  // Health-check global del backend para mostrar estado de conexión
  useEffect(() => {
    isMountedRef.current = true;
    if (isMountedRef.current) setCheckingBackend(true);
    
    // Ref para rastrear el último estado y evitar actualizaciones redundantes
    const lastStatusRef = { current: 'connected' as 'connected' | 'reconnecting' | 'disconnected' };
    
    // Throttle para evitar actualizaciones muy frecuentes
    let updateTimeout: NodeJS.Timeout | null = null;
    
    const handler = (status: 'ok' | 'no_health' | 'down') => {
      if (!isMountedRef.current) return;
      
      const newStatus = status === 'down' ? 'disconnected' : 'connected';
      
      // Solo actualizar si el estado realmente cambió
      if (newStatus !== lastStatusRef.current) {
        // Limpiar timeout anterior si existe
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        
        // Aplicar throttle: esperar 500ms antes de actualizar
        updateTimeout = setTimeout(() => {
          if (isMountedRef.current && newStatus !== lastStatusRef.current) {
            lastStatusRef.current = newStatus;
            setBackendConnectionStatus(newStatus);
            setCheckingBackend(false);
          }
        }, 500);
      }
    };
    
    try {
      const canOn = typeof (backendStatus as any)?.onStatus === 'function';
      // Solo suscribirse, no iniciar polling (ya está iniciado globalmente)
      if (canOn) (backendStatus as any).onStatus(handler);
    } catch (e) {
      console.debug('No se pudo suscribir al estado del backend', e);
      if (isMountedRef.current) setCheckingBackend(false);
    }
    
    return () => {
      isMountedRef.current = false;
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      try {
        const canOff = typeof (backendStatus as any)?.offStatus === 'function';
        if (canOff) (backendStatus as any).offStatus(handler);
      } catch (e) {
        console.debug('No se pudo cancelar la suscripción de estado del backend', e);
      }
    };
  }, []);

  // Cleanup cuando el componente se desmonta
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Memoizar valores para evitar re-renderizados
  const offlineIndicator = React.useMemo(() => {
    if (!isOffline) return null;
    return (
      <div className="flex items-center space-x-2 text-sm text-orange-600">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        <span>Sin conexión</span>
        {pendingActions.length > 0 && (
          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
            {pendingActions.length} pendientes
          </span>
        )}
      </div>
    );
  }, [isOffline, pendingActions.length]);

  const backendStatusIndicator = React.useMemo(() => (
    <div className="hidden md:flex items-center space-x-2 text-sm text-gray-700">
      <div
        className={`w-2 h-2 rounded-full ${
          backendConnectionStatus === 'connected'
            ? 'bg-green-500'
            : backendConnectionStatus === 'reconnecting'
            ? 'bg-yellow-500'
            : 'bg-red-500'
        }`}
        title={checkingBackend ? 'Verificando servidor...' : 'Estado del servidor'}
      />
      <span className="px-2 py-1 rounded border">
        {checkingBackend
          ? 'Conectando...'
          : backendConnectionStatus === 'connected'
          ? 'Servidor: Conectado'
          : backendConnectionStatus === 'reconnecting'
          ? 'Servidor: Reintentando'
          : 'Servidor: Desconectado'}
      </span>
    </div>
  ), [backendConnectionStatus, checkingBackend]);

  const handleLogout = React.useCallback(() => {
    logout();
  }, [logout]);

  const handleProfileClick = React.useCallback(() => {
    navigate('/settings?tab=profile');
  }, [navigate]);

  const handleSettingsClick = React.useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const getAlertIcon = React.useCallback((type: string) => {
    switch (type) {
      case 'critical':
      case 'high':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'medium':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <ExclamationTriangleIcon className="w-5 h-5 text-gray-500" />;
    }
  }, []);

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Botón de menú móvil */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Abrir sidebar</span>
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Separador */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Título de la página */}
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Sistema POS - Joyería
          </h1>
        </div>

        {/* Espacio flexible */}
        <div className="flex flex-1" />

        {/* Indicadores y acciones */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Indicador de estado offline */}
          {offlineIndicator}

          {/* Indicador de estado del backend (global) */}
          {backendStatusIndicator}

          {/* Notificaciones */}
          <Menu as="div" className="relative">
            <Menu.Button className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative">
              <span className="sr-only">Ver notificaciones</span>
              <BellIcon className="h-6 w-6" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </Menu.Button>
            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2.5 w-80 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
                  {loading && <p className="text-xs text-gray-500">Cargando...</p>}
                </div>
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No hay alertas activas</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {alerts.map((alert) => (
                      <Menu.Item key={alert.id}>
                        {({ active }) => (
                          <div
                            className={`${
                              active ? 'bg-gray-50' : ''
                            } px-4 py-3 border-b border-gray-100 last:border-b-0`}
                          >
                            <div className="flex items-start gap-3">
                              {getAlertIcon(alert.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {alert.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {alert.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(alert.timestamp).toLocaleString('es-CO')}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </Menu.Item>
                    ))}
                  </div>
                )}
                {alerts.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-200">
                    <button
                      onClick={fetchAlerts}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={loading}
                    >
                      {loading ? 'Actualizando...' : 'Actualizar'}
                    </button>
                  </div>
                )}
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Separador */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

          {/* Menú de perfil */}
          <Menu as="div" className="relative">
            <Menu.Button className="-m-1.5 flex items-center p-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className="sr-only">Abrir menú de usuario</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="ml-4 text-sm font-semibold leading-6 text-gray-900">
                  {user?.firstName} {user?.lastName}
                </span>
              </span>
            </Menu.Button>
            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2.5 min-w-[220px] origin-top-right rounded-lg bg-white p-1 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                {/* Cabecera de cuenta */}
                <div className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.firstName || user?.lastName ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() : user?.username}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-1 text-xs font-semibold text-gray-500">Cuenta</div>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleProfileClick}
                      className={`${
                        active ? 'bg-gray-50' : ''
                      } flex w-full items-center gap-2 px-3 py-2 text-sm leading-6 text-gray-900 whitespace-nowrap rounded-md`}
                      aria-label="Ir al perfil"
                    >
                      <UserCircleIcon className="mr-2 h-4 w-4" />
                      Perfil
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleSettingsClick}
                      className={`${
                        active ? 'bg-gray-50' : ''
                      } flex w-full items-center gap-2 px-3 py-2 text-sm leading-6 text-gray-900 whitespace-nowrap rounded-md`}
                      aria-label="Abrir configuración"
                    >
                      <CogIcon className="mr-2 h-4 w-4" />
                      Configuración
                    </button>
                  )}
                </Menu.Item>
                <div className="my-1 border-t border-gray-100" />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-gray-50' : ''
                      } flex w-full items-center gap-2 px-3 py-2 text-sm leading-6 text-red-600 whitespace-nowrap rounded-md`}
                      aria-label="Cerrar sesión"
                    >
                      <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                      Cerrar sesión
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  );
});

export default Header;
