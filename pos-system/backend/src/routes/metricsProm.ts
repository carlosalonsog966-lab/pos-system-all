import { Router } from 'express';
import { metricsRegister } from '../middleware/requestMetrics';

const router = Router();

// Endpoint compatible con Prometheus para exportar métricas
router.get('/metrics/prom', async (_req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    const metrics = await metricsRegister.metrics();
    res.send(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error generando métricas' });
  }
});

export default router;

