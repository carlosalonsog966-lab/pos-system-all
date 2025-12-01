import { Router } from 'express';
import { SaleController } from '../controllers/saleController';
import { validateBody, validateQuery } from '../middleware/validation';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';
import { createSaleSchema, updateSaleSchema, saleQuerySchema } from '../schemas/sale';
import { saleValidation, validateResults, sanitizeInput, validateStockAvailability } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

console.log('=== SALES ROUTES LOADED ===');

// Middleware de debug
router.use((req, res, next) => {
  console.log('=== SALES ROUTE MIDDLEWARE DEBUG ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Aplicar sanitización
router.use(sanitizeInput);

// Esquemas para validación de parámetros
const uuidSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

const statsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
});

// Rutas de consulta
router.get('/', requireAnyRole, validateQuery(saleQuerySchema), SaleController.getSales);
router.get('/stats', requireManagerOrAdmin, validateQuery(statsQuerySchema), SaleController.getSalesStats);
router.get('/tourism-stats', requireManagerOrAdmin, validateQuery(statsQuerySchema), SaleController.getTourismStats);
router.get('/health', requireAnyRole, SaleController.getSalesHealth);
router.get('/metrics', requireAnyRole, SaleController.getSalesMetrics);
router.get('/export/csv', requireAnyRole, SaleController.exportSalesCSV);
router.get('/guide/:id', requireAnyRole, validateQuery(saleQuerySchema), SaleController.getSalesByGuide);
router.get('/employee/:id', requireAnyRole, validateQuery(saleQuerySchema), SaleController.getSalesByEmployee);
router.get('/agency/:id', requireAnyRole, validateQuery(saleQuerySchema), SaleController.getSalesByAgency);
router.get('/:id', requireAnyRole, SaleController.getSaleById);

// Rutas de creación y modificación
router.post('/', requireAnyRole, SaleController.createSale);
router.put('/:id', requireManagerOrAdmin, validateBody(updateSaleSchema), SaleController.updateSale);

router.post('/:id/refund', requireManagerOrAdmin, SaleController.refundSale);


export default router;
