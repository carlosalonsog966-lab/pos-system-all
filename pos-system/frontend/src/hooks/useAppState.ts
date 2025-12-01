import { useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useOfflineStore } from '@/store/offlineStore';
import { useNotificationStore } from '@/store/notificationStore';
import { usePersistence } from './usePersistence';
import { useProductsStore } from '@/store/productsStore';
import { useClientsStore } from '@/store/clientsStore';

export interface AppStateConfig {
  autoSync?: boolean;
  syncInterval?: number;
  maxNotifications?: number;
  notificationPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
  language?: 'es' | 'en';
}

export interface AppStateMetrics {
  pendingActions: number;
  failedActions: number;
  lastSync: number | null;
  isOnline: boolean;
  syncInProgress: boolean;
  totalNotifications: number;
  userRole: string | null;
  sessionDuration: number;
}

export interface UseAppStateReturn {
  // Estado general
  isInitialized: boolean;
  isLoading: boolean;
  config: AppStateConfig;
  metrics: AppStateMetrics;
  
  // Funciones de configuración
  updateConfig: (newConfig: Partial<AppStateConfig>) => void;
  resetConfig: () => void;
  
  // Funciones de estado
  refreshAppState: () => Promise<void>;
  exportAppData: () => string;
  importAppData: (data: string) => Promise<boolean>;
  
  // Funciones de limpieza
  clearAllData: () => Promise<void>;
  clearUserData: () => Promise<void>;
  
  // Estado de conectividad
  retryConnection: () => Promise<void>;
  forceSync: () => Promise<void>;
}

const defaultConfig: AppStateConfig = {
  autoSync: true,
  syncInterval: 30000,
  maxNotifications: 5,
  notificationPosition: 'top-right',
  theme: 'light',
  language: 'es',
};

