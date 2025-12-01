import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { useToast } from './useToast';
import { api } from '@/lib/api';

export interface EntitySyncConfig<T> {
  entityName: string;
  endpoint: string;
  idField?: keyof T;
  timestampField?: keyof T;
  priority?: 'high' | 'medium' | 'low';
  maxRetries?: number;
  batchSize?: number;
  conflictResolution?: 'client' | 'server' | 'merge' | 'prompt';
}

export interface SyncOperation<T> {
  type: 'create' | 'update' | 'delete';
  entity: T;
  localId?: string;
  serverId?: string;
  timestamp: number;
  conflicted?: boolean;
}

export interface UseEntitySyncReturn<T> {
  // Estado
  isSyncing: boolean;
  pendingOperations: SyncOperation<T>[];
  conflicts: SyncOperation<T>[];
  lastSync: number | null;
  syncProgress: number;
  
  // Operaciones
  queueCreate: (entity: Omit<T, 'id'>) => Promise<string>;
  queueUpdate: (entity: T) => Promise<void>;
  queueDelete: (id: string) => Promise<void>;
  
  // Sincronización
  syncNow: () => Promise<void>;
  syncEntity: (operation: SyncOperation<T>) => Promise<void>;
  batchSync: (operations: SyncOperation<T>[]) => Promise<void>;
  
  // Resolución de conflictos
  resolveConflict: (operation: SyncOperation<T>, resolution: 'client' | 'server' | 'merge') => Promise<void>;
  resolveAllConflicts: (resolution: 'client' | 'server') => Promise<void>;
  
  // Utilidades
  clearPendingOperations: () => void;
  exportOperations: () => string;
  importOperations: (data: string) => Promise<boolean>;
}

