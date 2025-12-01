import { useState, useEffect, useCallback } from 'react';

interface PersistenceOptions {
  key: string;
  defaultValue?: any;
  storage?: Storage;
  serializer?: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
  syncAcrossTabs?: boolean;
}

interface UsePersistenceReturn<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  removeValue: () => void;
  isLoading: boolean;
  error: string | null;
}

const defaultSerializer = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
};

export const usePersistence = <T = any>({
  key,
  defaultValue,
  storage = localStorage,
  serializer = defaultSerializer,
  syncAcrossTabs = true,
}: PersistenceOptions): UsePersistenceReturn<T> => {
  const [value, setInternalValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar valor inicial del storage
  useEffect(() => {
    try {
      const storedValue = storage.getItem(key);
      if (storedValue !== null) {
        const deserializedValue = serializer.deserialize(storedValue);
        setInternalValue(deserializedValue);
      }
      setError(null);
    } catch (err) {
      setError(`Error loading data from storage: ${err}`);
      console.error(`Error loading ${key} from storage:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [key, storage, serializer]);

  // Función para actualizar el valor
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    try {
      const valueToStore = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(value)
        : newValue;

      setInternalValue(valueToStore);
      
      if (valueToStore === undefined || valueToStore === null) {
        storage.removeItem(key);
      } else {
        const serializedValue = serializer.serialize(valueToStore);
        storage.setItem(key, serializedValue);
      }
      
      setError(null);
    } catch (err) {
      setError(`Error saving data to storage: ${err}`);
      console.error(`Error saving ${key} to storage:`, err);
    }
  }, [key, value, storage, serializer]);

  // Función para remover el valor
  const removeValue = useCallback(() => {
    try {
      storage.removeItem(key);
      setInternalValue(defaultValue);
      setError(null);
    } catch (err) {
      setError(`Error removing data from storage: ${err}`);
      console.error(`Error removing ${key} from storage:`, err);
    }
  }, [key, defaultValue, storage]);

  // Sincronización entre pestañas
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === storage) {
        try {
          if (e.newValue === null) {
            setInternalValue(defaultValue);
          } else {
            const deserializedValue = serializer.deserialize(e.newValue);
            setInternalValue(deserializedValue);
          }
          setError(null);
        } catch (err) {
          setError(`Error syncing data across tabs: ${err}`);
          console.error(`Error syncing ${key} across tabs:`, err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, storage, serializer, syncAcrossTabs]);

  return {
    value,
    setValue,
    removeValue,
    isLoading,
    error,
  };
};

// Hook especializado para datos complejos con compresión
export const useCompressedPersistence = <T = any>(options: PersistenceOptions) => {
  const compressedSerializer = {
    serialize: (value: any) => {
      const jsonString = JSON.stringify(value);
      // Simulación de compresión simple (en producción usar una librería como lz-string)
      return btoa(jsonString);
    },
    deserialize: (value: string) => {
      const jsonString = atob(value);
      return JSON.parse(jsonString);
    },
  };

  return usePersistence<T>({
    ...options,
    serializer: compressedSerializer,
  });
};

// Hook para datos temporales con expiración
export const useTemporaryPersistence = <T = any>(
  options: PersistenceOptions & { expirationTime?: number }
) => {
  const { expirationTime = 24 * 60 * 60 * 1000, ...persistenceOptions } = options; // 24 horas por defecto

  const timestampedSerializer = {
    serialize: (value: any) => {
      const timestampedValue = {
        data: value,
        timestamp: Date.now(),
        expirationTime,
      };
      return JSON.stringify(timestampedValue);
    },
    deserialize: (value: string) => {
      const timestampedValue = JSON.parse(value);
      const now = Date.now();
      
      if (now - timestampedValue.timestamp > timestampedValue.expirationTime) {
        throw new Error('Data has expired');
      }
      
      return timestampedValue.data;
    },
  };

  return usePersistence<T>({
    ...persistenceOptions,
    serializer: timestampedSerializer,
  });
};