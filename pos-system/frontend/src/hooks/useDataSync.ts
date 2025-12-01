import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotificationStore } from '@/store/notificationStore';

interface SyncOptions {
  key: string;
  fetchFn: () => Promise<any>;
  updateFn?: (data: any) => Promise<any>;
  deleteFn?: (id: string) => Promise<void>;
  interval?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

interface UseDataSyncReturn<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastSync: Date | null;
  isSyncing: boolean;
  sync: () => Promise<void>;
  update: (data: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  forceRefresh: () => Promise<void>;
}

export const useDataSync = <T = any>({
  key,
  fetchFn,
  updateFn,
  deleteFn,
  interval = 30000, // 30 segundos por defecto
  retryAttempts = 3,
  retryDelay = 1000,
  onError,
  onSuccess,
}: SyncOptions): UseDataSyncReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { showError, showSuccess } = useNotificationStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para realizar la sincronización con reintentos
  const performSync = useCallback(async (attempt = 1): Promise<void> => {
    try {
      setIsSyncing(true);
      setIsError(false);
      setError(null);

      const result = await fetchFn();
      setData(result);
      setLastSync(new Date());
      setIsLoading(false);

      if (onSuccess) {
        onSuccess(result);
      }

      // Limpiar cualquier timeout de reintento pendiente
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < retryAttempts) {
        // Reintento con backoff exponencial
        const delay = retryDelay * Math.pow(2, attempt - 1);
        retryTimeoutRef.current = setTimeout(() => {
          performSync(attempt + 1);
        }, delay);
      } else {
        // Falló después de todos los reintentos
        setIsError(true);
        setError(error);
        setIsLoading(false);

        if (onError) {
          onError(error);
        } else {
          showError(
            'Error de sincronización',
            `No se pudo sincronizar ${key}: ${error.message}`,
            { persistent: true }
          );
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [fetchFn, retryAttempts, retryDelay, onError, onSuccess, key, showError]);

  // Función de sincronización manual
  const sync = useCallback(async () => {
    await performSync();
  }, [performSync]);

  // Función para actualizar datos
  const update = useCallback(async (newData: T) => {
    if (!updateFn) {
      throw new Error('Update function not provided');
    }

    try {
      setIsSyncing(true);
      const result = await updateFn(newData);
      setData(result);
      setLastSync(new Date());
      
      showSuccess(
        'Datos actualizados',
        `${key} actualizado correctamente`
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      showError(
        'Error al actualizar',
        `No se pudo actualizar ${key}: ${error.message}`
      );
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [updateFn, key, showError, showSuccess]);

  // Función para eliminar datos
  const remove = useCallback(async (id: string) => {
    if (!deleteFn) {
      throw new Error('Delete function not provided');
    }

    try {
      setIsSyncing(true);
      await deleteFn(id);
      
      // Actualizar datos locales removiendo el elemento
      if (Array.isArray(data)) {
        setData(data.filter((item: any) => item.id !== id) as T);
      } else {
        setData(null);
      }
      
      setLastSync(new Date());
      
      showSuccess(
        'Elemento eliminado',
        `Elemento de ${key} eliminado correctamente`
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      showError(
        'Error al eliminar',
        `No se pudo eliminar el elemento de ${key}: ${error.message}`
      );
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [deleteFn, data, key, showError, showSuccess]);

  // Función para forzar actualización
  const forceRefresh = useCallback(async () => {
    setIsLoading(true);
    await performSync();
  }, [performSync]);

  // Configurar sincronización automática
  useEffect(() => {
    // Sincronización inicial
    performSync();

    // Configurar intervalo de sincronización
    if (interval > 0) {
      intervalRef.current = setInterval(() => {
        if (!isSyncing) {
          performSync();
        }
      }, interval);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [performSync, interval, isSyncing]);

  // Pausar sincronización cuando la pestaña no está visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pausar sincronización
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Reanudar sincronización
        if (interval > 0 && !intervalRef.current) {
          // Sincronizar inmediatamente al volver a la pestaña
          performSync();
          
          intervalRef.current = setInterval(() => {
            if (!isSyncing) {
              performSync();
            }
          }, interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [interval, performSync, isSyncing]);

  return {
    data,
    isLoading,
    isError,
    error,
    lastSync,
    isSyncing,
    sync,
    update,
    remove,
    forceRefresh,
  };
};