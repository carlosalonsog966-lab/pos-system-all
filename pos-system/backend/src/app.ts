/// <reference path="./types/ambient.d.ts" />
import express from 'express';
// Using require to avoid TS7016 when @types are unavailable
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors');
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compression = require('compression');
import rateLimit from 'express-rate-limit';

import { attachCorrelationId, attachIdempotencyKey } from './middleware/correlation';
import routes from './routes';
import { requestMetricsMiddleware } from './middleware/requestMetrics';
import { register } from 'prom-client';
import { sequelize } from './db/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TransactionService } from './services/transactionService';
import { EventLogService } from './services/eventLogService';
import { JobQueueService } from './services/jobQueueService';
import { FileManagerService } from './services/FileManagerService';
import { OfflineStorageService } from './services/OfflineStorageService';
import { OfflineController } from './controllers/offlineController';
import { requestLogger, errorLogger, logger } from './middleware/logger';
import { 
  responseTimeMiddleware, 
  cacheMiddleware, 
  optimizeDatabaseQueries, 
  compressionMiddleware,
  concurrencyLimiter,
  getPerformanceMetrics,
  createDatabaseIndexes
} from './middleware/performance';
import MonitoringService from './services/monitoringService';
import { Sale } from './models/Sale';
import { SaleItem } from './models/SaleItem';
import StockLedger from './models/StockLedger';
import { QueryTypes } from 'sequelize';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateConfig } = require('./utils/configValidator');

const app = express();
// Seguridad global: deshabilitar X-Powered-By y aplicar helmet
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: (process.env.CSP_ENABLED === 'true' || process.env.CSP_ENABLED === '1') ? {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", process.env.FRONTEND_URL || '', process.env.PUBLIC_ORIGIN || ''].filter(Boolean),
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'self'"],
    },
  } : false,
}));

// Integración opcional de Sentry (si SENTRY_DSN está configurado)
try {
  const { setupSentry } = require('./observability/sentry');
  setupSentry(app);
} catch (e) {
  // Sentry no configurado o no disponible; continuar sin Sentry
}

// Crear directorio de logs si no existe
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Endpoint de métricas de rendimiento (SIN AUTENTICACIÓN)
app.get('/api/performance/metrics', getPerformanceMetrics);

// Endpoints de monitoreo del sistema (SIN AUTENTICACIÓN)
app.get('/api/monitoring/status', async (req, res) => {
  try {
    const monitoringService = MonitoringService.getInstance();
    const currentMetrics = monitoringService.getCurrentMetrics();
    const performanceStats = monitoringService.getPerformanceStats();
    
    res.json({
      success: true,
      monitoring: {
        active: true,
        currentMetrics,
        performanceStats,
        historySize: monitoringService.getMetricsHistory().length
      }
    });
  } catch (error) {
    logger.error('Error getting monitoring status', { error });
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado del monitoreo'
    });
  }
});

app.get('/api/monitoring/history', async (req, res) => {
  try {
    const monitoringService = MonitoringService.getInstance();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 24;
    const history = monitoringService.getMetricsHistory(limit);
    
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    logger.error('Error getting monitoring history', { error });
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial del monitoreo'
    });
  }
});

app.post('/api/monitoring/clear', async (req, res) => {
  try {
    const monitoringService = MonitoringService.getInstance();
    monitoringService.clearMetrics();
    
    res.json({
      success: true,
      message: 'Métricas de monitoreo limpiadas exitosamente'
    });
  } catch (error) {
    logger.error('Error clearing monitoring metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Error al limpiar métricas del monitoreo'
    });
  }
});

// Iniciar monitoreo automático al arrancar el servidor
const monitoringService = MonitoringService.getInstance();
monitoringService.startMonitoring(60000); // Monitorear cada 60 segundos}

// Deshabilitar ETag para evitar caching y validar headers explícitos
app.set('etag', false);
// Forzar parser de query simple para evitar proxies inmutables de req.query
app.set('query parser', 'simple');

// Middleware de seguridad

// Trazabilidad: correlationId e idempotencia antes de cualquier otro middleware
app.use(attachCorrelationId);
app.use(attachIdempotencyKey);

// ConfiguraciÃ³n de CORS
const port = Number(process.env.PORT || 3000);
const appHost = process.env.APP_HOST || 'localhost';
const publicOrigin = process.env.PUBLIC_ORIGIN || '';
const frontendUrl = process.env.FRONTEND_URL || '';

