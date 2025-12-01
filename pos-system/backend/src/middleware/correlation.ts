import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function attachCorrelationId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('X-Correlation-Id') || req.header('Correlation-Id') || undefined;
  const correlationId = (incoming && incoming.trim()) || randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

export function attachIdempotencyKey(req: Request, _res: Response, next: NextFunction) {
  const incoming = req.header('Idempotency-Key') || req.header('X-Idempotency-Key') || undefined;
  if (incoming && incoming.trim()) {
    (req as any).idempotencyKey = incoming.trim();
  }
  next();
}