export const useEntitySync = <T extends Record<string, any>>(
  config: EntitySyncConfig<T>
): UseEntitySyncReturn<T> => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<SyncOperation<T>[]>([]);
  const [conflicts, setConflicts] = useState<SyncOperation<T>[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  
  const { addPendingAction, isOffline } = useOfflineStore();
  const { showSuccess, showError, showWarning } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    entityName,
    endpoint,
    idField = 'id' as keyof T,
    timestampField = 'updatedAt' as keyof T,
    priority = 'medium',
    maxRetries = 3,
    batchSize = 10,
    conflictResolution = 'prompt'
  } = config;

  // Generar ID temporal para entidades nuevas
  const generateTempId = useCallback(() => {
    return `temp_${entityName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [entityName]);

  // Encolar operación de creación
  const queueCreate = useCallback(async (entity: Omit<T, 'id'>): Promise<string> => {
    const tempId = generateTempId();
    const operation: SyncOperation<T> = {
      type: 'create',
      entity: { ...entity, [idField]: tempId } as T,
      localId: tempId,
      timestamp: Date.now(),
    };

    setPendingOperations(prev => [...prev, operation]);

    // Si estamos offline, agregar a la cola offline
    if (isOffline) {
      addPendingAction({
        type: `CREATE_${entityName.toUpperCase()}` as any,
        data: operation,
        priority,
        maxRetries,
      });
    } else {
      // Intentar sincronizar inmediatamente
      try {
        await syncEntity(operation);
      } catch (error) {
        console.error(`Error creating ${entityName}:`, error);
      }
    }

    return tempId;
  }, [entityName, idField, isOffline, addPendingAction, priority, maxRetries, generateTempId]);

  // Encolar operación de actualización
  const queueUpdate = useCallback(async (entity: T): Promise<void> => {
    const operation: SyncOperation<T> = {
      type: 'update',
      entity,
      serverId: String(entity[idField]),
      timestamp: Date.now(),
    };

    setPendingOperations(prev => [...prev, operation]);

    if (isOffline) {
      addPendingAction({
        type: `UPDATE_${entityName.toUpperCase()}` as any,
        data: operation,
        priority,
        maxRetries,
      });
    } else {
      try {
        await syncEntity(operation);
      } catch (error) {
        console.error(`Error updating ${entityName}:`, error);
      }
    }
  }, [entityName, idField, isOffline, addPendingAction, priority, maxRetries]);

  // Encolar operación de eliminación
  const queueDelete = useCallback(async (id: string): Promise<void> => {
    const operation: SyncOperation<T> = {
      type: 'delete',
      entity: { [idField]: id } as T,
      serverId: id,
      timestamp: Date.now(),
    };

    setPendingOperations(prev => [...prev, operation]);

    if (isOffline) {
      addPendingAction({
        type: `DELETE_${entityName.toUpperCase()}` as any,
        data: operation,
        priority,
        maxRetries,
      });
    } else {
      try {
        await syncEntity(operation);
      } catch (error) {
        console.error(`Error deleting ${entityName}:`, error);
      }
    }
  }, [entityName, idField, isOffline, addPendingAction, priority, maxRetries]);

  // Sincronizar una entidad específica
  const syncEntity = useCallback(async (operation: SyncOperation<T>): Promise<void> => {
    try {
      const { type, entity, localId, serverId } = operation;

      switch (type) {
        case 'create': {
          const response = await api.post(endpoint, entity);
          const serverEntity = response.data;
          
          // Actualizar ID local con ID del servidor
          if (localId && serverEntity[idField]) {
            // Aquí podrías emitir un evento para actualizar el estado local
            console.log(`Entity created: ${localId} -> ${serverEntity[idField]}`);
          }
          break;
        }

        case 'update': {
          if (!serverId) throw new Error('Server ID required for update');
          
          // Verificar si hay conflictos
          try {
            const currentResponse = await api.get(`${endpoint}/${serverId}`, { __suppressGlobalError: true } as any);
            const serverEntity = currentResponse.data;
            
            if (timestampField && serverEntity[timestampField] && entity[timestampField]) {
              const serverTime = new Date(serverEntity[timestampField] as string).getTime();
              const localTime = new Date(entity[timestampField] as string).getTime();
              
              if (serverTime > localTime) {
                // Conflicto detectado
                const conflictedOperation = { ...operation, conflicted: true };
                setConflicts(prev => [...prev, conflictedOperation]);
                
                if (conflictResolution === 'prompt') {
                  showWarning(`Conflicto detectado en ${entityName}`);
                  return;
                }
              }
            }
          } catch (error) {
            // Si no se puede obtener la entidad del servidor, continuar con la actualización
          }

          await api.put(`${endpoint}/${serverId}`, entity);
          break;
        }

        case 'delete': {
          if (!serverId) throw new Error('Server ID required for delete');
          await api.delete(`${endpoint}/${serverId}`);
          break;
        }
      }

      // Remover de operaciones pendientes
      setPendingOperations(prev => 
        prev.filter(op => 
          !(op.type === operation.type && 
            (op.localId === operation.localId || op.serverId === operation.serverId))
        )
      );

    } catch (error) {
      console.error(`Error syncing ${entityName}:`, error);
      throw error;
    }
  }, [endpoint, entityName, idField, timestampField, conflictResolution, showWarning]);

  // Sincronización por lotes
  const batchSync = useCallback(async (operations: SyncOperation<T>[]): Promise<void> => {
    if (operations.length === 0) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const batches = [];
      for (let i = 0; i < operations.length; i += batchSize) {
        batches.push(operations.slice(i, i + batchSize));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Cancelar si se solicita
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        await Promise.allSettled(
          batch.map(operation => syncEntity(operation))
        );

        setSyncProgress(((i + 1) / batches.length) * 100);
      }

      setLastSync(Date.now());
      showSuccess(`${entityName} sincronizado correctamente`);

    } catch (error) {
      console.error(`Error in batch sync for ${entityName}:`, error);
      showError(`Error sincronizando ${entityName}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  }, [entityName, batchSize, syncEntity, showSuccess, showError]);

  // Sincronizar ahora
  const syncNow = useCallback(async (): Promise<void> => {
    if (isOffline) {
      showWarning('Sin conexión a internet');
      return;
    }

    if (pendingOperations.length === 0) {
      showSuccess('No hay operaciones pendientes');
      return;
    }

    abortControllerRef.current = new AbortController();
    await batchSync(pendingOperations);
  }, [isOffline, pendingOperations, batchSync, showWarning, showSuccess]);

  // Resolver conflicto
  const resolveConflict = useCallback(async (
    operation: SyncOperation<T>, 
    resolution: 'client' | 'server' | 'merge'
  ): Promise<void> => {
    try {
      if (resolution === 'client') {
        // Usar versión del cliente
        await syncEntity({ ...operation, conflicted: false });
      } else if (resolution === 'server') {
        // Obtener versión del servidor y actualizar local
        if (operation.serverId) {
          const response = await api.get(`${endpoint}/${operation.serverId}`, { __suppressGlobalError: true } as any);
          // Aquí emitirías un evento para actualizar el estado local
          console.log('Using server version:', response.data);
        }
      } else if (resolution === 'merge') {
        // Implementar lógica de merge específica
        showWarning('Merge automático no implementado');
        return;
      }

      // Remover de conflictos
      setConflicts(prev => 
        prev.filter(conflict => 
          !(conflict.type === operation.type && 
            (conflict.localId === operation.localId || conflict.serverId === operation.serverId))
        )
      );

      showSuccess('Conflicto resuelto');

    } catch (error) {
      console.error('Error resolving conflict:', error);
      showError('Error resolviendo conflicto');
    }
  }, [endpoint, syncEntity, showWarning, showSuccess, showError]);

  // Resolver todos los conflictos
  const resolveAllConflicts = useCallback(async (resolution: 'client' | 'server'): Promise<void> => {
    for (const conflict of conflicts) {
      await resolveConflict(conflict, resolution);
    }
  }, [conflicts, resolveConflict]);

  // Limpiar operaciones pendientes
  const clearPendingOperations = useCallback(() => {
    setPendingOperations([]);
    setConflicts([]);
    showSuccess('Operaciones pendientes eliminadas');
  }, [showSuccess]);

  // Exportar operaciones
  const exportOperations = useCallback(() => {
    const exportData = {
      entityName,
      pendingOperations,
      conflicts,
      lastSync,
      exportDate: Date.now(),
      version: '1.0',
    };
    return JSON.stringify(exportData, null, 2);
  }, [entityName, pendingOperations, conflicts, lastSync]);

  // Importar operaciones
  const importOperations = useCallback(async (data: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.entityName !== entityName) {
        showError('Los datos no corresponden a esta entidad');
        return false;
      }

      if (parsed.pendingOperations) {
        setPendingOperations(parsed.pendingOperations);
      }
      
      if (parsed.conflicts) {
        setConflicts(parsed.conflicts);
      }

      if (parsed.lastSync) {
        setLastSync(parsed.lastSync);
      }

      showSuccess('Operaciones importadas correctamente');
      return true;

    } catch (error) {
      console.error('Error importing operations:', error);
      showError('Error importando operaciones');
      return false;
    }
  }, [entityName, showSuccess, showError]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isSyncing,
    pendingOperations,
    conflicts,
    lastSync,
    syncProgress,
    queueCreate,
    queueUpdate,
    queueDelete,
    syncNow,
    syncEntity,
    batchSync,
    resolveConflict,
    resolveAllConflicts,
    clearPendingOperations,
    exportOperations,
    importOperations,
  };
};