export const useAppState = (): UseAppStateReturn => {
  // Stores
  const { user, isAuthenticated, logout } = useAuthStore();
  const { 
    isOffline, 
    pendingActions, 
    syncStatus, 
    syncInProgress,
    setAutoSync,
    setSyncInterval,
    syncPendingActions,
    retryFailedActions,
    clearPendingActions
  } = useOfflineStore();
  const { 
    notifications, 
    // position,
    // maxNotifications,
    setPosition,
    setMaxNotifications,
    clearAllNotifications
  } = useNotificationStore();

  // Bootstrap de datos persistentes (productos y clientes)
  const { loadProducts } = useProductsStore();
  const { loadClients } = useClientsStore();

  // Persistencia de configuración
  const { value: config, setValue: setConfig } = usePersistence<AppStateConfig>({
    key: 'app-config',
    defaultValue: defaultConfig,
    storage: localStorage,
  });

  // Estado de sesión
  const { value: sessionStart } = usePersistence<number>({
    key: 'session-start',
    defaultValue: Date.now(),
    storage: sessionStorage,
  });

  // Estado de inicialización
  const { value: isInitialized, setValue: setIsInitialized } = usePersistence<boolean>({
    key: 'app-initialized',
    defaultValue: false,
    storage: sessionStorage,
  });

  // Métricas calculadas
  const metrics = useMemo<AppStateMetrics>(() => ({
    pendingActions: pendingActions.length,
    failedActions: syncStatus.failedActions,
    lastSync: syncStatus.lastSync,
    isOnline: !isOffline,
    syncInProgress,
    totalNotifications: notifications.length,
    userRole: user?.role || null,
    sessionDuration: Date.now() - sessionStart,
  }), [
    pendingActions.length,
    syncStatus.failedActions,
    syncStatus.lastSync,
    isOffline,
    syncInProgress,
    notifications.length,
    user?.role,
    sessionStart
  ]);

  // Bootstrap inicial: cargar productos y clientes al arrancar si estamos online
  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!isOffline) {
          console.log('🚀 Iniciando carga de datos...');
          
          const results = await Promise.allSettled([loadProducts(), loadClients()]);
          
          // Log results for debugging
          results.forEach((result, index) => {
            const storeName = index === 0 ? 'productos' : 'clientes';
            if (result.status === 'fulfilled') {
              console.log(`✅ Store de ${storeName} cargado exitosamente`);
            } else {
              console.warn(`⚠️ Error al cargar store de ${storeName}:`, result.reason);
            }
          });
          
          // Check if all stores failed
          const allFailed = results.every(result => result.status === 'rejected');
          if (allFailed) {
            console.error('❌ Todos los stores fallaron al cargar. La aplicación usará datos en caché si están disponibles.');
          } else {
            console.log('✅ Bootstrap completado');
          }
        } else {
          console.log('📱 Modo offline detectado, omitiendo carga inicial de datos');
        }
      } catch (e) {
        console.error('💥 Error crítico en bootstrap:', e);
        // Los stores ya manejan su propio error state, pero logueamos para debugging
      }
    };
    
    bootstrap();
    // Reintentar cuando volvemos online
  }, []);

  // Actualizar configuración
  const updateConfig = useCallback((newConfig: Partial<AppStateConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);

    // Aplicar cambios inmediatamente
    if (newConfig.autoSync !== undefined) {
      setAutoSync(newConfig.autoSync);
    }
    if (newConfig.syncInterval !== undefined) {
      setSyncInterval(newConfig.syncInterval);
    }
    if (newConfig.maxNotifications !== undefined) {
      setMaxNotifications(newConfig.maxNotifications);
    }
    if (newConfig.notificationPosition !== undefined) {
      setPosition(newConfig.notificationPosition);
    }
  }, [config, setConfig, setAutoSync, setSyncInterval, setMaxNotifications, setPosition]);

  // Resetear configuración
  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setAutoSync(defaultConfig.autoSync!);
    setSyncInterval(defaultConfig.syncInterval!);
    setMaxNotifications(defaultConfig.maxNotifications!);
    setPosition(defaultConfig.notificationPosition!);
  }, [setConfig, setAutoSync, setSyncInterval, setMaxNotifications, setPosition]);

  // Refrescar estado de la aplicación
  const refreshAppState = useCallback(async () => {
    try {
      // await refreshAuth(); // refreshAuth no existe en useAuthStore
      if (!isOffline && pendingActions.length > 0) {
        await syncPendingActions();
      }
    } catch (error) {
      console.error('Error refreshing app state:', error);
    }
  }, [isOffline, pendingActions.length, syncPendingActions]);

  // Exportar datos de la aplicación
  const exportAppData = useCallback(() => {
    const exportData = {
      config,
      metrics,
      pendingActions,
      notifications: notifications.map(n => ({ ...n })),
      exportDate: Date.now(),
      version: '1.0',
    };
    return JSON.stringify(exportData, null, 2);
  }, [config, metrics, pendingActions, notifications]);

  // Importar datos de la aplicación
  const importAppData = useCallback(async (data: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.config) {
        updateConfig(parsed.config);
      }
      
      // Nota: Las acciones pendientes y notificaciones se manejan en sus respectivos stores
      return true;
    } catch (error) {
      console.error('Error importing app data:', error);
      return false;
    }
  }, [updateConfig]);

  // Limpiar todos los datos
  const clearAllData = useCallback(async () => {
    try {
      await logout();
      clearPendingActions();
      clearAllNotifications();
      resetConfig();
      setIsInitialized(false);
      
      // Limpiar almacenamiento local
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('app-') || key.startsWith('pos-')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Limpiar almacenamiento de sesión
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }, [logout, clearPendingActions, clearAllNotifications, resetConfig, setIsInitialized]);

  // Limpiar solo datos de usuario
  const clearUserData = useCallback(async () => {
    try {
      await logout();
      clearAllNotifications();
      
      // Mantener configuración pero limpiar datos sensibles
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('user') || key.includes('auth') || key.includes('session')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  }, [logout, clearAllNotifications]);

  // Reintentar conexión
  const retryConnection = useCallback(async () => {
    try {
      // Verificar conectividad
      const response = await api.head('/health', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.status < 400) {
        // Si la conexión es exitosa, intentar sincronizar
        await syncPendingActions();
      }
    } catch (error) {
      console.error('Connection retry failed:', error);
    }
  }, [syncPendingActions]);

  // Forzar sincronización
  const forceSync = useCallback(async () => {
    try {
      await retryFailedActions();
      await syncPendingActions();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  }, [retryFailedActions, syncPendingActions]);

  // Inicialización de la aplicación
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Aplicar configuración guardada
        if (config.autoSync !== undefined) {
          setAutoSync(config.autoSync);
        }
        if (config.syncInterval !== undefined) {
          setSyncInterval(config.syncInterval);
        }
        if (config.maxNotifications !== undefined) {
          setMaxNotifications(config.maxNotifications);
        }
        if (config.notificationPosition !== undefined) {
          setPosition(config.notificationPosition);
        }

        // Marcar como inicializado
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [
    isInitialized,
    config,
    setAutoSync,
    setSyncInterval,
    setMaxNotifications,
    setPosition,
    setIsInitialized
  ]);

  // Sincronización automática cuando se recupera la conexión
  useEffect(() => {
    if (!isOffline && isAuthenticated && pendingActions.length > 0 && config.autoSync) {
      const timer = setTimeout(() => {
        syncPendingActions();
      }, 1000); // Esperar 1 segundo antes de sincronizar

      return () => clearTimeout(timer);
    }
  }, [isOffline, isAuthenticated, pendingActions.length, config.autoSync, syncPendingActions]);

  return {
    isInitialized,
    isLoading: syncInProgress,
    config,
    metrics,
    updateConfig,
    resetConfig,
    refreshAppState,
    exportAppData,
    importAppData,
    clearAllData,
    clearUserData,
    retryConnection,
    forceSync,
  };
};