const computedOrigins = (process.env.CORS_STRICT === 'true' || process.env.CORS_STRICT === '1')
  ? [frontendUrl, publicOrigin].filter(Boolean)
  : [
      frontendUrl,
      publicOrigin,
      `http://${appHost}:${port}`,
      `https://${appHost}:${port}`,
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'https://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'https://localhost:5175',
      'http://127.0.0.1:5175',
      'http://localhost:5177',
      'https://localhost:5177',
      'http://127.0.0.1:5177',
      'http://localhost:5176',
      'https://localhost:5176',
      'http://127.0.0.1:5176',
      'http://localhost:5180',
      'https://localhost:5180',
      'http://127.0.0.1:5180',
      'tauri://localhost'
    ].filter(Boolean);

app.use(cors({
  origin: computedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Idempotency-Key', 'X-Cache-Permit', 'X-Cache-Ttl-Ms', 'X-Force-Network'],
}));

// CompresiÃ³n
app.use(compression());

// Asegurar la eliminación del header X-Powered-By en todas las respuestas
app.use((req, res, next) => {
  try {
    res.removeHeader('X-Powered-By');
  } catch (_) {}
  next();
});

// Rate limiting global para todas las rutas bajo /api
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: true,
  // No aplicar rate-limit al endpoint público de Prometheus
  skip: (req) => {
    const p = req.path || ''
    const m = (req.method || 'GET').toUpperCase()
    if (p === '/metrics/prom') return true
    if (m === 'GET') {
      if (p === '/health' || p === '/test-health') return true
      if (p.startsWith('/settings/public') || p.startsWith('/settings/system-info')) return true
    }
    return false
  },
}));

// Rate limiting (desactivado en desarrollo para evitar 429 durante pruebas)
const isDev = (process.env.NODE_ENV || 'development') === 'development';
if (!isDev) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // umbral elevado en producciÃ³n
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Demasiadas solicitudes desde esta IP, intente de nuevo mÃ¡s tarde.',
    },
    handler: async (req, res) => {
      await EventLogService.record({
        type: 'RATE_LIMIT',
        severity: 'warning',
        message: 'Rate limit activado en /api',
        context: req.path,
        details: { ip: req.ip, method: req.method },
      });
      res.status(429).json({ error: 'Demasiadas solicitudes desde esta IP, intente de nuevo mÃ¡s tarde.' });
    },
    skip: (req) => {
      // Excluir endpoints pÃºblicos y de salud de rate limit
      const path = req.path || '';
      const method = req.method || 'GET';
      if (method === 'GET') {
        if (path === '/health' || path === '/test-health') return true;
        if (path.startsWith('/settings/public') || path.startsWith('/settings/system-info')) return true;
      }
      return false;
    },
  });
  app.use('/api', limiter);
}

