import type { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number; // ventana en ms
  max: number; // máximo de requests por ventana
  keyGenerator?: (req: Request) => string;
};

// Rate limiting simple en memoria, suficiente para proteger endpoints públicos como /api/health
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator } = options;
  const hits = new Map<string, number[]>();

  function getKey(req: Request) {
    if (keyGenerator) return keyGenerator(req);
    const ip = (req.ip || req.socket.remoteAddress || 'unknown');
    return String(ip);
  }

  return function (req: Request, res: Response, next: NextFunction) {
    try {
      const key = getKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      const arr = hits.get(key) || [];
      const recent = arr.filter((t) => t >= windowStart);
      recent.push(now);
      hits.set(key, recent);
      if (recent.length > max) {
        res.status(429).json({ success: false, message: 'Too Many Requests' });
        return;
      }
    } catch (_) {
      // En caso de error, no bloquear
    }
    next();
  };
}

