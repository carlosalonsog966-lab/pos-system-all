import { Router } from 'express';
import { JobController } from '../controllers/jobController';
import { authenticateToken, requireAnyRole, requireManagerOrAdmin } from '../middleware/auth';

const router = Router();

// Todas las rutas de jobs requieren autenticación
router.use(authenticateToken);

// Salud del worker
router.get('/health', requireAnyRole, JobController.health);

// Encolar nuevo job
router.post('/', requireManagerOrAdmin, JobController.enqueue);

// Listar jobs
router.get('/', requireAnyRole, JobController.list);

// Obtener detalle de job
router.get('/:id', requireAnyRole, JobController.getById);

// Reintentar un job fallido
router.post('/:id/retry', requireManagerOrAdmin, JobController.retry);

export default router;

