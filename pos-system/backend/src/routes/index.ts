import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { TransactionService } from '../services/transactionService';
import { sequelize } from '../db/config';
// Importar implementación JS del validador para compatibilidad de runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateConfig } = require('../utils/configValidator');
import authRoutes from './auth';
import productRoutes from './products';
import categoryRoutes from './categoryRoutes';
import clientRoutes from './clients';
import saleRoutes from './sales';
import reportRoutes from './reports';
import chartCaptureRoutes from './chartCaptureRoutes';
import ticketRoutes from './ticketRoutes';
import testTicketRoutes from './testTicketRoutes';
import checkoutRoutes from './checkout';
import inventoryRoutes from './inventory';
import cycleCountRoutes from './cycleCounts';
import transferRoutes from './transfers';
import rfidRoutes from './rfid';
import returnsRoutes from './returns';
import settingsRoutes from './settings';
import backupRoutes from './backup';
import cashRegisterRoutes from './cashRegister';
import offlineRoutes from './offline';
import userRoutes from './users';
// Rutas del sistema de turismo
import agencyRoutes from './agencyRoutes';
import guideRoutes from './guideRoutes';
import employeeRoutes from './employeeRoutes';
import branchRoutes from './branchRoutes';
import barcodeRoutes from './barcodeRoutes';
import guideRegistrationRoutes from './guideRegistrations';
import rankingRoutes from './rankings';
import eventsRoutes from './events';
import metricsRoutes from './metrics';
import fileRoutes from './files';
import productAssetRoutes from './productAssets';
import certificationRoutes from './certifications';
import warrantyRoutes from './warranties';
import appraisalRoutes from './appraisals';
import labelRoutes from './labels';
import auditRoutes from './audit';
import jobRoutes from './jobs';
import filterPresetRoutes from './filterPresets';
import integrityRoutes from './integrity';
import aiRoutes from './ai';
import { sha256OfBuffer } from '../utils/hash';
import fs from 'fs';
import path from 'path';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';
import docsRoutes from './docs';
import metricsPromRoutes from './metricsProm';
import { HealthController } from '../controllers/healthController';
import { getPerformanceMetrics } from '../middleware/performance';

const router = Router();

// Log de depuración para el router principal
router.use((req, res, next) => {
  console.log('=== MAIN ROUTER DEBUG ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Original URL:', req.originalUrl);
  next();
});

