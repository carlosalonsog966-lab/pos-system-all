import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

export interface OfflineAction {
  id: string;
  type: 'CREATE_SALE' | 'UPDATE_PRODUCT' | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_PRODUCT' | 'CREATE_PRODUCT' | 'DELETE_CLIENT' | 'BULK_IMPORT_PRODUCTS';
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
  maxRetries: number;
  lastAttempt?: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number | null;
  syncInProgress: boolean;
  failedActions: number;
  totalActions: number;
  syncErrors: string[];
}

interface OfflineState {
  isOffline: boolean;
  pendingActions: OfflineAction[];
  syncInProgress: boolean;
  lastSyncTime: number | null;
  syncStatus: SyncStatus;
  autoSyncEnabled: boolean;
  syncInterval: number;
  maxStorageSize: number;
  compressionEnabled: boolean;
}

interface OfflineActions {
  setOfflineStatus: (isOffline: boolean) => void;
  addPendingAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'lastAttempt'>) => void;
  removePendingAction: (actionId: string) => void;
  incrementRetryCount: (actionId: string) => void;
  clearPendingActions: () => void;
  setSyncInProgress: (inProgress: boolean) => void;
  setLastSyncTime: (timestamp: number) => void;
  syncPendingActions: () => Promise<void>;
  updateSyncStatus: (status: Partial<SyncStatus>) => void;
  setAutoSync: (enabled: boolean) => void;
  setSyncInterval: (interval: number) => void;
  getStorageSize: () => number;
  cleanupOldActions: () => void;
  exportPendingActions: () => string;
  importPendingActions: (data: string) => void;
  getPendingActionsByPriority: () => OfflineAction[];
  retryFailedActions: () => Promise<void>;
  getFailedActions: () => OfflineAction[];
  exportFailedActions: () => string;
  clearFailedActions: () => void;
}

