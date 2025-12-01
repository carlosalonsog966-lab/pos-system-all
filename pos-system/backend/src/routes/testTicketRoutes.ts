import { Router } from 'express';
import { TicketController } from '../controllers/ticketController';

const router = Router();

// Ruta de prueba sin autenticación
router.get('/:saleId', TicketController.generateTicket);

export default router;