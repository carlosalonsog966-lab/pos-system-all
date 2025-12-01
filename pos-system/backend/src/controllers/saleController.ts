import { Request, Response } from 'express';
import { SaleService } from '../services/saleService';
import { AuthRequest } from '../middleware/auth';
import { CreateSaleInput, UpdateSaleInput, SaleQueryInput } from '../schemas/sale';
import { sequelize } from '../db/config';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { ReportService } from '../services/reportService';
import { AuditTrailService } from '../services/AuditTrailService';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export class SaleController {
  static async createSale(req: AuthRequest, res: Response) {
    console.log('🚀 CONTROLLER REACHED - createSale method called');
    try {
      console.log('🔍 SaleController.createSale - req.user:', req.user);
      const data: CreateSaleInput = req.body;
      
      if (!req.user) {
        console.log('❌ req.user is undefined or null');
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }
      
      const userId = req.user.id;
      console.log('✅ userId:', userId);
      const idempotencyKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key') || undefined;
      const result = await SaleService.createSale(userId, data, idempotencyKey);
      
      res.status(201).json({
        success: true,
        message: 'Venta creada exitosamente',
        data: result.sale, meta: { ticketJobId: result.ticketJobId },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al crear venta',
      });
    }
  }

  static async getSales(req: Request, res: Response) {
    try {
      const query: SaleQueryInput = req.query;
      const result = await SaleService.getSales(query);
      
      res.json({ success: true,
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (error) {
      res.json({ success: true, data: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } });
    }
  }

  static async getSaleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await SaleService.getSaleById(id);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Venta no encontrada',
      });
    }
  }

  static async updateSale(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateSaleInput = req.body;
      const result = await SaleService.updateSale(id, data);
      
      res.json({ success: true,
        message: 'Venta actualizada exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar venta',
      });
    }
  }

  static async cancelSale(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const result = await SaleService.cancelSale(id, userId);
      
      res.json({ success: true,
        message: 'Venta cancelada exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al cancelar venta',
      });
    }
  }

  static async getSalesStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const result = await SaleService.getSalesStats(start, end);
      
      res.json({ success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estadísticas de ventas',
      });
    }
  }

  static async getSalesByGuide(req: Request, res: Response) {
    try {
      const { id: guideId } = req.params;
      const query = { ...req.query, guideId, saleType: 'GUIDE' as const };
      const result = await SaleService.getSales(query);
      
      res.json({ success: true,
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener ventas del guía',
      });
    }
  }

  static async getSalesByEmployee(req: Request, res: Response) {
    try {
      const { id: employeeId } = req.params;
      const query = { ...req.query, employeeId };
      const result = await SaleService.getSales(query);
      
      res.json({
        success: true,
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener ventas del empleado',
      });
    }
  }

  static async getSalesByAgency(req: Request, res: Response) {
    try {
      const { id: agencyId } = req.params;
      const query = { ...req.query, agencyId, saleType: 'GUIDE' as const };
      const result = await SaleService.getSales(query);
      
      res.json({
        success: true,
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener ventas de la agencia',
      });
    }
  }

  static async getTourismStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const result = await SaleService.getTourismStats(start, end);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estadísticas de turismo',
      });
    }
  }

  // Salud básica del módulo de ventas
  static async getSalesHealth(req: Request, res: Response) {
    const start = Date.now();
    try {
      await sequelize.query('SELECT 1');
      const dbLatencyMs = Date.now() - start;

      const salesCount = await Sale.count();
      const saleItemsCount = await SaleItem.count();

      return res.json({
        success: true,
        status: 'ok',
        dbLatencyMs,
        salesCount,
        saleItemsCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Fallo de salud de ventas',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Métricas de ventas (últimos N días)
  static async getSalesMetrics(req: Request, res: Response) {
    try {
      const daysParam = (req.query.days as string) || '30';
      const days = Math.max(1, Math.min(365, parseInt(daysParam, 10) || 30));

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days + 1);

      const report = await SaleService.getSalesStats(startDate, endDate);

      // Resumen rápido derivado
      const general: any = report?.general || {};
      const totalRevenue = (general.totalRevenue as number) ?? 0;
      const totalSalesCount = (general.totalSales as number) ?? 0;
      const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

      return res.json({
        success: true,
        period: { start: startDate, end: endDate },
        summary: {
          totalRevenue,
          totalSalesCount,
          averageTicket,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener métricas de ventas',
      });
    }
  }

  // Exportar CSV de ventas (wrapper dedicado en /api/sales/export/csv)
  static async exportSalesCSV(req: Request, res: Response) {
    try {
      const params = req.query;
      const csvData = await ReportService.exportReportToCSV('sales', params);
      const filename = `sales_${new Date().toISOString().split('T')[0]}.csv`;

      // Auditoría de exportación específica de ventas
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        const dataset = (params as any)?.dataset;
        const startDate = (params as any)?.startDate;
        const endDate = (params as any)?.endDate;
        const exportedRows = (csvData.match(/\n/g) || []).length - 1; // líneas menos cabecera

        await AuditTrailService.log({
          operation: 'sales.export.csv',
          entityType: 'sale',
          actor: { id: actorId, role: actorRole },
          result: 'success',
          message: `Exportación CSV de ventas (${dataset || 'byPeriod'})`,
          details: { dataset, startDate, endDate, exportedRows, filename },
        });
      } catch (_) {
        // No bloquear si falla la auditoría
      }

      const bom = '\uFEFF';
      const body = bom + csvData;
      applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body, setContentLength: true });
      return res.send(body);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al exportar CSV de ventas',
      });
    }
  }

  static async refundSale(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const correlationId = (req as any).correlationId;
      const idempotencyKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key') || undefined;
      const result = await SaleService.refundSale(id, userId, correlationId, idempotencyKey);
      res.json({ success: true,
        message: 'Venta reembolsada exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al reembolsar venta',
      });
    }
  }
}