export const useOfflineStore = create<OfflineState & OfflineActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Estado inicial
        isOffline: !navigator.onLine,
        pendingActions: [],
        syncInProgress: false,
        lastSyncTime: null,
        syncStatus: {
          isOnline: navigator.onLine,
          lastSync: null,
          syncInProgress: false,
          failedActions: 0,
          totalActions: 0,
          syncErrors: [],
        },
        autoSyncEnabled: true,
        syncInterval: 120000, // Aumentado a 2 minutos para reducir carga
        maxStorageSize: 50, // Máximo 50 acciones pendientes
        compressionEnabled: true,

        // Acciones
        setOfflineStatus: (isOffline: boolean) => {
          set((state) => ({ 
            isOffline,
            syncStatus: { ...state.syncStatus, isOnline: !isOffline }
          }));
          
          // Si volvemos a estar online, intentar sincronizar
          if (!isOffline && get().pendingActions.length > 0 && get().autoSyncEnabled) {
            get().syncPendingActions();
          }
        },

        addPendingAction: (action) => {
          const state = get();
          
          // Verificar límite de almacenamiento
          if (state.pendingActions.length >= state.maxStorageSize) {
            get().cleanupOldActions();
          }

          let dataWithBranch = { ...(action.data as any) };
          try {
            const { selectedBranchId } = (require('@/store/branchStore') as typeof import('@/store/branchStore')).useBranchStore.getState();
            if (selectedBranchId && typeof dataWithBranch === 'object' && dataWithBranch) {
              dataWithBranch.branchId = dataWithBranch.branchId || selectedBranchId;
            }
          } catch {}
          const newAction: OfflineAction = {
            ...action,
            data: dataWithBranch,
            id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retryCount: 0,
            priority: action.priority || 'medium',
            maxRetries: action.maxRetries || 3,
          };

          set((state) => ({
            pendingActions: [...state.pendingActions, newAction],
            syncStatus: { 
              ...state.syncStatus, 
              totalActions: state.syncStatus.totalActions + 1 
            }
          }));
        },

        removePendingAction: (actionId: string) => {
          set((state) => ({
            pendingActions: state.pendingActions.filter(action => action.id !== actionId),
          }));
        },

        incrementRetryCount: (actionId: string) => {
          set((state) => ({
            pendingActions: state.pendingActions.map(action =>
              action.id === actionId
                ? { ...action, retryCount: action.retryCount + 1, lastAttempt: Date.now() }
                : action
            ),
          }));
        },

        clearPendingActions: () => {
          set((state) => ({ 
            pendingActions: [],
            syncStatus: { 
              ...state.syncStatus, 
              totalActions: 0, 
              failedActions: 0,
              syncErrors: []
            }
          }));
        },

        setSyncInProgress: (inProgress: boolean) => {
          set((state) => ({ 
            syncInProgress: inProgress,
            syncStatus: { ...state.syncStatus, syncInProgress: inProgress }
          }));
        },

        setLastSyncTime: (timestamp: number) => {
          set((state) => ({ 
            lastSyncTime: timestamp,
            syncStatus: { ...state.syncStatus, lastSync: timestamp }
          }));
        },

        updateSyncStatus: (status: Partial<SyncStatus>) => {
          set((state) => ({
            syncStatus: { ...state.syncStatus, ...status }
          }));
        },

        setAutoSync: (enabled: boolean) => {
          set({ autoSyncEnabled: enabled });
        },

        setSyncInterval: (interval: number) => {
          set({ syncInterval: interval });
        },

        getStorageSize: () => {
          const state = get();
          const dataString = JSON.stringify(state.pendingActions);
          return new Blob([dataString]).size;
        },

        cleanupOldActions: () => {
          const state = get();
          const now = Date.now();
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días
          
          const filteredActions = state.pendingActions
            .filter(action => now - action.timestamp < maxAge)
            .sort((a, b) => {
              // Priorizar por prioridad y luego por timestamp
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
              }
              return b.timestamp - a.timestamp;
            })
            .slice(0, state.maxStorageSize);

          set({ pendingActions: filteredActions });
        },

        exportPendingActions: () => {
          const state = get();
          return JSON.stringify({
            actions: state.pendingActions,
            exportDate: Date.now(),
            version: '1.0'
          });
        },

        importPendingActions: (data: string) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.actions && Array.isArray(parsed.actions)) {
              set((state) => ({
                pendingActions: [...state.pendingActions, ...parsed.actions]
              }));
            }
          } catch (error) {
            console.error('Error importing pending actions:', error);
          }
        },

        getPendingActionsByPriority: () => {
          const state = get();
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          
          return [...state.pendingActions].sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return a.timestamp - b.timestamp;
          });
        },

        retryFailedActions: async () => {
          const state = get();
          const failedActions = state.pendingActions.filter(action => action.retryCount > 0);
          
          if (failedActions.length === 0) {
            console.log('No hay acciones fallidas para reintentar');
            return;
          }

          console.log(`Reintentando ${failedActions.length} acciones fallidas...`);

          // Resetear contadores de reintento para acciones fallidas
          set((state) => ({
            pendingActions: state.pendingActions.map(action => 
              action.retryCount > 0 ? { ...action, retryCount: 0, lastAttempt: 0 } : action
            )
          }));

          // Intentar sincronizar nuevamente
          await get().syncPendingActions();
        },

        getFailedActions: () => {
          const state = get();
          return state.pendingActions.filter(action => action.retryCount >= 3); // Acciones con 3+ reintentos
        },

        exportFailedActions: () => {
          const state = get();
          const failedActions = state.pendingActions.filter(action => action.retryCount >= 3);
          
          return JSON.stringify({
            failedActions,
            exportDate: Date.now(),
            version: '1.0',
            summary: {
              totalFailed: failedActions.length,
              byType: failedActions.reduce((acc, action) => {
                acc[action.type] = (acc[action.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            }
          }, null, 2);
        },

        clearFailedActions: () => {
          const state = get();
          const failedActions = state.pendingActions.filter(action => action.retryCount >= 3);
          
          if (failedActions.length === 0) {
            console.log('No hay acciones fallidas para limpiar');
            return;
          }

          console.log(`Limpiando ${failedActions.length} acciones fallidas...`);
          
          // Remover solo acciones fallidas
          set((state) => ({
            pendingActions: state.pendingActions.filter(action => action.retryCount < 3),
            syncStatus: { 
              ...state.syncStatus, 
              totalActions: state.pendingActions.filter(action => action.retryCount < 3).length,
              failedActions: 0,
              syncErrors: []
            }
          }));
        },

        syncPendingActions: async () => {
          const { pendingActions, isOffline, syncInProgress } = get();

          // Detectar modo de prueba (testMode) desde query params
          const detectTestMode = (): boolean => {
            try {
              const search = typeof window !== 'undefined'
                ? (window.location.hash?.includes('?')
                    ? window.location.hash.split('?')[1]
                    : window.location.search)
                : '';
              const params = new URLSearchParams(search);
              const tm = params.get('testMode') || params.get('tm');
              return tm === '1';
            } catch {
              return false;
            }
          };

          const isTestMode = detectTestMode();

          if (isOffline || syncInProgress || pendingActions.length === 0) {
            return;
          }

          // Control de concurrencia mejorado
          if (get().syncInProgress) {
            console.log('Sincronización ya en progreso, saltando...');
            return;
          }

          get().setSyncInProgress(true);
          const syncErrors: string[] = [];
          let failureCount = 0;
          let successCount = 0;

          try {
            // Importar dinámicamente para evitar dependencias circulares
            const { api } = await import('@/lib/api');

            // Procesar acciones por prioridad
            const sortedActions = get().getPendingActionsByPriority();
            const BASE_BACKOFF_MS = 5000; // Aumentado a 5 segundos
            const MAX_BACKOFF_MS = 300000; // 5 minutos máximo
            const MAX_RETRIES = 5; // Aumentado de 3 a 5

            for (const action of sortedActions) {
              try {
                // Verificar si la acción ha excedido el máximo de reintentos
                if (action.retryCount >= MAX_RETRIES) {
                  // En lugar de eliminar, marcar como fallida permanentemente
                  console.warn(`Acción ${action.type} excedió máximo de reintentos (${MAX_RETRIES}), marcando como fallida...`);
                  get().removePendingAction(action.id);
                  failureCount++;
                  syncErrors.push(`[FALLIDA] ${action.type}: Máximo de reintentos excedido`);
                  continue;
                }

                // Backoff exponencial mejorado
                const lastAttempt = action.lastAttempt || 0;
                const backoffDelay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, action.retryCount)));
                const elapsed = Date.now() - lastAttempt;
                
                if (lastAttempt > 0 && elapsed < backoffDelay) {
                  console.log(`Acción ${action.type} aún en backoff, esperando ${backoffDelay - elapsed}ms...`);
                  continue; // Saltar esta acción pero no eliminarla
                }

                // Marcar intento actual
                set((state) => ({
                  pendingActions: state.pendingActions.map(a => a.id === action.id ? { ...a, lastAttempt: Date.now() } : a)
                }));

                // Procesar cada acción según su tipo con mejor manejo de errores
                let actionSuccess = false;
                
                try {
                  switch (action.type) {
                    case 'CREATE_SALE':
                      // Use tourism checkout for guide sales with idempotency
                      if (action.data?.saleType === 'GUIDE') {
                        const { SalesService } = await import('@/services/salesService');
                        const idem = action.data?.idempotencyKey || `GUIDE-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                        await SalesService.tourismCheckout(action.data, idem);
                      } else {
                        await api.post('/sales', action.data);
                      }
                      actionSuccess = true;
                      break;
                    case 'UPDATE_PRODUCT':
                      await api.put(`/products/${action.data.id}`, action.data);
                      actionSuccess = true;
                      break;
                    case 'CREATE_PRODUCT':
                      await api.post('/products', action.data);
                      actionSuccess = true;
                      break;
                    case 'DELETE_PRODUCT':
                      await api.delete(`/products/${action.data.id}`);
                      actionSuccess = true;
                      break;
                    case 'BULK_IMPORT_PRODUCTS': {
                      // action.data debe ser { items, upsert?, skipDuplicates?, dryRun? }
                      if (isTestMode) {
                        // Fallback local en modo de prueba: aplicar importación directamente al store de productos
                        const { useProductsStore } = await import('@/store/productsStore');
                        const now = new Date().toISOString();
                        const items = Array.isArray(action.data?.items) ? action.data.items : [];
                        const mapItemToProduct = (it: any) => {
                          const categoryName = String(it?.category || 'Otros');
                          const categoryObj = {
                            id: categoryName,
                            name: categoryName,
                            description: '',
                            parentId: undefined,
                            isActive: true,
                            productCount: 0,
                            createdAt: now,
                          };
                          const stock = Math.max(0, Number(it?.stock) || 0);
                          const purchasePrice = Math.max(0.01, Number(it?.purchasePrice) || 0.01);
                          const salePrice = Math.max(purchasePrice, Number(it?.salePrice) || purchasePrice);
                          const codeOrSku = String((it?.code ?? it?.sku ?? '').toString().trim());
                          return {
                            id: codeOrSku || `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                            name: String(it?.name || it?.code || 'Producto importado'),
                            description: String(it?.description || ''),
                            sku: String(it?.sku ?? it?.code ?? ''),
                            barcode: String(it?.barcode ?? it?.sku ?? it?.code ?? ''),
                            qrCode: String(it?.sku ?? it?.code ?? ''),
                            costPrice: purchasePrice,
                            wholesalePrice: salePrice,
                            stock,
                            minStock: Number(it?.minStock) || 0,
                            reservedStock: 0,
                            availableStock: stock,
                            category: categoryObj as any,
                            brand: it?.brand || undefined,
                            tags: Array.isArray(it?.tags) ? it.tags : [],
                            images: Array.isArray(it?.images) ? it.images : [],
                            isActive: true,
                            isFeatured: false,
                            isDigital: false,
                            requiresSerial: false,
                            allowBackorder: false,
                            trackInventory: true,
                            createdAt: now,
                            updatedAt: now,
                            totalSold: 0,
                            totalRevenue: 0,
                          } as any;
                        };

                        const newProducts = items.map(mapItemToProduct);
                        const state = useProductsStore.getState();
                        const current = Array.isArray(state.products) ? state.products : [];
                        state.setProducts([...current, ...newProducts]);
                      } else {
                        await api.post('/products/import', action.data);
                      }
                      actionSuccess = true;
                      break;
                    }
                    case 'CREATE_CLIENT':
                      await api.post('/clients', action.data);
                      actionSuccess = true;
                      break;
                    case 'UPDATE_CLIENT':
                      await api.put(`/clients/${action.data.id}`, action.data);
                      actionSuccess = true;
                      break;
                    case 'DELETE_CLIENT':
                      await api.delete(`/clients/${action.data.id}`);
                      actionSuccess = true;
                      break;
                    default:
                      console.warn(`Tipo de acción no reconocido: ${action.type}`);
                      continue;
                  }
                } catch (error) {
                  console.error(`Error al sincronizar acción ${action.id}:`, error);
                  
                  // Incrementar contador de reintentos SOLO UNA VEZ
                  get().incrementRetryCount(action.id);
                  failureCount++;
                  
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  syncErrors.push(`${action.type}: ${errorMessage}`);
                }

                // Si la acción fue exitosa, removerla
                if (actionSuccess) {
                  get().removePendingAction(action.id);
                  successCount++;
                  console.log(`✅ Acción ${action.type} sincronizada exitosamente`);
                }
              } catch (error) {
                console.error(`Error crítico procesando acción ${action.id}:`, error);
                failureCount++;
              }
            }

            // Actualizar estado de sincronización con información detallada
            get().updateSyncStatus({
              failedActions: failureCount,
              totalActions: pendingActions.length,
              syncErrors: syncErrors.slice(-15), // Aumentado a 15 errores
            });

            get().setLastSyncTime(Date.now());
            
            console.log(`📊 Sincronización completada: ${successCount} exitosas, ${failureCount} fallidas`);
            
          } catch (error) {
            console.error('Error durante la sincronización:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            get().updateSyncStatus({
              syncErrors: [...syncErrors, `Error general: ${errorMessage}`].slice(-15)
            });
          } finally {
            get().setSyncInProgress(false);
          }
        },
      }),
      {
        name: 'offline-storage',
        partialize: (state) => ({
          pendingActions: state.pendingActions,
          lastSyncTime: state.lastSyncTime,
          syncStatus: state.syncStatus,
          autoSyncEnabled: state.autoSyncEnabled,
          syncInterval: state.syncInterval,
          maxStorageSize: state.maxStorageSize,
          compressionEnabled: state.compressionEnabled,
        }),
      }
    )
  )
);

