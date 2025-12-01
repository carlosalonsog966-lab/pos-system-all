import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sequelize } from '../db/config';
import { EventLog } from '../models/EventLog';
import { Op } from 'sequelize';

const router = Router();

// Proteger rutas de métricas excepto el endpoint público Prometheus (/api/metrics/prom)
router.use((req, res, next) => {
  const url = (req.originalUrl || req.url || req.path || '').toString();
  // Si la petición es al endpoint público de Prometheus, no exigir auth
  if (url.endsWith('/metrics/prom')) {
    return next();
  }
  return (authenticateToken as any)(req, res, next);
});

// Métricas mínimas basadas en event_logs
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const { from: fromQ, to: toQ, windowHours } = req.query as any;
    const hours = windowHours ? Math.max(parseInt(windowHours) || 24, 1) : 24;
    const from = fromQ ? new Date(fromQ) : new Date(now.getTime() - hours * 60 * 60 * 1000);
    const to = toQ ? new Date(toQ) : undefined;

    const whereDatesSQL = to ? 'WHERE createdAt >= :from AND createdAt <= :to' : 'WHERE createdAt >= :from';

    const [countsByType]: any = await sequelize.query(
      `SELECT type, COUNT(*) as count
       FROM event_logs
       ${whereDatesSQL}
       GROUP BY type
       ORDER BY count DESC`,
      { replacements: to ? { from, to } : { from } }
    );

    const [countsBySeverity]: any = await sequelize.query(
      `SELECT severity, COUNT(*) as count
       FROM event_logs
       ${whereDatesSQL}
       GROUP BY severity
       ORDER BY count DESC`,
      { replacements: to ? { from, to } : { from } }
    );

    const [latestError]: any = await sequelize.query(
      `SELECT id, message, context, createdAt
       FROM event_logs
       WHERE severity = 'error'
       ORDER BY createdAt DESC
       LIMIT 1`
    );

    // Latencias por ruta basadas en eventos de contexto 'http'
    const httpEvents = await EventLog.findAll({
      where: {
        context: 'http',
        createdAt: to ? { [Op.between]: [from, to] } : { [Op.gte]: from },
      },
      attributes: ['id', 'message', 'details', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    // Normalizar rutas para agrupar por patrón (ej: /products/:id)
    const normalizeRoute = (rawUrl: string | undefined): string => {
      const url = (rawUrl || '').split('?')[0] || 'unknown';
      if (url === 'unknown') return url;
      const cleaned = url.replace(/\/+$/,'').replace(/\/+/g,'/');
      const parts = cleaned.split('/').filter(Boolean);
      const normalized = parts.map(seg => {
        if (/^\d+$/.test(seg)) return ':id';
        // UUID v4 común
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(seg)) return ':uuid';
        // Identificadores hex largos (ej: ObjectId)
        if (/^[0-9a-fA-F]{24,}$/.test(seg)) return ':hex';
        return seg;
      });
      return '/' + normalized.join('/');
    };

    // routeStats por patrón y método
    const routeStats: Record<string, Record<string, { durations: number[]; count: number }>> = {};
    httpEvents.forEach(ev => {
      const details: any = (ev as any).get?.('details') ?? (ev as any).details;
      const rawUrl: string | undefined = details?.url;
      const method: string = String(details?.method || 'GET').toUpperCase();
      const url = normalizeRoute(rawUrl);
      const durationMs: number = typeof details?.durationMs === 'number' ? details.durationMs : NaN;
      if (!Number.isFinite(durationMs)) return;
      if (!routeStats[url]) routeStats[url] = {};
      if (!routeStats[url][method]) routeStats[url][method] = { durations: [], count: 0 };
      routeStats[url][method].durations.push(durationMs);
      routeStats[url][method].count += 1;
    });

    const computeP = (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(p * (sorted.length - 1));
      return sorted[idx];
    };

    const latencyByRoute = Object.entries(routeStats)
      .flatMap(([url, methods]) => {
        return Object.entries(methods).map(([method, { durations, count }]) => {
          const avgMs = durations.reduce((s, d) => s + d, 0) / durations.length;
          const p50Ms = computeP(durations, 0.50);
          const p95Ms = computeP(durations, 0.95);
          const p99Ms = computeP(durations, 0.99);
          return { url, method, count, avgMs: Math.round(avgMs), p50Ms: Math.round(p50Ms), p95Ms: Math.round(p95Ms), p99Ms: Math.round(p99Ms) };
        });
      })
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 15);

    const windowHrs = to ? Math.round((to.getTime() - from.getTime()) / (60 * 60 * 1000)) : hours;
    res.json({
      success: true,
      windowHours: windowHrs,
      countsByType,
      countsBySeverity,
      latestError: latestError?.[0] || null,
      latencyByRoute,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
