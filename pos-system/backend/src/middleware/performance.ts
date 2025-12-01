import { Request, Response, NextFunction } from 'express';
import { sequelize } from '../db/config';

// Cache para queries frecuentes
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Métricas de rendimiento
export const performanceMetrics = {
  totalRequests: 0,
  slowQueries: 0,
  cacheHits: 0,
  cacheMisses: 0,
  avgResponseTime: 0,
  responseTimes: [] as number[]
};

/**
 * Middleware para medir el tiempo de respuesta
 */
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    
    // Actualizar métricas
    performanceMetrics.totalRequests++;
    performanceMetrics.responseTimes.push(responseTime);
    
    // Mantener solo los últimos 100 tiempos
    if (performanceMetrics.responseTimes.length > 100) {
      performanceMetrics.responseTimes.shift();
    }
    
    // Calcular promedio
    performanceMetrics.avgResponseTime = 
      performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;
    
    // Registrar queries lentas (> 2 segundos)
    if (responseTime > 2000) {
      performanceMetrics.slowQueries++;
      console.warn(`⚠️  Slow query detected: ${req.method} ${req.url} - ${responseTime}ms`);
    }
    
    // Agregar header con tiempo de respuesta si los headers no han sido enviados
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${responseTime}ms`);
    }
  });
  
  next();
};

/**
 * Middleware para cachear respuestas GET
 */
export const cacheMiddleware = (cacheKey?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = cacheKey || `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    const cached = queryCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      performanceMetrics.cacheHits++;
      console.log(`💰 Cache hit: ${key}`);
      return res.json(cached.data);
    }
    
    performanceMetrics.cacheMisses++;
    
    // Interceptar la respuesta para cachearla
    const originalJson = res.json;
    res.json = function(data) {
      // Cachear solo respuestas exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        queryCache.set(key, { data, timestamp: Date.now() });
        console.log(`💾 Cached response: ${key}`);
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Limpiar cache manualmente
 */
export const clearCache = (pattern?: string) => {
  if (pattern) {
    // Limpiar entradas que coincidan con el patrón
    for (const key of queryCache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
  } else {
    // Limpiar todo el cache
    queryCache.clear();
  }
  console.log(`🧹 Cache cleared${pattern ? ` for pattern: ${pattern}` : ''}`);
};

/**
 * Optimización de queries de base de datos
 */
export const optimizeDatabaseQueries = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Agregar límites a queries de listado si no están presentes
    if (req.method === 'GET' && !req.query.limit) {
      req.query.limit = '100'; // Límite por defecto
    }
    
    // Optimizar queries con campos específicos
    if (req.method === 'GET' && req.query.fields) {
      const fields = Array.isArray(req.query.fields) ? req.query.fields[0] : req.query.fields;
      if (typeof fields === 'string') {
        req.query.attributes = fields.split(',');
        delete req.query.fields;
      }
    }
    
    next();
  };
};

/**
 * Middleware para compresión de respuestas
 */
export const compressionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Comprimir solo respuestas grandes (> 1KB)
    if (typeof data === 'string' && data.length > 1024 && req.headers['accept-encoding']?.includes('gzip')) {
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(data);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', compressed.length);
      return originalSend.call(this, compressed);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware para limitar concurrencia
 */
export const concurrencyLimiter = (maxConcurrent: number = 10) => {
  let activeRequests = 0;
  const queue: Array<() => void> = [];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (activeRequests < maxConcurrent) {
      activeRequests++;
      
      res.on('finish', () => {
        activeRequests--;
        // Procesar siguiente request en cola
        if (queue.length > 0) {
          const nextRequest = queue.shift()!;
          nextRequest();
        }
      });
      
      next();
    } else {
      // Encolar request
      queue.push(() => {
        activeRequests++;
        
        res.on('finish', () => {
          activeRequests--;
          if (queue.length > 0) {
            const nextRequest = queue.shift()!;
            nextRequest();
          }
        });
        
        next();
      });
      
      console.log(`⏳ Request queued. Active: ${activeRequests}, Queue: ${queue.length}`);
    }
  };
};

/**
 * Endpoint para métricas de rendimiento
 */
export const getPerformanceMetrics = (req: Request, res: Response) => {
  const cacheHitRate = performanceMetrics.totalRequests > 0 
    ? (performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) * 100).toFixed(2)
    : 0;
  
  res.json({
    success: true,
    metrics: {
      totalRequests: performanceMetrics.totalRequests,
      slowQueries: performanceMetrics.slowQueries,
      cacheHits: performanceMetrics.cacheHits,
      cacheMisses: performanceMetrics.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      avgResponseTime: `${performanceMetrics.avgResponseTime.toFixed(2)}ms`,
      recentResponseTimes: performanceMetrics.responseTimes.slice(-10),
      cacheSize: queryCache.size,
      uptime: process.uptime()
    }
  });
};

/**
 * Índices de base de datos recomendados
 */
export const recommendedIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
  'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
  'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
  'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock)',
  'CREATE INDEX IF NOT EXISTS idx_sales_createdAt ON sales(createdAt)',
  'CREATE INDEX IF NOT EXISTS idx_sales_clientId ON sales(clientId)',
  'CREATE INDEX IF NOT EXISTS idx_sales_total ON sales(total)',
  'CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)',
  'CREATE INDEX IF NOT EXISTS idx_clients_dni ON clients(dni)',
  'CREATE INDEX IF NOT EXISTS idx_audit_trail_createdAt ON audit_trail(createdAt)',
  'CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)',
  'CREATE INDEX IF NOT EXISTS idx_job_queue_availableAt ON job_queue(availableAt)'
];

/**
 * Crear índices de base de datos
 */
export const createDatabaseIndexes = async () => {
  try {
    console.log('🚀 Creating database indexes for performance optimization...');
    
    for (const indexSQL of recommendedIndexes) {
      try {
        await sequelize.query(indexSQL);
        console.log(`✅ Index created: ${indexSQL.split('IF NOT EXISTS ')[1].split(' ON')[0]}`);
      } catch (error: any) {
        console.warn(`⚠️  Failed to create index: ${indexSQL}`, error.message);
      }
    }
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating database indexes:', error);
  }
};