// Log despuÃ©s del rate limiting
app.use('/api', (req, res, next) => {
  console.log('=== AFTER RATE LIMITING ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  next();
});

// Parsing de JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance middleware
app.use(responseTimeMiddleware); // Medir tiempo de respuesta
app.use(compressionMiddleware); // Compresión personalizada
// Desactivar optimización automática de queries para evitar conflictos con req.query
// (Se aplica en endpoints específicos cuando es necesario)
// app.use(optimizeDatabaseQueries());
app.use(concurrencyLimiter(50)); // Limitar concurrencia a 50 requests simultáneos

// Cache middleware para endpoints de lectura frecuente
app.use('/api/products', cacheMiddleware());
app.use('/api/sales', cacheMiddleware());
app.use('/api/clients', cacheMiddleware());

// Alias público para estado offline sin prefijo /api
app.get('/offline/status', OfflineController.checkSystemStatus);

// Log despuÃ©s del parsing de JSON
app.use('/api', (req, res, next) => {
  console.log('=== AFTER JSON PARSING ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body type:', typeof req.body);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Log antes del requestLogger
app.use((req, res, next) => {
  console.log('=== BEFORE REQUEST LOGGER ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body type:', typeof req.body);
  console.log('Body:', req.body);
  next();
});

// Logging de requests
app.use(requestLogger);

// Interceptor para /api/health: reforzar encabezados de no-cache
app.use('/api/health', (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Cache-Policy', 'no-store');
  } catch {}
  next();
});

// Endpoint de salud simple
app.get('/api/test-health', (req, res) => {
  res.json({ success: true, message: 'Servidor funcionando correctamente' });
});

// Health endpoint unificado (prioritario) con no-cache y métricas
app.get('/api/health', async (req, res) => {
  try {
    res.set('X-Health-Source', 'router');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Cache-Policy', 'no-store');

    const storagePath = (sequelize as any)?.options?.storage as string | undefined;
    const configStatus = validateConfig(storagePath);
    const db = await TransactionService.healthCheck();
    const jobQueue = await JobQueueService.health();
    const fsHealth = await FileManagerService.checkSystemHealth();
    const offlineHealth = await OfflineStorageService.checkSystemHealth();

    // Inventario
    const startInv = Date.now();
    let inventoryHealth: any = { ok: false };
    try {
      const tables: string[] = await (sequelize as any).getQueryInterface().showAllTables();
      const hasLedger = tables.includes('stock_ledger');
      const hasIdempotency = tables.includes('idempotency_records');
      const ledgerCount = hasLedger ? await StockLedger.count() : 0;
      let idempotencyCount = 0;
      if (hasIdempotency) {
        const rows = await sequelize.query('SELECT COUNT(*) as c FROM idempotency_records', { type: QueryTypes.SELECT });
        const first: any = Array.isArray(rows) ? rows[0] : { c: 0 };
        idempotencyCount = Number(first?.c || 0);
      }
      inventoryHealth = {
        ok: true,
        latencyMs: Date.now() - startInv,
        tables: { stock_ledger: hasLedger, idempotency_records: hasIdempotency },
        counts: { stock_ledger: ledgerCount, idempotency_records: idempotencyCount },
      };
    } catch (e) {
      inventoryHealth = { ok: false, error: (e as any)?.message || String(e) };
    }

    // Ventas
    const startSales = Date.now();
    let salesHealth: any = { status: 'error' };
    try {
      await sequelize.query('SELECT 1');
      const dbLatencyMs = Date.now() - startSales;
      const salesCount = await Sale.count();
      const saleItemsCount = await SaleItem.count();
      salesHealth = { status: 'ok', dbLatencyMs, salesCount, saleItemsCount };
    } catch (e) {
      salesHealth = { status: 'error', error: (e as any)?.message || String(e) };
    }

    // Métricas últimas 24h
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let rows: any[] = [];
    try {
      const [r]: any = await sequelize.query(
        `SELECT severity, COUNT(*) as count
         FROM event_logs
         WHERE createdAt >= :from
         GROUP BY severity
         ORDER BY count DESC`,
        { replacements: { from } }
      );
      rows = r || [];
    } catch {}
    const requiredSeverities = ['info', 'warning', 'error', 'exception'];
    const countsBySeverity = requiredSeverities.map((sev) => {
      const row = rows.find((r: any) => r?.severity === sev);
      return { severity: sev, count: row?.count ?? 0 };
    });
    const totals = {
      info: countsBySeverity.find((r: any) => r.severity === 'info')?.count ?? 0,
      warning: countsBySeverity.find((r: any) => r.severity === 'warning')?.count ?? 0,
      error: countsBySeverity.find((r: any) => r.severity === 'error')?.count ?? 0,
      exception: countsBySeverity.find((r: any) => r.severity === 'exception')?.count ?? 0,
    };

    const degradationCauses: string[] = [];
    if (!db.healthy) degradationCauses.push('db');
    if (!configStatus.ok || configStatus.errors.length > 0) degradationCauses.push('config');
    if (!fsHealth) degradationCauses.push('filesystem');
    if (!offlineHealth) degradationCauses.push('offlineStorage');
    if ((jobQueue as any)?.error) degradationCauses.push('jobQueue');
    if (!inventoryHealth?.ok) degradationCauses.push('inventory');
    if ((salesHealth as any)?.status !== 'ok') degradationCauses.push('sales');

    res.status(200).json({
      success: true,
      message: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      debugMarker: true,
      uptimeSec: Math.round(process.uptime()),
      db,
      config: {
        ok: configStatus.ok,
        errors: configStatus.errors.length,
        warnings: configStatus.warnings.length,
      },
      modules: {
        jobQueue,
        filesystem: { ok: !!fsHealth },
        offlineStorage: { ok: !!offlineHealth },
        inventory: inventoryHealth,
        sales: salesHealth,
      },
      degradation: {
        ok: degradationCauses.length === 0,
        causes: degradationCauses,
      },
      metrics: {
        countsBySeverity,
        totals,
        windowHours: 24,
      },
      buildVersion: process.env.BUILD_VERSION || process.env.npm_package_version || 'dev',
      errorBudget: {
        windowHours: 24,
        errorCount: totals.error + totals.exception,
        warningCount: totals.warning,
      },
    });
  } catch (err) {
    res.set('X-Health-Source', 'router');
    res.status(200).json({ success: true, message: 'OK' });
  }
});

// Endpoint de salud estÃ¡ndar esperado por el frontend
app.get('/api/health_app', rateLimit({
  windowMs: 60_000,
  max: 120,
  handler: async (req, res) => {
    await EventLogService.record({
      type: 'RATE_LIMIT',
      severity: 'warning',
      message: 'Rate limit activado en /api/health',
      context: 'health',
      details: { ip: req.ip },
    });
    res.status(429).json({ error: 'Demasiadas solicitudes en /api/health' });
  }
}), async (req, res) => {
  try {
    res.set('X-Health-Source', 'app');
    // Refuerzo de no-cache en respuesta
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Cache-Policy', 'no-store');
    // ValidaciÃ³n de configuraciÃ³n (una pasada rÃ¡pida)
    const storagePath = (sequelize as any)?.options?.storage as string | undefined;
    const configStatus = validateConfig(storagePath);

    // Salud de base de datos
    const db = await TransactionService.healthCheck();
    // Salud de cola de trabajos
    const jobQueue = await JobQueueService.health();

    // Salud de sistema de archivos y almacenamiento offline
    const fsHealth = await FileManagerService.checkSystemHealth();
    const offlineHealth = await OfflineStorageService.checkSystemHealth();

    // Salud bÃ¡sica de inventario (tablas y conteos mÃ­nimos)
    const startInv = Date.now();
    let inventoryHealth: any = { ok: false };
    try {
      const tables: string[] = await (sequelize as any).getQueryInterface().showAllTables();
      const hasLedger = tables.includes('stock_ledger');
      const hasIdempotency = tables.includes('idempotency_records');
      let ledgerCount = 0;
      let idempotencyCount = 0;
      if (hasLedger) {
        ledgerCount = await StockLedger.count();
      }
      if (hasIdempotency) {
        const rows = await sequelize.query('SELECT COUNT(*) as c FROM idempotency_records', { type: QueryTypes.SELECT });
        const first: any = Array.isArray(rows) ? rows[0] : { c: 0 };
        idempotencyCount = Number(first?.c || 0);
      }
      inventoryHealth = {
        ok: true,
        latencyMs: Date.now() - startInv,
        tables: { stock_ledger: hasLedger, idempotency_records: hasIdempotency },
        counts: { stock_ledger: ledgerCount, idempotency_records: idempotencyCount },
      };
    } catch (e) {
      inventoryHealth = { ok: false, error: (e as any)?.message || String(e) };
    }

    // Salud bÃ¡sica de ventas (latencia y conteos)
    const startSales = Date.now();
    let salesHealth: any = { status: 'error' };
    try {
      await sequelize.query('SELECT 1');
      const dbLatencyMs = Date.now() - startSales;
      const salesCount = await Sale.count();
      const saleItemsCount = await SaleItem.count();
      salesHealth = { status: 'ok', dbLatencyMs, salesCount, saleItemsCount };
    } catch (e) {
      salesHealth = { status: 'error', error: (e as any)?.message || String(e) };
    }

    // Resumen de mÃ©tricas (event_logs) Ãºltimas 24 horas por severidad
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let countsBySeverity: any[] = [];
    try {
      const [rows]: any = await sequelize.query(
        `SELECT severity, COUNT(*) as count
         FROM event_logs
         WHERE createdAt >= :from
         GROUP BY severity
         ORDER BY count DESC`,
        { replacements: { from } }
      );
      countsBySeverity = rows || [];
    } catch (e) {
      countsBySeverity = [];
    }

    // Normalizar para incluir siempre las 4 severidades esperadas
    const requiredSeverities = ['info', 'warning', 'error', 'exception'];
    countsBySeverity = requiredSeverities.map((sev) => {
      const row = (countsBySeverity || []).find((r: any) => r?.severity === sev);
      return { severity: sev, count: row?.count ?? 0 };
    });

    const totals = {
      info: (countsBySeverity.find((r: any) => r.severity === 'info')?.count ?? 0),
      warning: (countsBySeverity.find((r: any) => r.severity === 'warning')?.count ?? 0),
      error: (countsBySeverity.find((r: any) => r.severity === 'error')?.count ?? 0),
      exception: (countsBySeverity.find((r: any) => r.severity === 'exception')?.count ?? 0),
    };

    const degradationCauses: string[] = [];
    if (!db.healthy) degradationCauses.push('db');
    if (!configStatus.ok || configStatus.errors.length > 0) degradationCauses.push('config');
    if (!fsHealth) degradationCauses.push('filesystem');
    if (!offlineHealth) degradationCauses.push('offlineStorage');
    // JobQueueService.health() no expone 'ok'; degradar si hay 'error'
    if ((jobQueue as any)?.error) degradationCauses.push('jobQueue');
    if (!inventoryHealth?.ok) degradationCauses.push('inventory');
    // Para ventas, se usa 'status' en lugar de 'ok'
    if ((salesHealth as any)?.status !== 'ok') degradationCauses.push('sales');

    const payload = {
      success: true,
      message: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      debugMarker: true,
      uptimeSec: Math.round(process.uptime()),
      db,
      config: {
        ok: configStatus.ok,
        errors: configStatus.errors.length,
        warnings: configStatus.warnings.length,
      },
      modules: {
        jobQueue,
        filesystem: { ok: !!fsHealth },
        offlineStorage: { ok: !!offlineHealth },
        inventory: inventoryHealth,
        sales: salesHealth,
      },
      degradation: {
        ok: degradationCauses.length === 0,
        causes: degradationCauses,
      },
      metrics: {
        countsBySeverity,
        totals,
        windowHours: 24,
      },
      buildVersion: process.env.BUILD_VERSION || process.env.npm_package_version || 'dev',
      errorBudget: {
        windowHours: 24,
        errorCount: totals.error + totals.exception,
        warningCount: totals.warning,
      },
    };
    res.status(200).json(payload);
    await EventLogService.record({
      type: 'HEALTH_CHECK',
      severity: 'info',
      message: 'Health OK desde app',
      context: 'health',
    });
  } catch (err) {
    res.set('X-Health-Source', 'app');
    await EventLogService.record({
      type: 'ERROR',
      severity: 'error',
      message: 'Fallo en /api/health',
      context: 'health',
      details: { error: (err as any)?.message },
    });
    res.status(200).json({ success: true, message: 'OK' });
  }
});

// Métricas de eventos y salud agregadas
  app.get('/api/health/metrics', async (req, res) => {
    res.set('X-Health-Source', 'app');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    try {
      const { sequelize } = await import('./db/config');
      const [rows]: any = await sequelize.query(
        `SELECT severity, COUNT(*) as count
         FROM event_logs
         WHERE createdAt >= datetime('now', '-24 hours')
         GROUP BY severity`
      );
    
    const rawCounts = Array.isArray(rows) ? rows : [];
    const requiredSeverities = ['info', 'warning', 'error', 'exception'];
    const countsBySeverity = requiredSeverities.map((sev) => {
      const row = rawCounts.find((r: any) => r?.severity === sev);
      return { severity: sev, count: row?.count ?? 0 };
    });
    const totals = {
      info: (countsBySeverity.find((r: any) => r.severity === 'info')?.count ?? 0),
      warning: (countsBySeverity.find((r: any) => r.severity === 'warning')?.count ?? 0),
      error: (countsBySeverity.find((r: any) => r.severity === 'error')?.count ?? 0),
      exception: (countsBySeverity.find((r: any) => r.severity === 'exception')?.count ?? 0),
    };

    await EventLogService.record({
      type: 'HEALTH_METRICS',
      severity: 'info',
      message: 'Consulta de métricas de salud',
      context: 'health',
    });

    res.status(200).json({
      success: true,
      windowHours: 24,
      countsBySeverity,
      totals,
    });
  } catch (error) {
    await EventLogService.record({
      type: 'ERROR',
      severity: 'error',
      message: 'Fallo en /api/health/metrics',
      context: 'health',
      details: { error: (error as any)?.message },
    });
    res.status(500).json({ success: false, error: 'No se pudieron obtener métricas' });
  }
});

// Endpoint temporal de depuraciÃ³n de base de datos
app.get('/api/debug-db', async (req, res) => {
  try {
    const { sequelize } = await import('./db/config');
    
    // Verificar conexiÃ³n
    await sequelize.authenticate();
    
    // Verificar tablas
    const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table';");
    
    // Verificar usuarios
    let userCount = 0;
    try {
      const [users] = await sequelize.query("SELECT COUNT(*) as count FROM users;");
      userCount = (users[0] as any).count;
    } catch (error) {
      console.error('Error al contar usuarios:', (error as Error).message);
    }
    
    res.json({
      success: true,
      data: {
        connection: 'OK',
        tables: (tables as any[]).map((t: any) => t.name),
        userCount,
        dbPath: (sequelize as any).options?.storage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
      stack: (error as Error).stack
    });
  }
});

// Log antes de las rutas
app.use('/api', (req, res, next) => {
  console.log('=== BEFORE ROUTES MIDDLEWARE ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Path:', req.path);
  next();
});

// Política global de no-cache para todas las respuestas bajo /api
app.use('/api', (req, res, next) => {
  try {
    const value = 'no-store, no-cache, must-revalidate';
    res.set('Cache-Control', value);
    res.set('Pragma', 'no-cache');
    res.setHeader('Cache-Control', value);
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Cache-Policy', 'no-store');
  } catch {}
  next();
});

// Rutas de la API
// Métricas por solicitud (Prometheus)
app.use(requestMetricsMiddleware);
// Endpoint de métricas Prometheus (público, antes del router /api)
app.get('/api/metrics/prom', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send(`# error: ${(err as Error)?.message || String(err)}`);
  }
});
// Rutas de la API
app.use('/api', routes);

// Servir archivos estÃ¡ticos de exports (tickets, charts, etc.)
// Ajuste: resolver correctamente el directorio 'exports' cuando el cwd es 'backend'
// Preferir el 'exports' en la raíz del proyecto si existe; si no, usar el de backend
const rootExportsPath = path.join(__dirname, '../../exports');
const cwdExportsPath = path.join(process.cwd(), 'exports');
const exportsPath = fs.existsSync(rootExportsPath) ? rootExportsPath : cwdExportsPath;
app.use('/exports', express.static(exportsPath));

// Servir archivos estÃ¡ticos de imÃ¡genes subidas
// Directorio base para uploads (configurable por env UPLOADS_BASE_PATH)
import { ensureUploadsSubdir } from './utils/uploads';
const uploadsBasePath = ensureUploadsSubdir('');
app.use('/uploads', express.static(uploadsBasePath));

// Endpoint temporal de prueba para tickets (SIN AUTENTICACIÃ“N)
app.get('/api/test-ticket/:saleId', async (req, res) => {
  try {
    const { TicketController } = await import('./controllers/ticketController');
    await TicketController.generateTicket(req, res);
  } catch (error) {
    console.error('Error en endpoint de prueba:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir archivos estÃ¡ticos del frontend en producciÃ³n
if (process.env.NODE_ENV === 'production') {
  const frontendPath = process.env.FRONTEND_DIST
    ? process.env.FRONTEND_DIST
    : path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // Express 5: usar expresiÃ³n regular para evitar conflicto con path-to-regexp
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Middleware de manejo de errores
app.use(errorLogger);

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('ðŸš¨ GLOBAL ERROR HANDLER TRIGGERED');
  console.log('ðŸš¨ Error type:', typeof error);
  console.log('ðŸš¨ Error constructor:', error.constructor.name);
  console.log('ðŸš¨ Error message:', error.message);
  console.log('ðŸš¨ Error stack:', error.stack);
  console.log('ðŸš¨ Request URL:', req.url);
  console.log('ðŸš¨ Request method:', req.method);
  
  logger.error('Unhandled application error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    sql: (error as any)?.sql,
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : error.message,
    sql: (error as any)?.sql,
  });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
  });
});

// FunciÃ³n para inicializar la base de datos
export const initializeDatabase = async () => {
  try {
    console.log('Starting database initialization...');
    console.log('Sequelize in app.ts:', !!sequelize);
    console.log('Sequelize type:', typeof sequelize);
    console.log('Sequelize authenticate method in app.ts:', typeof sequelize?.authenticate);
    
    if (!sequelize) {
      throw new Error('Sequelize instance is not available');
    }
    
    if (typeof sequelize.authenticate !== 'function') {
      throw new Error('Sequelize authenticate method is not available');
    }
    
    await sequelize.authenticate();
    logger.info('ConexiÃ³n a la base de datos establecida exitosamente');
    
    const dialect = sequelize.getDialect();
    if (dialect === 'sqlite') {
      // Activar modos recomendados de SQLite para servidor local
      try {
        await sequelize.query('PRAGMA journal_mode=WAL;');
        await sequelize.query('PRAGMA synchronous=NORMAL;');
        await sequelize.query('PRAGMA foreign_keys=ON;');
        logger.info('PRAGMAs SQLite aplicados: WAL, synchronous=NORMAL, foreign_keys=ON');
      } catch (pragmaError) {
        logger.warn('No se pudieron aplicar PRAGMAs SQLite', { error: (pragmaError as any)?.message });
      }
    } else {
      logger.info(`Saltando PRAGMAs específicos de SQLite para dialecto: ${dialect}`);
    }
    
    // Inicializar modelos despuÃ©s de establecer la conexiÃ³n
    const { initializeModels } = await import('./models');
    initializeModels();
    logger.info('Modelos inicializados exitosamente');

    // Inicializar explÃ­citamente modelos adicionales (en caso de que el Ã­ndice no los incluya por cache)
    try {
      const { initializeStoredFile } = await import('./models/StoredFile');
      const { initializeAuditTrail } = await import('./models/AuditTrail');
      const { initializeJobQueue } = await import('./models/JobQueue');
      const { initializeStockLedger } = await import('./models/StockLedger');
      initializeStoredFile(sequelize);
      initializeAuditTrail(sequelize);
      initializeJobQueue(sequelize);
      initializeStockLedger(sequelize);
      logger.info('Modelos adicionales (files, audit_trail, job_queue, stock_ledger) inicializados');
    } catch (e) {
      logger.warn('No se pudieron inicializar modelos adicionales', { error: (e as any)?.message });
    }

    // Asegurar columnas de referencias de pago en tabla sales (solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [columns]: any = await sequelize.query("PRAGMA table_info('sales')");
        const names = Array.isArray(columns) ? columns.map((c: any) => c.name) : [];
        if (!names.includes('cardReference')) {
          await sequelize.query("ALTER TABLE sales ADD COLUMN cardReference TEXT");
          logger.info('Columna cardReference aÃ±adida a sales');
        }
        if (!names.includes('transferReference')) {
          await sequelize.query("ALTER TABLE sales ADD COLUMN transferReference TEXT");
          logger.info('Columna transferReference aÃ±adida a sales');
        }
      } catch (e) {
        logger.warn('No se pudieron verificar/agregar columnas de referencias de pago', { error: (e as any)?.message });
      }
    } else {
      logger.info('Saltando verificación de columnas en sales (no SQLite)');
    }

    // Asegurar presets en tabla settings (idempotente, solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [settingsCols]: any = await sequelize.query("PRAGMA table_info('settings')");
        const sNames = Array.isArray(settingsCols) ? settingsCols.map((c: any) => c.name) : [];
        if (!sNames.includes('inventoryFilterPresets')) {
          await sequelize.query("ALTER TABLE settings ADD COLUMN inventoryFilterPresets TEXT DEFAULT '[]'");
          logger.info('Columna inventoryFilterPresets aÃ±adida a settings');
        }
      } catch (e) {
        logger.warn('No se pudo verificar/agregar columna inventoryFilterPresets en settings', { error: (e as any)?.message });
      }
    }

    // Asegurar tabla event_logs e índices (idempotente, solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [existingTables]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='event_logs'");
        const exists = Array.isArray(existingTables) && existingTables.length > 0;
        if (!exists) {
          await sequelize.query(`
            CREATE TABLE event_logs (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              severity TEXT,
              message TEXT NOT NULL,
              context TEXT,
              userId TEXT,
              details TEXT,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        // Índices idempotentes
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(type)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_event_logs_severity ON event_logs(severity)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_event_logs_createdAt ON event_logs(createdAt)");
        logger.info('Tabla event_logs e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla event_logs', { error: (e as any)?.message });
      }
    }

    // Asegurar tablas de Phase 1.1 (idempotente, solo SQLite)
    // Tabla files
    if (dialect === 'sqlite') {
      try {
        const [existingFiles]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='files'");
        const filesExists = Array.isArray(existingFiles) && existingFiles.length > 0;
        if (!filesExists) {
          await sequelize.query(`
            CREATE TABLE files (
              id TEXT PRIMARY KEY,
              filename TEXT NOT NULL,
              mimeType TEXT,
              size INTEGER,
              checksum TEXT NOT NULL,
              storage TEXT NOT NULL DEFAULT 'local',
              path TEXT NOT NULL,
              entityType TEXT,
              entityId TEXT,
              metadata TEXT,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        await sequelize.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_files_entity ON files(entityType, entityId)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_files_createdAt ON files(createdAt)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename)");
        logger.info('Tabla files e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla files', { error: (e as any)?.message });
      }
    }

    // Tabla audit_trail (solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [existingAudit]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_trail'");
        const auditExists = Array.isArray(existingAudit) && existingAudit.length > 0;
        if (!auditExists) {
          await sequelize.query(`
            CREATE TABLE audit_trail (
              id TEXT PRIMARY KEY,
              operation TEXT NOT NULL,
              entityType TEXT,
              entityId TEXT,
              actorId TEXT,
              actorRole TEXT,
              result TEXT NOT NULL DEFAULT 'success',
              message TEXT,
              details TEXT,
              correlationId TEXT,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_trail(operation)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entityType, entityId)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actorId)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_audit_createdAt ON audit_trail(createdAt)");
        logger.info('Tabla audit_trail e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla audit_trail', { error: (e as any)?.message });
      }
    }

    // Tabla job_queue (solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [existingQueue]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='job_queue'");
        const queueExists = Array.isArray(existingQueue) && existingQueue.length > 0;
        if (!queueExists) {
          await sequelize.query(`
            CREATE TABLE job_queue (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'queued',
              payload TEXT,
              attempts INTEGER NOT NULL DEFAULT 0,
              maxAttempts INTEGER NOT NULL DEFAULT 5,
              scheduledAt DATETIME,
              availableAt DATETIME,
              lockedAt DATETIME,
              error TEXT,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_job_status ON job_queue(status)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_job_type ON job_queue(type)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_job_available ON job_queue(availableAt)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_job_scheduled ON job_queue(scheduledAt)");
        logger.info('Tabla job_queue e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla job_queue', { error: (e as any)?.message });
      }
    }

    // Tabla stock_ledger (solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [existingLedger]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_ledger'");
        const ledgerExists = Array.isArray(existingLedger) && existingLedger.length > 0;
        if (!ledgerExists) {
          await sequelize.query(`
            CREATE TABLE stock_ledger (
              id TEXT PRIMARY KEY,
              productId TEXT NOT NULL,
              branchId TEXT,
              movementType TEXT NOT NULL,
              quantityChange INTEGER NOT NULL,
              unitCost REAL,
              referenceType TEXT,
              referenceId TEXT,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_ledger_product ON stock_ledger(productId)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_ledger_branch ON stock_ledger(branchId)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_ledger_createdAt ON stock_ledger(createdAt)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_ledger_ref ON stock_ledger(referenceType, referenceId)");
        logger.info('Tabla stock_ledger e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla stock_ledger', { error: (e as any)?.message });
      }
    }

    // Tabla filter_presets (solo SQLite)
    if (dialect === 'sqlite') {
      try {
        const [existingPreset]: any = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='filter_presets'");
        const presetsTableExists = Array.isArray(existingPreset) && existingPreset.length > 0;
        if (!presetsTableExists) {
          await sequelize.query(`
            CREATE TABLE filter_presets (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              area TEXT NOT NULL,
              scope TEXT NOT NULL CHECK(scope IN ('user','global')),
              userId TEXT,
              payload TEXT NOT NULL,
              isDefault INTEGER NOT NULL DEFAULT 0,
              createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
              updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
            );
          `);
        }
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_presets_area ON filter_presets(area)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_presets_scope ON filter_presets(scope)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_presets_user_area ON filter_presets(userId, area)");
        await sequelize.query("CREATE INDEX IF NOT EXISTS idx_presets_default ON filter_presets(area, scope, isDefault)");
        logger.info('Tabla filter_presets e índices verificados/creados');
      } catch (e) {
        logger.warn('No se pudo asegurar tabla filter_presets', { error: (e as any)?.message });
      }
    }
    
    // Inicializar servicio de respaldos
    const { BackupService } = await import('./services/backupService');
    await BackupService.initialize();
    logger.info('Servicio de respaldos inicializado exitosamente');

    // Inicializar servicios offline
    const { FileManagerService } = await import('./services/FileManagerService');
    const { OfflineBackupService } = await import('./services/OfflineBackupService');
    
    await FileManagerService.initializeDirectories();
    logger.info('Estructura de directorios offline inicializada');
    
    const offlineBackupService = OfflineBackupService.getInstance();
    await offlineBackupService.initialize();
    logger.info('Servicio de respaldos offline inicializado');
    
    // Sincronización opcional de modelos (solo si FORCE_SYNC_DB=true)
    const forceSync = (process.env.FORCE_SYNC_DB || '').toLowerCase() === 'true';
    const syncMode = (process.env.FORCE_SYNC_DB_MODE || '').toLowerCase();
    if (forceSync) {
      if (syncMode === 'force') {
        await sequelize.sync({ force: true });
        logger.info('Modelos sincronizados con la base de datos (force)');
      } else {
        await sequelize.sync({ alter: true });
        logger.info('Modelos sincronizados con la base de datos (alter)');
      }
    } else {
      logger.info('Usando base de datos existente sin sincronización');
    }
  } catch (error) {
    logger.error('Error al conectar con la base de datos:', error);
    throw error;
  }
};

export default app;
