import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedCache, CacheMetrics } from '../lib/cache';

export interface UseCacheOptions<T> {
  cache?: AdvancedCache<T>;
  ttl?: number;
  tags?: string[];
  refreshInterval?: number;
  staleWhileRevalidate?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

export interface UseCacheReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  invalidate: () => void;
  set: (data: T, customTTL?: number) => void;
  remove: () => void;
}

export function useCache<T>(
  key: string,
  fetcher?: () => Promise<T>,
  options: UseCacheOptions<T> = {}
): UseCacheReturn<T> {
  const {
    cache,
    ttl,
    tags = [],
    refreshInterval,
    staleWhileRevalidate = false,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const cacheRef = useRef(cache);
  const fetcherRef = useRef(fetcher);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Actualizar refs
  useEffect(() => {
    cacheRef.current = cache;
    fetcherRef.current = fetcher;
  }, [cache, fetcher]);

  // Función para obtener datos del caché
  const getCachedData = useCallback((): T | null => {
    if (!cacheRef.current) return null;
    return cacheRef.current.get(key);
  }, [key]);

  // Función para establecer datos en el caché
  const setCachedData = useCallback((newData: T, customTTL?: number) => {
    if (!cacheRef.current) return;
    cacheRef.current.set(key, newData, customTTL || ttl, tags);
    setLastUpdated(Date.now());
  }, [key, ttl, tags]);

  // Función para refrescar datos
  const refresh = useCallback(async () => {
    if (!fetcherRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const newData = await fetcherRef.current();
      
      setData(newData);
      setCachedData(newData);
      setIsStale(false);
      
      onSuccess?.(newData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [setCachedData, onSuccess, onError]);

  // Función para invalidar caché
  const invalidate = useCallback(() => {
    if (cacheRef.current) {
      cacheRef.current.delete(key);
    }
    setData(null);
    setIsStale(true);
    setLastUpdated(null);
  }, [key]);

  // Función para establecer datos manualmente
  const set = useCallback((newData: T, customTTL?: number) => {
    setData(newData);
    setCachedData(newData, customTTL);
    setIsStale(false);
    setError(null);
  }, [setCachedData]);

  // Función para remover datos
  const remove = useCallback(() => {
    invalidate();
  }, [invalidate]);

  // Cargar datos iniciales
  useEffect(() => {
    const cachedData = getCachedData();
    
    if (cachedData !== null) {
      setData(cachedData);
      setLastUpdated(Date.now());
      setIsStale(false);
      
      // Si tenemos staleWhileRevalidate, refrescar en background
      if (staleWhileRevalidate && fetcherRef.current) {
        refresh();
      }
    } else if (fetcherRef.current) {
      // No hay datos en caché, cargar desde fetcher
      refresh();
    }
  }, [key, getCachedData, refresh, staleWhileRevalidate]);

  // Configurar intervalo de refresco
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (fetcherRef.current) {
          refresh();
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, refresh]);

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    isStale,
    lastUpdated,
    refresh,
    invalidate,
    set,
    remove,
  };
}

// Hook para gestionar múltiples claves de caché
export function useMultiCache<T>(
  keys: string[],
  fetcher?: (key: string) => Promise<T>,
  options: UseCacheOptions<T> = {}
) {
  const [results, setResults] = useState<Map<string, UseCacheReturn<T>>>(new Map());

  useEffect(() => {
    const newResults = new Map<string, UseCacheReturn<T>>();

    keys.forEach(_ => {
      // const keyFetcher = fetcher ? () => fetcher(key) : undefined;
      // Nota: En una implementación real, necesitarías manejar esto de manera diferente
      // ya que no puedes llamar hooks condicionalmente
    });

    setResults(newResults);
  }, [keys, fetcher, options]);

  return results;
}

// Hook para métricas de caché
export function useCacheMetrics(cache: AdvancedCache) {
  const [metrics, setMetrics] = useState<CacheMetrics>(cache.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(cache.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, [cache]);

  const resetMetrics = useCallback(() => {
    cache.resetMetrics();
    setMetrics(cache.getMetrics());
  }, [cache]);

  const hitRate = metrics.hits + metrics.misses > 0 
    ? (metrics.hits / (metrics.hits + metrics.misses)) * 100 
    : 0;

  return {
    metrics,
    hitRate,
    resetMetrics,
  };
}

// Hook para gestión automática de caché por tags
export function useCacheInvalidation(cache: AdvancedCache) {
  const invalidateByTags = useCallback((tags: string[]) => {
    return cache.invalidateByTags(tags);
  }, [cache]);

  const invalidateAll = useCallback(() => {
    cache.clear();
  }, [cache]);

  const cleanup = useCallback(() => {
    return cache.cleanup();
  }, [cache]);

  return {
    invalidateByTags,
    invalidateAll,
    cleanup,
  };
}

// Hook para persistencia de caché
export function useCachePersistence(cache: AdvancedCache, storageKey: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cargar caché desde localStorage al inicializar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        cache.import(stored);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cache'));
    } finally {
      setIsLoading(false);
    }
  }, [cache, storageKey]);

  // Guardar caché en localStorage periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const exported = cache.export();
        localStorage.setItem(storageKey, exported);
      } catch (err) {
        console.warn('Failed to persist cache:', err);
      }
    }, 30000); // Guardar cada 30 segundos

    return () => clearInterval(interval);
  }, [cache, storageKey]);

  // Guardar al desmontar
  useEffect(() => {
    return () => {
      try {
        const exported = cache.export();
        localStorage.setItem(storageKey, exported);
      } catch (err) {
        console.warn('Failed to persist cache on unmount:', err);
      }
    };
  }, [cache, storageKey]);

  const save = useCallback(() => {
    try {
      const exported = cache.export();
      localStorage.setItem(storageKey, exported);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save cache'));
      return false;
    }
  }, [cache, storageKey]);

  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return cache.import(stored);
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cache'));
      return false;
    }
  }, [cache, storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      cache.clear();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear cache'));
      return false;
    }
  }, [cache, storageKey]);

  return {
    isLoading,
    error,
    save,
    load,
    clear,
  };
}