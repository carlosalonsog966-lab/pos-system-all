import { Router } from 'express';
import { CashRegisterController } from '../controllers/cashRegisterController';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateToken, requireAnyRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

console.log('=== CASH REGISTER ROUTES LOADED ===');

// Middleware de debug
router.use((req, res, next) => {
  console.log('=== CASH REGISTER ROUTE MIDDLEWARE DEBUG ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Esquemas de validación
const openCashRegisterSchema = z.object({
  openingAmount: z.number().min(0, 'El monto de apertura debe ser mayor o igual a 0'),
});

const closeCashRegisterSchema = z.object({
  closingAmount: z.number().min(0, 'El monto de cierre debe ser mayor o igual a 0'),
  notes: z.string().optional(),
});

const cashMovementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  reason: z.string().min(1, 'La razón es requerida'),
  description: z.string().optional(),
});

const denominationCountSchema = z.object({
  denominations: z.record(z.string(), z.number()).refine((obj) => Object.keys(obj).length > 0, 'Debe incluir al menos una denominación'),
  notes: z.string().optional(),
});

const uuidSchema = z.object({
  sessionId: z.string().uuid('ID de sesión inválido'),
});

// Query params para listado de conteos
const countsQuerySchema = z.object({
  page: z.string().transform((v) => parseInt(v, 10)).optional(),
  pageSize: z.string().transform((v) => parseInt(v, 10)).optional(),
  from: z.string().transform((str) => new Date(str)).optional(),
  to: z.string().transform((str) => new Date(str)).optional(),
  userId: z.string().uuid().optional(),
});

// Query params para listado de sesiones
const sessionsQuerySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  from: z.string().transform((str) => new Date(str)).optional(),
  to: z.string().transform((str) => new Date(str)).optional(),
  userId: z.string().uuid().optional(),
});

// Rutas de consulta
router.get('/current', requireAnyRole, CashRegisterController.getCurrentSession);
router.get('/transactions/today', requireAnyRole, CashRegisterController.getTodayTransactions);
router.get('/stats/:sessionId', requireAnyRole, validateParams(uuidSchema), CashRegisterController.getSessionStats);
router.get('/denomination-counts/:sessionId', requireAnyRole, validateParams(uuidSchema), validateQuery(countsQuerySchema), CashRegisterController.listDenominationCounts);
router.get('/denomination-counts/:sessionId/export', requireAnyRole, validateParams(uuidSchema), validateQuery(countsQuerySchema), CashRegisterController.exportDenominationCounts);

// Listado de sesiones de caja
router.get('/sessions', requireAnyRole, validateQuery(sessionsQuerySchema), CashRegisterController.listSessions);

// Rutas de operaciones
router.post('/open', requireAnyRole, validateBody(openCashRegisterSchema), CashRegisterController.openCashRegister);
router.post('/close/:sessionId', requireAnyRole, validateParams(uuidSchema), validateBody(closeCashRegisterSchema), CashRegisterController.closeCashRegister);
router.post('/cash-movement', requireAnyRole, validateBody(cashMovementSchema), CashRegisterController.addCashMovement);
router.post('/denomination-count', requireAnyRole, validateBody(denominationCountSchema), CashRegisterController.recordDenominationCount);

export default router;
