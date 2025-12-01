import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  captureChart,
  captureAllCharts,
  downloadChart,
  listCharts,
  deleteChart,
  cleanupOldCharts
} from '../controllers/chartCaptureController';

const router = Router();

/**
 * @route POST /api/charts/capture
 * @desc Capturar una gráfica específica
 * @body {
 *   chartType: 'dashboard' | 'sales' | 'inventory' | 'financial',
 *   selector?: string,
 *   width?: number,
 *   height?: number,
 *   dateRange?: { startDate: string, endDate: string }
 * }
 */
router.post('/capture', rateLimit({ windowMs: 60_000, max: 15 }), captureChart);

/**
 * @route POST /api/charts/capture-all
 * @desc Capturar todas las gráficas
 * @body {
 *   dateRange?: { startDate: string, endDate: string }
 * }
 */
router.post('/capture-all', rateLimit({ windowMs: 60_000, max: 10 }), captureAllCharts);

/**
 * @route GET /api/charts/download/:filename
 * @desc Descargar una gráfica capturada
 * @param filename - Nombre del archivo PNG
 */
router.get('/download/:filename', downloadChart);

/**
 * @route GET /api/charts/list
 * @desc Listar todas las gráficas disponibles
 */
router.get('/list', listCharts);

/**
 * @route DELETE /api/charts/:filename
 * @desc Eliminar una gráfica específica
 * @param filename - Nombre del archivo PNG
 */
router.delete('/:filename', deleteChart);

/**
 * @route POST /api/charts/cleanup
 * @desc Limpiar gráficas antiguas
 * @query days - Número de días (por defecto 7)
 */
router.post('/cleanup', rateLimit({ windowMs: 60_000, max: 6 }), cleanupOldCharts);

export default router;
