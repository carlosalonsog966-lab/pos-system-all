export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  compressed?: boolean;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  compressionThreshold: number;
  enableCompression: boolean;
  enableMetrics: boolean;
  cleanupInterval: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressionSaves: number;
  totalSize: number;
  entryCount: number;
}

export class AdvancedCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTTL: 5 * 60 * 1000, // 5 minutos
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableMetrics: true,
      cleanupInterval: 60 * 1000, // 1 minuto
      ...config,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressionSaves: 0,
      totalSize: 0,
      entryCount: 0,
    };

    this.startCleanupTimer();
  }

  // Obtener valor del caché
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.updateMetrics('miss');
      return null;
    }

    // Verificar si ha expirado
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateMetrics('miss');
      return null;
    }

    // Actualizar estadísticas de acceso
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateMetrics('hit');

    return this.decompressData(entry.data, entry.compressed);
  }

  // Establecer valor en el caché
  set(key: string, data: T, ttl?: number, tags: string[] = []): void {
    // Verificar si necesitamos hacer espacio
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    
    // Comprimir datos si es necesario
    const { compressedData, isCompressed } = this.compressData(data);

    const entry: CacheEntry<T> = {
      data: compressedData,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: now,
      tags,
      compressed: isCompressed,
    };

    this.cache.set(key, entry);
    this.updateMetrics('set');

    if (isCompressed) {
      this.metrics.compressionSaves++;
    }
  }

  // Eliminar entrada del caché
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics('delete');
    }
    return deleted;
  }

  // Limpiar caché por tags
  invalidateByTags(tags: string[]): number {
    let deletedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.metrics.deletes += deletedCount;
    return deletedCount;
  }

  // Limpiar todo el caché
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.deletes += size;
    this.resetMetrics();
  }

  // Obtener múltiples valores
  getMultiple(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();
    
    for (const key of keys) {
      results.set(key, this.get(key));
    }

    return results;
  }

  // Establecer múltiples valores
  setMultiple(entries: Array<{ key: string; data: T; ttl?: number; tags?: string[] }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.data, entry.ttl, entry.tags);
    }
  }

  // Verificar si una clave existe y no ha expirado
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  // Obtener todas las claves
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Obtener tamaño del caché
  size(): number {
    return this.cache.size;
  }

  // Obtener métricas
  getMetrics(): CacheMetrics {
    this.updateSizeMetrics();
    return { ...this.metrics };
  }

  // Resetear métricas
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressionSaves: 0,
      totalSize: 0,
      entryCount: 0,
    };
  }

  // Limpiar entradas expiradas
  cleanup(): number {
    let cleanedCount = 0;
    // const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.metrics.deletes += cleanedCount;
    return cleanedCount;
  }

  // Exportar caché
  export(): string {
    const exportData = {
      entries: Array.from(this.cache.entries()),
      config: this.config,
      metrics: this.getMetrics(),
      exportDate: Date.now(),
    };

    return JSON.stringify(exportData);
  }

  // Importar caché
  import(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.entries && Array.isArray(parsed.entries)) {
        this.cache.clear();
        
        for (const [key, entry] of parsed.entries) {
          // Solo importar entradas que no hayan expirado
          if (!this.isExpired(entry)) {
            this.cache.set(key, entry);
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importing cache:', error);
      return false;
    }
  }

  // Destruir caché y limpiar recursos
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }

  // Métodos privados

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  private compressData(data: T): { compressedData: T; isCompressed: boolean } {
    if (!this.config.enableCompression) {
      return { compressedData: data, isCompressed: false };
    }

    try {
      const dataString = JSON.stringify(data);
      
      if (dataString.length > this.config.compressionThreshold) {
        // Simulación de compresión (en una implementación real usarías una librería como pako)
        const compressed = this.simpleCompress(dataString);
        return { compressedData: compressed as T, isCompressed: true };
      }
    } catch (error) {
      console.warn('Compression failed:', error);
    }

    return { compressedData: data, isCompressed: false };
  }

  private decompressData(data: T, isCompressed?: boolean): T {
    if (!isCompressed || !this.config.enableCompression) {
      return data;
    }

    try {
      // Simulación de descompresión
      const decompressed = this.simpleDecompress(data as string);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Decompression failed:', error);
      return data;
    }
  }

  private simpleCompress(data: string): string {
    // Simulación simple de compresión (en producción usar una librería real)
    return btoa(data);
  }

  private simpleDecompress(data: string): string {
    // Simulación simple de descompresión
    return atob(data);
  }

  private updateMetrics(operation: 'hit' | 'miss' | 'set' | 'delete'): void {
    if (!this.config.enableMetrics) return;

    switch (operation) {
      case 'hit':
        this.metrics.hits++;
        break;
      case 'miss':
        this.metrics.misses++;
        break;
      case 'set':
        this.metrics.sets++;
        break;
      case 'delete':
        this.metrics.deletes++;
        break;
    }
  }

  private updateSizeMetrics(): void {
    this.metrics.entryCount = this.cache.size;
    
    // Calcular tamaño aproximado
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      try {
        totalSize += JSON.stringify(entry).length;
      } catch {
        totalSize += 100; // Estimación fallback
      }
    }
    
    this.metrics.totalSize = totalSize;
  }

  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }
}

// Instancia global del caché
export const globalCache = new AdvancedCache({
  maxSize: 200,
  defaultTTL: 10 * 60 * 1000, // 10 minutos
  enableCompression: true,
  compressionThreshold: 2048, // 2KB
});

// Caché específico para datos de API
export const apiCache = new AdvancedCache({
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000, // 5 minutos
  enableCompression: true,
});

// Caché para imágenes y recursos estáticos
export const assetCache = new AdvancedCache({
  maxSize: 50,
  defaultTTL: 30 * 60 * 1000, // 30 minutos
  enableCompression: false, // Las imágenes ya están comprimidas
});

// Caché para configuración de usuario
export const userConfigCache = new AdvancedCache({
  maxSize: 20,
  defaultTTL: 60 * 60 * 1000, // 1 hora
  enableCompression: false,
});