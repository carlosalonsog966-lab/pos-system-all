import winston from 'winston';
import path from 'path';

/**
 * Configuración mejorada de logging con rotación de archivos
 */
export function createEnhancedLogger() {
  const logDir = path.join(process.cwd(), 'logs');
  
  // Transporte para errores
  const errorTransport = new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 5,
  });

  // Transporte para logs generales
  const combinedTransport = new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 5,
  });

  // Transporte para logs de auditoría
  const auditTransport = new winston.transports.File({
    filename: path.join(logDir, 'audit.log'),
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
  });

  // Transporte para logs de rendimiento
  const performanceTransport = new winston.transports.File({
    filename: path.join(logDir, 'performance.log'),
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  });

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'pos-backend' },
    transports: [
      errorTransport,
      combinedTransport,
      auditTransport,
      performanceTransport,
    ],
  });

  // En desarrollo, también log a la consola con formato mejorado
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    }));
  }

  return logger;
}

/**
 * Función auxiliar para loguear eventos de auditoría
 */
export function logAudit(event: string, userId: string, details: any) {
  const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'audit.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    ]
  });

  auditLogger.info('AUDIT', {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Función auxiliar para loguear eventos de rendimiento
 */
export function logPerformance(operation: string, duration: number, details?: any) {
  const performanceLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'performance.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    ]
  });

  performanceLogger.info('PERFORMANCE', {
    operation,
    duration,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware de logging mejorado
 */
export function createEnhancedRequestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(data: any) {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        correlationId: req.correlationId,
        idempotencyKey: req.idempotencyKey,
        responseSize: data ? JSON.stringify(data).length : 0
      };

      // Log de rendimiento para requests lentas (> 1 segundo)
      if (duration > 1000) {
        logPerformance('SLOW_REQUEST', duration, logData);
      }

      // Log de auditoría para requests críticos
      if (req.url.includes('/api/auth') || req.url.includes('/api/users')) {
        logAudit('AUTH_REQUEST', req.user?.id || 'anonymous', logData);
      }

      // Log general
      const logger = winston.loggers.get('default') || winston.createLogger();
      if (res.statusCode >= 400) {
        logger.error('HTTP Request Error', logData);
      } else {
        logger.info('HTTP Request', logData);
      }

      return originalSend.call(this, data);
    };

    next();
  };
}