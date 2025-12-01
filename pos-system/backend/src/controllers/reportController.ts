import { Request, Response } from 'express';
import { ReportService } from '../services/reportService';
import { AuditTrailService } from '../services/AuditTrailService';
import { FileManagerService } from '../services/FileManagerService';
import { Op } from 'sequelize';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export class ReportController {
  // Estado de Resultados (P&L)
  static async getIncomeStatement(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await ReportService.generateIncomeStatement(start, end);
      
      res.json({
        success: true,
        data: report,
        message: 'Estado de resultados generado exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar estado de resultados',
      });
    }
  }

  // Reporte de expiración de certificaciones
  static async getCertificatesExpirations(req: Request, res: Response) {
    try {
      const withinDays = req.query.withinDays ? Number(req.query.withinDays) : undefined;
      const report = await ReportService.generateCertificatesExpirationsReport({ withinDays });
      res.json({ success: true, data: report, message: 'Reporte de vencimiento de certificaciones generado' });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error en reporte de certificaciones' });
    }
  }

  // Reporte de expiración de garantías
  static async getWarrantiesExpirations(req: Request, res: Response) {
    try {
      const withinDays = req.query.withinDays ? Number(req.query.withinDays) : undefined;
      const report = await ReportService.generateWarrantiesExpirationsReport({ withinDays });
      res.json({ success: true, data: report, message: 'Reporte de vencimiento de garantías generado' });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error en reporte de garantías' });
    }
  }

  // Resumen de auditoría bajo /reports
  static async getAuditSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const report = await ReportService.generateAuditSummary({ startDate: startDate as string, endDate: endDate as string });
      res.json({ success: true, data: report, message: 'Resumen de auditoría generado' });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error en resumen de auditoría' });
    }
  }

  // Exportación unificada (CSV/PDF/Excel)
  static async exportReport(req: Request, res: Response) {
    try {
      const format = String((req.body?.format ?? req.query?.format ?? 'csv')).toLowerCase();
      const data = req.body?.data ?? {};
      const filters = data?.filters ?? {};
      const reportType = String(filters?.reportType ?? req.query?.reportType ?? 'sales');

      if (format === 'csv') {
        // Derivar parámetros desde filtros
        const startDate = filters?.dateRange?.startDate || (req.query?.startDate as string) || undefined;
        const endDate = filters?.dateRange?.endDate || (req.query?.endDate as string) || undefined;
        const groupBy = (filters?.groupBy as any) || (req.query?.groupBy as any) || 'day';
        const dataset = String((filters?.dataset ?? req.query?.dataset ?? (reportType === 'sales' ? 'byperiod' : 'summary'))).toLowerCase();

        const csvData = await ReportService.exportReportToCSV(reportType, {
          startDate,
          endDate,
          groupBy,
          dataset,
          paymentMethod: filters?.paymentMethod,
          branchId: filters?.branchId,
        });

        // Auditoría de exportación CSV
        try {
          const actorId = (req as any)?.user?.id;
          const actorRole = (req as any)?.user?.role;
          const exportedRows = (csvData.match(/\n/g) || []).length - 1;
          const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

          await AuditTrailService.log({
            operation: `report.export.${reportType}`,
            entityType: 'report',
            actor: { id: actorId, role: actorRole },
            result: 'success',
            message: `Exportación CSV de ${reportType}`,
            details: { reportType, startDate, endDate, groupBy, dataset, exportedRows, filename },
          });
        } catch {}

        // Añadir BOM para Excel y enviar como Buffer UTF-8
        const bom = '\ufeff';
        const payload = bom + csvData;
        const buf = Buffer.from(payload, 'utf8');
        const checksum = sha256OfBuffer(buf);
        const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
        const manifest = ExportsIntegrityService.readManifest();
        const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
        const match = expected ? (expected === checksum ? 'true' : 'false') : '';

        applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body: buf, setContentLength: true });
        res.send(buf);
        return;
      }

      if (format === 'excel') {
        const startDate = filters?.dateRange?.startDate || (req.query?.startDate as string) || undefined;
        const endDate = filters?.dateRange?.endDate || (req.query?.endDate as string) || undefined;
        const groupBy = (filters?.groupBy as any) || (req.query?.groupBy as any) || 'day';
        const dataset = String((filters?.dataset ?? req.query?.dataset ?? (reportType === 'sales' ? 'byperiod' : 'summary'))).toLowerCase();

        const csvData = await ReportService.exportReportToCSV(reportType, {
          startDate,
          endDate,
          groupBy,
          dataset,
          paymentMethod: filters?.paymentMethod,
          branchId: filters?.branchId,
        });

        // Auditoría de exportación Excel (basado en CSV)
        try {
          const actorId = (req as any)?.user?.id;
          const actorRole = (req as any)?.user?.role;
          const exportedRows = (csvData.match(/\n/g) || []).length - 1;
          const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.xls`;

          await AuditTrailService.log({
            operation: `report.export.${reportType}`,
            entityType: 'report',
            actor: { id: actorId, role: actorRole },
            result: 'success',
            message: `Exportación Excel de ${reportType}`,
            details: { reportType, startDate, endDate, groupBy, dataset, exportedRows, filename },
          });
        } catch {}

        const bom = '\ufeff';
        const payload = bom + csvData;
        const buf = Buffer.from(payload, 'utf8');
        const checksum = sha256OfBuffer(buf);
        const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.xls`;
        const manifest = ExportsIntegrityService.readManifest();
        const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
        const match = expected ? (expected === checksum ? 'true' : 'false') : '';

        applyIntegrityHeaders(res, { filename, contentType: 'application/vnd.ms-excel; charset=utf-8', body: buf, setContentLength: true });
        res.send(buf);
        return;
      }

      if (format === 'pdf') {
        const startDate = filters?.dateRange?.startDate || (req.query?.startDate as string) || undefined;
        const endDate = filters?.dateRange?.endDate || (req.query?.endDate as string) || undefined;
        const groupBy = (filters?.groupBy as any) || (req.query?.groupBy as any) || 'day';

        const pdfBuffer = await ReportService.exportReportToPDF(reportType, {
          dateRange: { startDate, endDate },
          groupBy,
          branchId: filters?.branchId,
          paymentMethod: filters?.paymentMethod,
          landscape: reportType === 'dashboard',
          frontendUrl: (req.body?.frontendUrl as string) || undefined,
        });
        const pdfChecksum = sha256OfBuffer(pdfBuffer);
        const filenamePdf = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        const manifestPdf = ExportsIntegrityService.readManifest();
        const expectedPdf = manifestPdf.entries.find(e => e.filename === filenamePdf)?.sha256 || '';
        const matchPdf = expectedPdf ? (expectedPdf === pdfChecksum ? 'true' : 'false') : '';

        // Auditoría de exportación PDF
        try {
          const actorId = (req as any)?.user?.id;
          const actorRole = (req as any)?.user?.role;
          const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
          await AuditTrailService.log({
            operation: `report.export.${reportType}`,
            entityType: 'report',
            actor: { id: actorId, role: actorRole },
            result: 'success',
            message: `Exportación PDF de ${reportType}`,
            details: { reportType, startDate, endDate, groupBy, filename },
          });
        } catch {}

        applyIntegrityHeaders(res, { filename: filenamePdf, contentType: 'application/pdf', body: pdfBuffer });
        res.send(pdfBuffer);
        return;
      }

      // Placeholder para PDF/Excel (iteración siguiente)
      res.status(501).json({ success: false, error: 'Formato no soportado aún. Use csv.' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al exportar reporte',
      });
    }
  }

  // Flujo de Caja
  static async getCashFlow(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await ReportService.generateCashFlow(start, end);
      
      res.json({
        success: true,
        data: report,
        message: 'Flujo de caja generado exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar flujo de caja',
      });
    }
  }

  // Reporte de Inventarios
  static async getInventoryReport(req: Request, res: Response) {
    try {
      const { category, lowStock } = req.query;
      
      const report = await ReportService.generateInventoryReport({
        category: category as string,
        lowStockOnly: lowStock === 'true',
      });
      
      res.json({
        success: true,
        data: report,
        message: 'Reporte de inventarios generado exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: { summary: { totalJewelry: 0, totalValue: 0, lowStockItems: 0, categories: {} }, products: [] }, message: 'Reporte de inventario por defecto (sin datos)' });
    }
  }

  // Reporte de Entradas y Salidas
  static async getMovementsReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, type } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await ReportService.generateMovementsReport(start, end, type as string);
      
      res.json({
        success: true,
        data: report,
        message: 'Reporte de movimientos generado exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: { period: { start: null, end: null }, data: [], summary: { total: 0 } }, message: 'Reporte de movimientos por defecto (sin datos)' });
    }
  }

  // Dashboard con métricas principales
  static async getDashboardMetrics(req: Request, res: Response) {
    try {
      const { period } = req.query;
      // Limitar tiempo de espera para evitar timeouts en el frontend
      const timeoutMs = 5000;
      const safeDefaults = {
        sales: { today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0, growth: { daily: 0, monthly: 0 } },
        inventory: { totalJewelry: 0, lowStockItems: 0, totalValue: 0 },
        customers: { total: 0, newThisMonth: 0, topCustomers: [] },
        recentSales: [],
        salesData: [],
        revenueData: [],
        hourlyData: [],
        paymentMethodData: [],
        topProducts: [],
      } as any;
      const metrics = await Promise.race([
        ReportService.generateDashboardMetrics(period as string),
        new Promise<any>((resolve) => setTimeout(() => resolve(safeDefaults), timeoutMs))
      ]);
      // Exportar métricas a carpeta local (C:\ProgramData\SistemaPOS\EXPORTACIONES\REPORTES)
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `dashboard_metrics_${timestamp}.json`;
        await FileManagerService.exportData(metrics, fileName, 'reports');
      } catch (exportError) {
        // No bloquear la respuesta si falla la exportación; solo registrar
        console.error('Error exportando métricas del dashboard:', exportError);
      }
      
      res.json({
        success: true,
        data: metrics,
        message: 'Métricas del dashboard generadas exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: safeDefaults, message: 'Métricas por defecto (sin datos)' });
    }
  }

  // Reporte de Ventas por Período
  static async getSalesReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, groupBy, paymentMethod, branchId } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await ReportService.generateSalesReport({
        startDate: start,
        endDate: end,
        groupBy: groupBy as 'day' | 'week' | 'month',
        paymentMethod: paymentMethod as string,
        branchId: branchId as string,
      });
      
      res.json({
        success: true,
        data: report,
        message: 'Reporte de ventas generado exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: { period: { start: null, end: null }, groupBy: 'day', data: [], summary: { totalSales: 0, salesCount: 0, averageTicket: 0 } }, message: 'Reporte de ventas por defecto (sin datos)' });
    }
  }

  // Reporte de Productos Más Vendidos
  static async getTopProductsReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, limit } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      const limitNum = limit ? parseInt(limit as string) : 10;
      
      const report = await ReportService.generateTopProductsReport(start, end, limitNum);
      
      res.json({
        success: true,
        data: report,
        message: 'Reporte de productos más vendidos generado exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: [], message: 'Reporte de productos por defecto (sin datos)' });
    }
  }

  // Reporte de Clientes VIP
  static async getCustomersReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, minPurchases } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      const minPurchasesNum = minPurchases ? parseInt(minPurchases as string) : 1;
      
      const report = await ReportService.generateCustomersReport(start, end, minPurchasesNum);
      
      res.json({
        success: true,
        data: report,
        message: 'Reporte de clientes generado exitosamente',
      });
    } catch (error) {
      res.json({ success: true, data: { period: { start: null, end: null }, data: [], summary: { total: 0 } }, message: 'Reporte de clientes por defecto (sin datos)' });
    }
  }

  // Exportar reporte a CSV
  static async exportToCSV(req: Request, res: Response) {
    try {
      const { reportType, ...params } = req.query;
      
      const csvData = await ReportService.exportReportToCSV(reportType as string, params);
      const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

      // Auditoría para exportaciones CSV de reportes (en particular ventas)
      try {
        const actorId = (req as any)?.user?.id;
        const actorRole = (req as any)?.user?.role;
        const dataset = (params as any)?.dataset;
        const startDate = (params as any)?.startDate;
        const endDate = (params as any)?.endDate;
        const exportedRows = (csvData.match(/\n/g) || []).length - 1; // líneas menos cabecera

        await AuditTrailService.log({
          operation: `report.export.${reportType}`,
          entityType: 'report',
          actor: { id: actorId, role: actorRole },
          result: 'success',
          message: `Exportación CSV de ${reportType}`,
          details: {
            reportType,
            dataset,
            startDate,
            endDate,
            exportedRows,
            filename,
          },
        });
      } catch (auditError) {
        // No bloquear respuesta si auditoría falla
      }

      // Añadir BOM para compatibilidad con Excel y enviar como Buffer con UTF-8
      const bom = '\ufeff';
      const payload = bom + csvData;
      const buf = Buffer.from(payload, 'utf8');
      const checksumCsv = sha256OfBuffer(buf);
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, {
        filename,
        contentType: 'text/csv; charset=utf-8',
        body: buf,
        checksum: checksumCsv,
        expected,
        setContentLength: true,
      });
      res.send(buf);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al exportar reporte',
      });
    }
  }

  // Generar gráfica como PNG
  static async generateChart(req: Request, res: Response) {
    try {
      const { chartType, ...params } = req.body;
      
      const chartBuffer = await ReportService.generateChartPNG(chartType as string, params);
      
      const filename = `${String(chartType)}_${Date.now()}.png`;
      const checksum = sha256OfBuffer(chartBuffer);
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      const match = expected ? (expected === checksum ? 'true' : 'false') : '';

      applyIntegrityHeaders(res, { filename, contentType: 'image/png', body: chartBuffer });
      res.send(chartBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar gráfica',
      });
    }
  }
}
