import { Response } from 'express';
import { InventoryService, StockMovement, BulkStockUpdate } from '../services/inventoryService';
import { AuditTrailService } from '../services/AuditTrailService';
import { AuthRequest } from '../middleware/auth';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';
import { validateData, z } from '../middleware/zodValidation';

// Schemas de validación
const stockMovementSchema = z.object({
  productId: z.string().uuid('ID de producto debe ser un UUID válido'),
  type: z.enum(['in', 'out', 'adjustment', 'transfer']),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  reason: z.string().min(1, 'Razón es requerida').max(500, 'Razón muy larga'),
  reference: z.string().optional(),
  notes: z.string().max(1000, 'Notas muy largas').optional(),
});

const bulkStockUpdateSchema = z.object({
  updates: z.array(z.object({
    productId: z.string().uuid('ID de producto debe ser un UUID válido'),
    newStock: z.number().min(0, 'Stock no puede ser negativo'),
    reason: z.string().min(1, 'Razón es requerida').max(500, 'Razón muy larga'),
    notes: z.string().max(1000, 'Notas muy largas').optional(),
  })).min(1, 'Al menos una actualización es requerida').max(100, 'Máximo 100 actualizaciones por lote'),
  idempotencyKey: z.string().optional(),
});

const inventoryReportSchema = z.object({
  // Aceptar cadenas y validar en el controlador para soportar offsets
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Schema para estadísticas: permite periodo o rango de fechas
const inventoryStatsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  // Permitir cadenas opcionales; validación detallada se maneja abajo
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Schema para transferencias de stock entre sucursales
const transferStockSchema = z.object({
  productId: z.string().uuid('ID de producto debe ser un UUID válido'),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  fromBranchId: z.string().uuid('ID de sucursal origen inválido'),
  toBranchId: z.string().uuid('ID de sucursal destino inválido'),
  reason: z.string().min(1).max(500).optional(),
  reference: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Schemas para balance y reconciliación
const productBalanceQuerySchema = z.object({
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
});

const reconcileAllSchema = z.object({
  // Placeholder por si se quiere soportar filtros en el futuro
});

export class InventoryController {
  /**
   * Actualiza el stock de un producto
   */
  static async updateStock(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      // Validar datos de entrada
      const validationResult = await validateData(req.body, stockMovementSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const movementData = validationResult.data;
      const { idempotencyKey } = req.body;

      // Agregar userId al movimiento
      const movement: StockMovement = {
        ...movementData,
        userId,
      };

      // Actualizar stock
      const result = await InventoryService.updateStock(
        movementData.productId,
        movement,
        idempotencyKey
      );

      return res.status(200).json({
        success: true,
        message: 'Stock actualizado exitosamente',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error actualizando stock:', error);

      if (error instanceof Error) {
        if (error.message.includes('Stock insuficiente')) {
          return res.status(409).json({
            success: false,
            message: 'Stock insuficiente',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }

        if (error.message.includes('no encontrado')) {
          return res.status(404).json({
            success: false,
            message: 'Producto no encontrado',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Actualización masiva de stock
   */
  static async bulkUpdateStock(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      // Validar datos de entrada
      const validationResult = await validateData(req.body, bulkStockUpdateSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const { updates, idempotencyKey } = validationResult.data;

      // Ejecutar actualización masiva
      const result = await InventoryService.bulkUpdateStock(
        updates,
        userId,
        idempotencyKey
      );

      return res.status(200).json({
        success: true,
        message: `Actualización masiva completada. ${result.updated} productos actualizados`,
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error en actualización masiva:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene alertas de stock
   */
  static async getStockAlerts(req: AuthRequest, res: Response) {
    try {
      const alerts = await InventoryService.getStockAlerts();

      return res.status(200).json({
        success: true,
        message: 'Alertas de stock obtenidas exitosamente',
        data: {
          alerts,
          summary: {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical').length,
            high: alerts.filter(a => a.severity === 'high').length,
            medium: alerts.filter(a => a.severity === 'medium').length,
            low: alerts.filter(a => a.severity === 'low').length,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error al obtener alertas:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Genera reporte de inventario
   */
  static async generateReport(req: AuthRequest, res: Response) {
    try {
      // Validar parámetros de fecha
      const validationResult = await validateData(req.query, inventoryReportSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const { startDate, endDate } = validationResult.data;
      const format = (req.query.format || '').toString().toLowerCase();
      const dataset = (req.query.dataset || '').toString().toLowerCase() || 'topValueProducts';

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate);
      }

      if (endDate) {
        end = new Date(endDate);
      }

      // Validar rango de fechas
      if (start && end && start > end) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de inicio debe ser anterior a la fecha de fin',
          timestamp: new Date().toISOString(),
        });
      }

      const report = await InventoryService.generateInventoryReport(start, end);

      if (format === 'csv') {
        const now = new Date().toISOString().replace(/[:.]/g, '-');
        let csv = '';
        let filename = `inventory-${dataset}-${now}.csv`;
        let exportedRows = 0;

        if (dataset === 'topvalueproducts') {
          csv += 'productId,productName,stock,unitCost,totalValue\n';
          for (const p of report.topValueProducts) {
            const row = [p.productId, p.productName, p.stock, p.unitCost, p.totalValue]
              .map((v) => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
          exportedRows = report.topValueProducts.length;
        } else if (dataset === 'stockmovements') {
          csv += 'date,movements,totalIn,totalOut\n';
          for (const m of report.stockMovements) {
            const row = [m.date, m.movements, m.totalIn, m.totalOut]
              .map((v) => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
          exportedRows = report.stockMovements.length;
        } else if (dataset === 'summary') {
          csv += 'metric,value\n';
          const summaryRows = [
            ['totalProducts', report.totalProducts],
            ['totalValue', report.totalValue],
            ['lowStockProducts', report.lowStockProducts],
            ['outOfStockProducts', report.outOfStockProducts],
          ];
          for (const [k, v] of summaryRows) {
            csv += `${k},${v}\n`;
          }
          exportedRows = 4;
        } else if (dataset === 'alerts') {
          const alerts = await InventoryService.getStockAlerts();
          csv += 'productId,productCode,productName,currentStock,minStock,alertType,severity\n';
          for (const a of alerts) {
            const row = [
              a.productId,
              a.productCode,
              a.productName,
              a.currentStock,
              a.minStock,
              a.alertType,
              a.severity,
            ]
              .map((v) => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
          exportedRows = alerts.length;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Dataset inválido para exportación CSV. Use topValueProducts, stockMovements, summary o alerts',
            timestamp: new Date().toISOString(),
          });
        }

        // Auditoría de exportación
        try {
          await AuditTrailService.log({
            operation: 'inventory.exportReport',
            entityType: 'inventory',
            actor: { id: req.user?.id, role: req.user?.role },
            result: 'success',
            message: `Exportación CSV de ${dataset}`,
            details: {
              dataset,
              startDate,
              endDate,
              exportedRows,
              filename,
            },
          });
        } catch (e) {
          // No bloquear respuesta si auditoría falla
        }

        const bom = '\uFEFF';
        const body = bom + csv;
        const byteLength = Buffer.byteLength(body, 'utf8');
        const checksum = require('../utils/hash').sha256OfBuffer(Buffer.from(body, 'utf8'));
        const expected = (() => {
          try {
            const svc = require('../services/ExportsIntegrityService');
            const manifest = svc.ExportsIntegrityService.readManifest();
            return manifest.entries.find((e: any) => e.filename === filename)?.sha256 || '';
          } catch { return ''; }
        })();
        applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body, setContentLength: true });
        return res.status(200).send(body);
      }

      return res.status(200).json({
        success: true,
        message: 'Reporte de inventario generado exitosamente',
        data: report,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error al obtener inventario:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene productos con stock bajo
   */
  static async getLowStockProducts(req: AuthRequest, res: Response) {
    try {
      const { limit = 50 } = req.query;

      // Validar límite
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
        return res.status(400).json({
          success: false,
          message: 'Límite inválido (debe estar entre 1 y 200)',
          timestamp: new Date().toISOString(),
        });
      }

      const products = await InventoryService.getLowStockProducts(limitNum);

      return res.status(200).json({
        success: true,
        message: 'Productos con stock bajo obtenidos exitosamente',
        data: {
          products,
          count: products.length,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error obteniendo productos con stock bajo:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene el historial de movimientos de stock de un producto
   */
  static async getStockHistory(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      // Validar UUID del producto
      if (!productId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto inválido',
          timestamp: new Date().toISOString(),
        });
      }

      // Validar paginación
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: 'Número de página inválido',
          timestamp: new Date().toISOString(),
        });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          message: 'Límite inválido (debe estar entre 1 y 100)',
          timestamp: new Date().toISOString(),
        });
      }

      // Fechas opcionales
      let start: Date | undefined;
      let end: Date | undefined;
      if (typeof startDate === 'string') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) start = d;
      }
      if (typeof endDate === 'string') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) end = d;
      }

      const history = await InventoryService.getStockHistory(productId, pageNum, limitNum, start, end);

      return res.status(200).json({
        success: true,
        message: 'Historial de stock obtenido exitosamente',
        data: {
          productId,
          movements: history.movements,
          pagination: history.pagination,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error al actualizar stock:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene el balance de stock derivado del libro mayor para un producto
   */
  static async getProductBalance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado', timestamp: new Date().toISOString() });
      }

      const { productId } = req.params as { productId: string };
      const validationResult = await validateData(req.query, productBalanceQuerySchema);
      if (!validationResult.success) {
        return res.status(400).json({ success: false, message: 'Errores de validación', errors: validationResult.errors, timestamp: new Date().toISOString() });
      }
      const { branchId } = validationResult.data;
      const balance = await InventoryService.computeProductBalance(productId, branchId);
      return res.status(200).json({ success: true, message: 'Balance de producto obtenido', data: { productId, branchId: branchId ?? null, balance }, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Error al obtener balance de producto:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Reconcilia el stock de un producto contra el libro mayor
   */
  static async reconcileProduct(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado', timestamp: new Date().toISOString() });
      }
      const { productId } = req.params as { productId: string };
      const result = await InventoryService.reconcileProductStock(productId, userId);
      return res.status(200).json({ success: true, message: result.updated ? 'Producto reconciliado' : 'Producto ya estaba reconciliado', data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Error al reconciliar producto:', error);
      if (error instanceof Error && /no encontrado/i.test(error.message)) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado', error: error.message, timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Reconcilia todos los productos
   */
  static async reconcileAllProducts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado', timestamp: new Date().toISOString() });
      }
      const validationResult = await validateData(req.body ?? {}, reconcileAllSchema);
      if (!validationResult.success) {
        return res.status(400).json({ success: false, message: 'Errores de validación', errors: validationResult.errors, timestamp: new Date().toISOString() });
      }
      const result = await InventoryService.reconcileAllProducts(userId);
      return res.status(200).json({ success: true, message: 'Reconciliación global ejecutada', data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Error en reconciliación global:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Transfiere stock entre sucursales (solo registra en el libro mayor)
   */
  static async transferStock(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      // Validar datos de entrada
      const validationResult = await validateData(req.body, transferStockSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const { productId, quantity, fromBranchId, toBranchId, reason, reference, idempotencyKey } = validationResult.data;

      const result = await InventoryService.transferStock({
        productId,
        quantity,
        fromBranchId,
        toBranchId,
        reason,
        reference,
        userId,
        idempotencyKey,
      });

      return res.status(200).json({
        success: true,
        message: 'Transferencia registrada exitosamente',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error en transferencia de stock:', error);
      if (error instanceof Error && /no encontrado/i.test(error.message)) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene estadísticas de inventario
   */
  static async getInventoryStats(req: AuthRequest, res: Response) {
    try {
      // Validar query: periodo o rango de fechas
      const validationResult = await validateData(req.query, inventoryStatsQuerySchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const { period, startDate: startStr, endDate: endStr } = validationResult.data;

      let startDate: Date;
      let endDate: Date;

      if (period) {
        // Calcular fechas según período
        endDate = new Date();
        startDate = new Date();
        switch (period) {
          case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
          case '1y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        }
      } else if (startStr || endStr) {
        // Validar rango de fechas explícito: ambos requeridos
        if (!startStr || !endStr) {
          return res.status(400).json({
            success: false,
            message: 'Debe proporcionar startDate y endDate juntos',
            timestamp: new Date().toISOString(),
          });
        }
        startDate = new Date(startStr);
        endDate = new Date(endStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Fechas inválidas en el rango proporcionado',
            timestamp: new Date().toISOString(),
          });
        }

        if (startDate > endDate) {
          return res.status(400).json({
            success: false,
            message: 'El startDate no puede ser mayor que endDate',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Default a 30 días si no hay parámetros
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
      }

      const report = await InventoryService.generateInventoryReport(startDate, endDate);
      const alerts = await InventoryService.getStockAlerts();

      return res.status(200).json({
        success: true,
        message: 'Estadísticas de inventario obtenidas exitosamente',
        data: {
          period: period ?? 'custom',
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          inventory: report,
          alerts: {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical').length,
            high: alerts.filter(a => a.severity === 'high').length,
            medium: alerts.filter(a => a.severity === 'medium').length,
            low: alerts.filter(a => a.severity === 'low').length,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