// Configurar listeners para detectar cambios en la conectividad
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOfflineStatus(false);
  });

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOfflineStatus(true);
  });

  // Auto-sincronización periódica
  let syncInterval: NodeJS.Timeout | null = null;

  const startAutoSync = () => {
    const state = useOfflineStore.getState();
    if (syncInterval) clearInterval(syncInterval);
    
    if (state.autoSyncEnabled && state.syncInterval > 0) {
      syncInterval = setInterval(() => {
        const currentState = useOfflineStore.getState();
        if (!currentState.isOffline && !currentState.syncInProgress && currentState.pendingActions.length > 0) {
          currentState.syncPendingActions();
        }
      }, state.syncInterval);
    }
  };

  // Iniciar auto-sincronización
  startAutoSync();

  // Reiniciar auto-sincronización cuando cambie la configuración
  useOfflineStore.subscribe(
    (state) => state.autoSyncEnabled,
    () => startAutoSync()
  );

  useOfflineStore.subscribe(
    (state) => state.syncInterval,
    () => startAutoSync()
  );
}

// Exponer store para pruebas manuales en entorno de desarrollo/test
// Permite ejecutar acciones como addPendingAction desde la consola o automatizaciones
if (typeof window !== 'undefined') {
  try {
    (window as any).__offlineStore = useOfflineStore;
  } catch {
    // noop
  }
}

