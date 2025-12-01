import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';
import { validateRequest, validateBody, validateQuery, z } from '../middleware/zodValidation';
import { authenticateToken } from '../middleware/auth';
import { checkoutSchema, stockValidationSchema } from '../schemas/checkout';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * POST /api/checkout/process
 * Procesa un checkout completo
 */
router.post(
  '/process',
  validateBody(checkoutSchema),
  CheckoutController.processCheckout
);

/**
 * POST /api/checkout/validate-stock
 * Valida disponibilidad de stock antes del checkout
 */
router.post(
  '/validate-stock',
  validateBody(stockValidationSchema),
  CheckoutController.validateStock
);

/**
 * POST /api/checkout/reserve-stock
 * Reserva stock para una venta pendiente
 */
router.post(
  '/reserve-stock',
  validateBody(z.object({
    items: z.array(z.object({
      productId: z.string().uuid('ID de producto debe ser un UUID válido'),
      quantity: z.number().int().positive('Cantidad debe ser un entero positivo'),
    })).min(1, 'Al menos un item es requerido'),
    reservationId: z.string().min(1, 'ID de reservación requerido'),
    expirationMinutes: z.number().int().min(1).max(120).default(30),
  })),
  CheckoutController.reserveStock
);

/**
 * POST /api/checkout/calculate-total
 * Calcula el total de un checkout sin procesarlo
 */
router.post(
  '/calculate-total',
  validateBody(z.object({
    items: z.array(z.object({
      productId: z.string().uuid('ID de producto debe ser un UUID válido'),
      quantity: z.number().int().positive('Cantidad debe ser un entero positivo'),
      unitPrice: z.number().positive('Precio unitario debe ser positivo'),
      discountAmount: z.number().min(0).default(0),
    })).min(1, 'Al menos un item es requerido'),
    discountAmount: z.number().min(0).default(0),
    discountPercentage: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(1).default(0.19),
  })),
  CheckoutController.calculateTotal
);

/**
 * GET /api/checkout/stats
 * Obtiene estadísticas de checkout
 */
router.get(
  '/stats',
  validateQuery(z.object({
    startDate: z.string().datetime('Fecha de inicio inválida').optional(),
    endDate: z.string().datetime('Fecha de fin inválida').optional(),
  })),
  CheckoutController.getCheckoutStats
);

/**
 * GET /api/checkout/history
 * Obtiene el historial de checkouts del usuario
 */
router.get(
  '/history',
  validateQuery(z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    startDate: z.string().datetime('Fecha de inicio inválida').optional(),
    endDate: z.string().datetime('Fecha de fin inválida').optional(),
  })),
  CheckoutController.getCheckoutHistory
);

export default router;