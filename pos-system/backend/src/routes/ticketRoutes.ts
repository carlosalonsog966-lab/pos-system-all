import { Router } from 'express';
import { TicketController } from '../controllers/ticketController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Endpoint temporal para probar sin autenticación (DEBE IR ANTES del middleware)
router.get('/test/:saleId', TicketController.generateTicket);
router.post('/test-save/:saleId', TicketController.saveTicket);

// Aplicar middleware de autenticación a las rutas restantes
router.use(authenticateToken);

/**
 * @route GET /api/tickets/generate/:saleId
 * @desc Genera y descarga un ticket PDF para una venta específica
 * @access Private
 */
router.get('/generate/:saleId', TicketController.generateTicket);

/**
 * @route POST /api/tickets/save/:saleId
 * @desc Genera y guarda un ticket PDF en el servidor
 * @access Private
 */
router.post('/save/:saleId', TicketController.saveTicket);

/**
 * @route GET /api/tickets/preview/:saleId
 * @desc Genera un ticket PDF y lo devuelve como base64 para vista previa
 * @access Private
 */
router.get('/preview/:saleId', TicketController.previewTicket);

/**
 * @route GET /api/tickets/list
 * @desc Obtiene la lista de tickets generados
 * @access Private
 */
router.get('/list', TicketController.getTicketsList);

export default router;
