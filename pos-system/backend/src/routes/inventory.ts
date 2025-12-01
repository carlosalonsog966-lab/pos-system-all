import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { validateRequest, validateBody, validateQuery, validateParams, z } from '../middleware/zodValidation';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';
import { sequelize } from '../db/config';
import StockLedger from '../models/StockLedger';
import { QueryTypes } from 'sequelize';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * POST /api/inventory/update-stock
 * Actualiza el stock de un producto
 */
router.post(
  '/update-stock',
  validateBody(z.object({
    productId: z.string().uuid('ID de producto debe ser un UUID válido'),
    type: z.enum(['in', 'out', 'adjustment', 'transfer']),
    quantity: z.number().positive('Cantidad debe ser positiva'),
    reason: z.string().min(1, 'Razón es requerida').max(500, 'Razón muy larga'),
    reference: z.string().optional(),
    notes: z.string().max(1000, 'Notas muy largas').optional(),
    idempotencyKey: z.string().optional(),
  })),
  requireManagerOrAdmin,
  (req, res) => InventoryController.updateStock(req as any, res)
);

/**
 * POST /api/inventory/transfer
 * Registra transferencia de stock entre sucursales
 */
router.post(
  '/transfer',
  validateBody(z.object({
    productId: z.string().uuid('ID de producto debe ser un UUID válido'),
    quantity: z.number().positive('Cantidad debe ser positiva'),
    fromBranchId: z.string().uuid('ID de sucursal origen inválido'),
    toBranchId: z.string().uuid('ID de sucursal destino inválido'),
    reason: z.string().min(1).max(500).optional(),
    reference: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })),
  requireManagerOrAdmin,
  (req, res) => InventoryController.transferStock(req as any, res)
);

/**
 * POST /api/inventory/bulk-update
 * Actualización masiva de stock
 */
router.post(
  '/bulk-update',
  validateBody(z.object({
    updates: z.array(z.object({
      productId: z.string().uuid('ID de producto debe ser un UUID válido'),
      newStock: z.number().min(0, 'Stock no puede ser negativo'),
      reason: z.string().min(1, 'Razón es requerida').max(500, 'Razón muy larga'),
      notes: z.string().max(1000, 'Notas muy largas').optional(),
    })).min(1, 'Al menos una actualización es requerida').max(100, 'Máximo 100 actualizaciones por lote'),
    idempotencyKey: z.string().optional(),
  })),
  requireManagerOrAdmin,
  (req, res) => InventoryController.bulkUpdateStock(req as any, res)
);

/**
 * GET /api/inventory/alerts
 * Obtiene alertas de stock
 */
router.get(
  '/alerts',
  requireAnyRole,
  (req, res) => InventoryController.getStockAlerts(req as any, res)
);

/**
 * GET /api/inventory/report
 * Genera reporte de inventario
 */
router.get(
  '/report',
  requireAnyRole,
  (req, res) => InventoryController.generateReport(req as any, res)
);

/**
 * GET /api/inventory/low-stock
 * Obtiene productos con stock bajo
 */
router.get(
  '/low-stock',
  requireAnyRole,
  (req, res) => InventoryController.getLowStockProducts(req as any, res)
);

/**
 * GET /api/inventory/stats
 * Obtiene estadísticas de inventario
 */
router.get(
  '/stats',
  requireAnyRole,
  (req, res) => InventoryController.getInventoryStats(req as any, res)
);

/**
 * GET /api/inventory/products/:productId/history
 * Obtiene el historial de movimientos de stock de un producto
 */
router.get(
  '/products/:productId/history',
  requireAnyRole,
  (req, res) => InventoryController.getStockHistory(req as any, res)
);

/**
 * GET /api/inventory/products/:productId/balance
 * Obtiene el balance del libro mayor para un producto
 */
router.get(
  '/products/:productId/balance',
  validateParams(z.object({
    productId: z.string().uuid('ID de producto debe ser un UUID válido'),
  })),
  requireAnyRole,
  (req, res) => InventoryController.getProductBalance(req as any, res)
);

/**
 * POST /api/inventory/products/:productId/reconcile
 * Reconcilia el stock de un producto contra el libro mayor
 */
router.post(
  '/products/:productId/reconcile',
  validateParams(z.object({
    productId: z.string().uuid('ID de producto debe ser un UUID válido'),
  })),
  requireManagerOrAdmin,
  (req, res) => InventoryController.reconcileProduct(req as any, res)
);

/**
 * POST /api/inventory/reconcile
 * Reconcilia todos los productos
 */
router.post(
  '/reconcile',
  requireManagerOrAdmin,
  (req, res) => InventoryController.reconcileAllProducts(req as any, res)
);

// Salud del módulo de inventario
router.get(
  '/health',
  requireAnyRole,
  async (req, res) => {
    try {
      const startTime = Date.now();
      const tables = await sequelize.getQueryInterface().showAllTables();
      const hasLedger = tables.includes('stock_ledger');
      const hasIdempotency = tables.includes('idempotency_records');

      let ledgerCount = 0;
      if (hasLedger) {
        ledgerCount = await StockLedger.count();
      }

      let idempotencyCount = 0;
      if (hasIdempotency) {
        const rows = await sequelize.query('SELECT COUNT(*) as c FROM idempotency_records', { type: QueryTypes.SELECT });
        const first: any = Array.isArray(rows) ? rows[0] : { c: 0 };
        idempotencyCount = Number(first?.c || 0);
      }

      return res.status(200).json({
        success: true,
        message: 'OK',
        data: {
          tables: {
            stock_ledger: hasLedger,
            idempotency_records: hasIdempotency,
          },
          counts: {
            stock_ledger: ledgerCount,
            idempotency_records: idempotencyCount,
          },
          latencyMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error en health de inventario', error: (error as any)?.message || String(error) });
    }
  }
);

// Métricas simples del módulo de inventario
router.get(
  '/metrics',
  requireAnyRole,
  async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const movementsLast30d = await StockLedger.count({ where: { createdAt: { $gte: thirtyDaysAgo } } as any });
      return res.status(200).json({
        success: true,
        data: {
          movementsLast30d,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error obteniendo métricas de inventario', error: (error as any)?.message || String(error) });
    }
  }
);

export default router;
