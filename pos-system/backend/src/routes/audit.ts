import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Consultar auditoría (todos los roles con acceso)
router.get('/', requireAnyRole, AuditController.list);

// Auditoría específica de reembolsos
router.get('/refunds', requireAnyRole, AuditController.refunds);
router.get('/refunds/export.csv', requireAnyRole, AuditController.refundsCsv);

// Resumen/Reporte de auditoría
router.get('/report', requireAnyRole, AuditController.report);

// Obtener registro por ID
router.get('/:id', requireAnyRole, AuditController.getById);

export default router;