// Rutas de la API
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/clients', clientRoutes);
router.use('/sales', saleRoutes);
router.use('/reports', reportRoutes);
router.use('/charts', chartCaptureRoutes);
router.use('/tickets', ticketRoutes);
router.use('/test-tickets', testTicketRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/inventory/cycle-counts', cycleCountRoutes);
router.use('/inventory/transfers', transferRoutes);
router.use('/inventory/rfid', rfidRoutes);
router.use('/returns', returnsRoutes);
router.use('/settings', settingsRoutes);
router.use('/backup', backupRoutes);
router.use('/cash-register', cashRegisterRoutes);
router.use('/offline', offlineRoutes);
router.use('/users', userRoutes);
router.use('/files', fileRoutes);
router.use('/product-assets', productAssetRoutes);
router.use('/certifications', certificationRoutes);
router.use('/warranties', warrantyRoutes);
router.use('/appraisals', appraisalRoutes);
router.use('/labels', labelRoutes);
router.use('/audit', auditRoutes);
router.use('/jobs', jobRoutes);
router.use('/filter-presets', filterPresetRoutes);
router.use('/integrity', integrityRoutes);
router.use('/ai', aiRoutes);
// Documentación Swagger
router.use('/docs', docsRoutes);

// Rutas del sistema de turismo
router.use('/agencies', agencyRoutes);
router.use('/guides', guideRoutes);
router.use('/employees', employeeRoutes);
router.use('/branches', branchRoutes);
router.use('/barcodes', barcodeRoutes);
router.use('/guide-registrations', guideRegistrationRoutes);
router.use('/rankings', rankingRoutes);
router.use('/events', eventsRoutes);
// Export Prometheus-compatible metrics under /api/metrics/prom (público)
router.use('/', metricsPromRoutes);
// Rutas existentes de métricas internas (pueden requerir auth)
router.use('/metrics', metricsRoutes);

// Ruta de salud avanzada
router.get('/health', rateLimit({ windowMs: 60_000, max: 120 }), HealthController.getHealth);

// Ruta de métricas de rendimiento
router.get('/performance/metrics', rateLimit({ windowMs: 60_000, max: 60 }), getPerformanceMetrics);

// Catálogo de endpoints (rate limited)
router.get('/meta/endpoints', rateLimit({ windowMs: 60_000, max: 60 }), (req, res) => {
  try {
    type Endpoint = { method: string; path: string };

    function extractEndpoints(r: any): Endpoint[] {
      const out: Endpoint[] = [];
      const stack: any[] = (r?.stack || []);
      for (const layer of stack) {
        // Rutas directas definidas con router.get/post/etc
        if (layer?.route) {
          const routePath: string = layer.route?.path || '';
          const methods = Object.keys(layer.route?.methods || {}).filter((m) => (layer.route.methods as any)[m]);
          for (const m of methods) {
            out.push({ method: m.toUpperCase(), path: routePath });
          }
          continue;
        }
        // Subrouters montados con router.use('/base', subrouter)
        const handle = (layer as any)?.handle;
        const basePath = (layer as any)?.path || '';
        if (handle?.stack && typeof basePath === 'string' && basePath) {
          const nested = extractEndpoints(handle);
          for (const ep of nested) {
            const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
            out.push({ method: ep.method, path: `${base}${ep.path}` });
          }
        }
      }
      return out;
    }

    const endpoints = extractEndpoints(router).map((e) => ({
      method: e.method,
      path: `/api${e.path.startsWith('/') ? e.path : `/${e.path}`}`,
    }));

    // Ordenar y eliminar duplicados
    const seen = new Set<string>();
    const unique = endpoints.filter((e) => {
      const key = `${e.method} ${e.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => (a.path.localeCompare(b.path) || a.method.localeCompare(b.method)));

    // Filtros opcionales: q (substring en path), method, base (/api/<base>)
    const q = (req.query.q || '').toString();
    const methodFilterRaw = (req.query.method || '').toString();
    const methodFilter = methodFilterRaw ? methodFilterRaw.toUpperCase() : '';
    const baseRaw = (req.query.base || '').toString();
    const base = baseRaw ? (baseRaw.startsWith('/') ? baseRaw : `/${baseRaw}`) : '';

    const filtered = unique.filter((e) => {
      if (q && !e.path.includes(q)) return false;
      if (methodFilter && e.method !== methodFilter) return false;
      if (base && !e.path.startsWith(`/api${base}`)) return false;
      return true;
    });

    // Filtro opcional por alcance (heurístico + presets vía .env): public|protected|preset
    const scopeParam = (req.query.scope || '').toString().toLowerCase();
    const publicMatchers = [
      '/api/health',
      '/api/test-health',
      '/api/meta/endpoints',
      '/api/meta/config',
      '/api/test-ticket',
      '/api/settings/public',
      '/api/settings/system-info',
    ];

    // Presets de alcance desde .env: PUBLIC_ENDPOINTS, PROTECTED_ENDPOINTS (coma-separado, soporta '*')
    const publicEnvRaw = (process.env.PUBLIC_ENDPOINTS || '').toString();
    const protectedEnvRaw = (process.env.PROTECTED_ENDPOINTS || '').toString();
    const publicPatterns = publicEnvRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const protectedPatterns = protectedEnvRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const hasPresetPatterns = publicPatterns.length > 0 || protectedPatterns.length > 0;

    function normalizePattern(p: string) {
      let s = (p || '').trim();
      if (!s) return '';
      // Asegurar prefijo /api
      if (!s.startsWith('/')) s = `/${s}`;
      if (!s.startsWith('/api')) s = `/api${s}`;
      // Remover barra final para consistencia
      if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
      return s;
    }

    function wildcardToRegExp(pattern: string) {
      const norm = normalizePattern(pattern);
      // Escapar y convertir '*' a '.*' con anclaje y permitir sufijos de consulta o sub-rutas
      const escaped = norm.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
      const src = '^' + escaped.replace(/\\\*/g, '.*') + '(?:$|[/?].*)';
      return new RegExp(src);
    }

    function matchPatterns(patterns: string[], path: string) {
      if (!patterns.length) return false;
      const regs = patterns.map(wildcardToRegExp);
      return regs.some((r) => r.test(path));
    }

    function isPublicPath(p: string) {
      // Presets públicos tienen prioridad
      if (matchPatterns(publicPatterns, p)) return true;
      // Heurística base
      return publicMatchers.some((m) => p === m || p.startsWith(m + '/') || p.startsWith(m + '?'));
    }

    const scoped = filtered.filter((e) => {
      if (scopeParam === 'public') return isPublicPath(e.path);
      if (scopeParam === 'protected') return !isPublicPath(e.path) || matchPatterns(protectedPatterns, e.path);
      if (scopeParam === 'preset') {
        if (!hasPresetPatterns) return true; // sin patrones definidos, no filtrar
        return matchPatterns(publicPatterns, e.path) || matchPatterns(protectedPatterns, e.path);
      }
      return true; // all
    });

    // Agrupación opcional por módulo principal (/api/<module>/...)
    const groupParam = (req.query.group || '').toString();
    let groups: Array<{ module: string; count: number }> | undefined;
    if (groupParam === 'module') {
      const counts = new Map<string, number>();
      for (const e of scoped) {
        const rest = e.path.replace(/^\/api\/?/, '');
        const first = rest.split('/')[0] || '';
        const curr = counts.get(first) || 0;
        counts.set(first, curr + 1);
      }
      groups = Array.from(counts.entries()).map(([module, count]) => ({ module, count }))
        .sort((a, b) => a.module.localeCompare(b.module));
    }

    // Exportación opcional en CSV (method,path)
    const formatParam = (req.query.format || '').toString().toLowerCase();
    const downloadParam = (req.query.download || '').toString().toLowerCase();
    const asDownload = ['1', 'true', 'yes', 'on'].includes(downloadParam);
    if (formatParam === 'csv') {
      const lines = ['method,path', ...scoped.map((e) => `${e.method},${e.path}`)];
      const csv = lines.join('\n');
      const bom = '\uFEFF';
      const body = bom + csv;
      const checksum = sha256OfBuffer(Buffer.from(body, 'utf8'));
      const filename = 'endpoints.csv';
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, {
        filename,
        contentType: 'text/csv; charset=utf-8',
        body,
        checksum,
        expected,
        setContentLength: true,
        asAttachment: asDownload,
      });
      if (asDownload) {
        const base = ExportsIntegrityService.getExportsBasePath();
        const abs = path.join(base, filename);
        try { fs.mkdirSync(base, { recursive: true }); } catch {}
        fs.writeFileSync(abs, body, 'utf8');
        const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
        ExportsIntegrityService.recordFile(abs, 'report', correlationId);
      }
      res.send(body);
      return;
    }

    // Exportación en JSONL/NDJSON
    if (formatParam === 'jsonl' || formatParam === 'ndjson') {
      const body = scoped.map((e) => JSON.stringify(e)).join('\n') + '\n';
      const checksum = sha256OfBuffer(Buffer.from(body, 'utf8'));
      const filename = 'endpoints.jsonl';
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, {
        filename,
        contentType: 'application/x-ndjson; charset=utf-8',
        body,
        checksum,
        expected,
        setContentLength: true,
        asAttachment: asDownload,
      });
      if (asDownload) {
        const base = ExportsIntegrityService.getExportsBasePath();
        const abs = path.join(base, filename);
        try { fs.mkdirSync(base, { recursive: true }); } catch {}
        fs.writeFileSync(abs, body, 'utf8');
        const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
        ExportsIntegrityService.recordFile(abs, 'report', correlationId);
      }
      res.send(body);
      return;
    }

    // Exportación en YAML (incluye count, endpoints y opcionalmente groups)
    if (formatParam === 'yaml' || formatParam === 'yml') {
      function yamlValue(v: unknown) {
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        const s = String(v).replace(/"/g, '\\"');
        return `"${s}"`;
      }
      const lines: string[] = [];
      lines.push(`count: ${scoped.length}`);
      lines.push('endpoints:');
      for (const e of scoped) {
        lines.push('  - method: ' + yamlValue(e.method));
        lines.push('    path: ' + yamlValue(e.path));
      }
      if (groupParam === 'module' && groups) {
        lines.push('groups:');
        for (const g of groups) {
          lines.push('  - module: ' + yamlValue(g.module));
          lines.push('    count: ' + yamlValue(g.count));
        }
      }
      const yaml = lines.join('\n') + '\n';
      const checksum = sha256OfBuffer(Buffer.from(yaml, 'utf8'));
      const filename = 'endpoints.yaml';
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, {
        filename,
        contentType: 'application/yaml; charset=utf-8',
        body: yaml,
        checksum,
        expected,
        setContentLength: true,
        asAttachment: asDownload,
      });
      if (asDownload) {
        const base = ExportsIntegrityService.getExportsBasePath();
        const abs = path.join(base, filename);
        try { fs.mkdirSync(base, { recursive: true }); } catch {}
        fs.writeFileSync(abs, yaml, 'utf8');
        const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
        ExportsIntegrityService.recordFile(abs, 'report', correlationId);
      }
      res.send(yaml);
      return;
    }

    res.json({ success: true, count: scoped.length, endpoints: scoped, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Error generando catálogo' });
  }
});

// Meta configuración del servidor y entorno (rate limited)
router.get('/meta/config', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const host = process.env.HOST || '0.0.0.0';
    const httpsEnabled = (process.env.HTTPS === '1' || process.env.HTTPS === 'true');
    const pfxPath = process.env.HTTPS_PFX_PATH || '';
    const sslKeyPath = process.env.SSL_KEY_PATH || '';
    const sslCertPath = process.env.SSL_CERT_PATH || '';

    // Puerto "reportado" por el Host header (más fiel al runtime)
    const hostHeader = req.get('host') || '';
    const actualPort = Number(hostHeader.includes(':') ? hostHeader.split(':')[1] : (nodeEnv === 'development' ? 5656 : (process.env.PORT || 5656)));

    // CORS similares a app.ts
    const appHost = process.env.APP_HOST || 'localhost';
    const publicOrigin = process.env.PUBLIC_ORIGIN || '';
    const frontendUrl = process.env.FRONTEND_URL || '';
    const computedOrigins = [
      frontendUrl,
      publicOrigin,
      `http://${appHost}:${actualPort}`,
      `https://${appHost}:${actualPort}`,
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'https://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'https://localhost:5175',
      'http://127.0.0.1:5175',
      // Preview actual
      'http://localhost:5180',
      'https://localhost:5180',
      'http://127.0.0.1:5180',
      'tauri://localhost'
    ].filter(Boolean);

    // DB info
    const storagePath = (sequelize as any)?.options?.storage as string | undefined;
    const dbDialect = (sequelize as any)?.options?.dialect || 'sqlite';

    // Validación de configuración
    const cfg = validateConfig(storagePath);

    // Modo verbose opcional: permitido sólo en development o si hay Authorization
    const verboseParam = (req.query.verbose ?? '').toString().toLowerCase();
    const requestedVerbose = ['1', 'true', 'yes', 'on'].includes(verboseParam);
    const hasAuthHeader = !!(req.get('authorization'));
    const verboseAllowed = (nodeEnv === 'development') || hasAuthHeader;
    const verbose = requestedVerbose && verboseAllowed;

    // Submódulos relevantes
    let uploadsBase: string | null = null;
    try {
      const { getUploadsBasePath } = await import('../utils/uploads');
      uploadsBase = getUploadsBasePath();
    } catch (_) { /* no-op */ }

    // Estado de rate limit global (desactivado en desarrollo según app.ts)
    const isDev = nodeEnv === 'development';

    // Construir payload base
    const payload: any = {
      env: {
        nodeEnv,
        host,
        port: actualPort,
        httpsEnabled,
        https: {
          pfxPath: pfxPath ? 'configured' : 'not-configured',
          sslKeyPath: sslKeyPath ? 'configured' : 'not-configured',
          sslCertPath: sslCertPath ? 'configured' : 'not-configured',
        },
      },
      cors: {
        appHost,
        publicOrigin,
        frontendUrl,
        computedOrigins,
      },
      db: {
        dialect: dbDialect,
        storagePath: storagePath || null,
      },
      uploads: {
        basePath: uploadsBase,
      },
      rateLimit: {
        globalEnabled: !isDev,
        health: { windowMs: 60_000, max: 120 },
        meta: { windowMs: 60_000, max: 60 },
      },
      validation: {
        ok: cfg.ok,
        errors: cfg.errors,
        warnings: cfg.warnings,
        details: cfg.details,
      },
      ...(verbose ? {
        process: {
          pid: process.pid,
          uptimeSec: Math.round(process.uptime()),
          cwd: process.cwd(),
          versions: process.versions,
          memoryUsage: process.memoryUsage(),
        },
        envFlags: {
          JWT_SECRET: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.trim()),
          HTTPS_PFX_PATH: !!pfxPath,
          SSL_KEY_PATH: !!sslKeyPath,
          SSL_CERT_PATH: !!sslCertPath,
          FRONTEND_URL: !!frontendUrl,
          PUBLIC_ORIGIN: !!publicOrigin,
          HTTPS_ENABLED: httpsEnabled,
          SQLITE_STORAGE: !!storagePath,
        }
      } : {})
    };

    // fields=env,cors,db,...
    const fieldsParam = (req.query.fields || '').toString();
    let dataOut: any = payload;
    if (fieldsParam) {
      const requested = fieldsParam.split(',').map((s) => s.trim()).filter(Boolean);
      const selected: any = {};
      for (const key of requested) {
        if (key in payload) selected[key] = payload[key];
      }
      dataOut = selected;
    }

    // Cache-Control para evitar scraping agresivo
    res.setHeader('Cache-Control', 'private, max-age=60');

    // Soporte de formato YAML y descarga opcional
    const formatParam = (req.query.format || '').toString().toLowerCase();
    const downloadParam = (req.query.download || '').toString().toLowerCase();
    const asDownload = ['1', 'true', 'yes', 'on'].includes(downloadParam);

    if (formatParam === 'yaml' || formatParam === 'yml') {
      function yamlScalar(v: any): string {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        const s = String(v).replace(/"/g, '\"');
        return '"' + s + '"';
      }
      function toYaml(obj: any, indent = ''): string {
        if (Array.isArray(obj)) {
          return obj.map((item) => `${indent}- ${typeof item === 'object' && item !== null ? '\n' + toYaml(item, indent + '  ') : yamlScalar(item)}`).join('\n');
        } else if (obj && typeof obj === 'object') {
          return Object.keys(obj).map((k) => {
            const val = obj[k];
            if (val && typeof val === 'object') {
              return `${indent}${k}:\n${toYaml(val, indent + '  ')}`;
            }
            return `${indent}${k}: ${yamlScalar(val)}`;
          }).join('\n');
        }
        return indent + yamlScalar(obj);
      }
      const yamlBody = toYaml({ success: true, data: dataOut }) + '\n';
      const checksum = sha256OfBuffer(Buffer.from(yamlBody, 'utf8'));
      const filename = 'meta-config.yaml';
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, {
        filename,
        contentType: 'application/yaml; charset=utf-8',
        body: yamlBody,
        checksum,
        expected,
        setContentLength: true,
        asAttachment: asDownload,
      });
      res.send(yamlBody);
      return;
    }

    res.json({ success: true, data: dataOut, ...(requestedVerbose && !verboseAllowed ? { note: 'verbose disabled: require development or Authorization header' } : {}) });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Error obteniendo configuración' });
  }
});

// Endpoint temporal de prueba para tickets (SIN AUTENTICACIÓN)
router.get('/test-ticket/:saleId', async (req, res) => {
  try {
    const { TicketController } = await import('../controllers/ticketController');
    await TicketController.generateTicket(req, res);
  } catch (error) {
    console.error('Error en endpoint de prueba:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});



export default router;
