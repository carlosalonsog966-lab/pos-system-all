import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import { EventLogService } from '../services/eventLogService';

// Configurar Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pos-backend' },
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
    }),
  ],
});

// En desarrollo, también log a la consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      
      correlationId: (req as any).correlationId,
      idempotencyKey: (req as any).idempotencyKey,
};

    if (res.statusCode >= 400) {
      logger.error('HTTP Request Error', logData);
    } else {
      logger.info('HTTP Request', logData);
    }

    // Registrar evento de request para métricas de latencia
    EventLogService.record({
      type: 'SYSTEM',
      severity: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info',
      message: 'HTTP Request',
      context: 'http',
      correlationId: (req as any).correlationId,
      details: {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        durationMs: duration,
        userAgent: req.get('User-Agent'),
        idempotencyKey: (req as any).idempotencyKey,
      },
    }).catch(() => {});
  });

  next();
};

export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Registrar evento de error para trazabilidad
  EventLogService.record({
    type: 'ERROR',
    severity: 'error',
    message: error.message || 'Unhandled Error',
    context: req.url,
    correlationId: (req as any).correlationId,
    details: {
      method: req.method,
      params: req.params,
      query: req.query,
      body: req.body,
      correlationId: (req as any).correlationId,
      idempotencyKey: (req as any).idempotencyKey,
    },
  }).catch(() => {});

  next(error);
};

export { logger };

