import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ReportController } from '../controllers/reportController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Aplicar autenticación a todas las rutas de reportes
router.use(authenticateToken);

// Estado de Resultados (P&L)
router.get('/income-statement', ReportController.getIncomeStatement);

// Flujo de Caja
router.get('/cash-flow', ReportController.getCashFlow);

// Reporte de Inventarios
router.get('/inventory', ReportController.getInventoryReport);

// Reporte de Movimientos/Entradas y Salidas
router.get('/movements', ReportController.getMovementsReport);

// Dashboard con métricas principales
router.get('/dashboard', ReportController.getDashboardMetrics);

// Reporte de Ventas por Período
router.get('/sales', ReportController.getSalesReport);

// Reporte de Productos Más Vendidos
router.get('/top-products', ReportController.getTopProductsReport);

// Reporte de Clientes VIP
router.get('/customers', ReportController.getCustomersReport);

// Reportes Fase 5: certificados y garantías
router.get('/certificates/expirations', ReportController.getCertificatesExpirations);
router.get('/warranties/expirations', ReportController.getWarrantiesExpirations);
router.get('/audit/summary', ReportController.getAuditSummary);

// Exportar reporte a CSV
router.get('/export/csv', ReportController.exportToCSV);

// Generar gráfica como PNG
router.post('/chart/png', rateLimit({ windowMs: 60_000, max: 20 }), ReportController.generateChart);

// Exportación unificada (CSV/PDF/Excel)
router.post('/export', rateLimit({ windowMs: 60_000, max: 20 }), ReportController.exportReport);

export default router;
