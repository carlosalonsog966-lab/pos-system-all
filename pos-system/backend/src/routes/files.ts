import { Router } from 'express';
import { FileController } from '../controllers/fileController';
import { authenticateToken, requireAnyRole } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/zodValidation';
import { fileQuerySchema, fileIdParamsSchema } from '../schemas/file';

const router = Router();

// Todas las rutas de archivos requieren autenticaci�n
router.use(authenticateToken);

// Subir archivo (JSON con base64)
router.post('/', requireAnyRole, FileController.upload);

// Listar archivos por entidad
router.get('/', requireAnyRole, validateQuery(fileQuerySchema), FileController.list);

// Obtener archivo por ID (metadatos + URL p�blica)
router.get('/:id', requireAnyRole, validateParams(fileIdParamsSchema), FileController.getById);

// Descargar archivo por ID con verificación de integridad
router.get('/:id/download', requireAnyRole, validateParams(fileIdParamsSchema), FileController.download);

// Eliminar archivo por ID
router.delete('/:id', requireAnyRole, validateParams(fileIdParamsSchema), FileController.remove);

// Verificar checksum de archivo por ID
router.get('/:id/verify', requireAnyRole, validateParams(fileIdParamsSchema), FileController.verify);

// Escaneo de integridad de todos los archivos
router.get('/integrity/scan', requireAnyRole, validateQuery(fileQuerySchema), FileController.integrityScan);

// Exportaci�n CSV del reporte de integridad
router.get('/integrity/export/csv', requireAnyRole, validateQuery(fileQuerySchema), FileController.exportIntegrityCSV);

// Exportaci�n PDF del reporte de integridad
router.get('/integrity/export/pdf', requireAnyRole, validateQuery(fileQuerySchema), FileController.exportIntegrityPDF);

// Endpoints para descargar el altimo CSV/PDF generado por el job de integridad
router.get('/integrity/latest/csv', requireAnyRole, FileController.exportIntegrityLatestCSV);
router.get('/integrity/latest/pdf', requireAnyRole, FileController.exportIntegrityLatestPDF);

export default router;
