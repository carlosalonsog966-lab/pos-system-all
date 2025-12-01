import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Registrar métricas por defecto una sola vez
let defaultMetricsStarted = false;
if (!defaultMetricsStarted) {
  client.collectDefaultMetrics({ prefix: 'pos_backend_' });
  defaultMetricsStarted = true;
}

// Contador de solicitudes HTTP
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de solicitudes HTTP procesadas',
  labelNames: ['method', 'route', 'status_code'],
});

// Histograma de duración de solicitudes HTTP en segundos
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de solicitudes HTTP por ruta/método/status',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startHrTime = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(startHrTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const labels = {
      method: req.method,
      // Normalizar ruta; si no está disponible, usar req.path o originalUrl
      route: (req.route?.path
        ? (typeof req.route.path === 'string' ? req.route.path : String(req.route.path))
        : (req.path || req.originalUrl || 'unknown')),
      status_code: String(res.statusCode),
    } as const;

    try {
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    } catch {}
  });
  next();
}

export const metricsRegister = client.register;

