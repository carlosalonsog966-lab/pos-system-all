import { Router } from 'express'
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth'
import { validateBody, validateParams, z } from '../middleware/zodValidation'
import { StockTransferController } from '../controllers/stockTransferController'

const router = Router()

router.use(authenticateToken)

router.post(
  '/request',
  validateBody(z.object({ productId: z.string().uuid(), quantity: z.number().positive(), fromBranchId: z.string().uuid(), toBranchId: z.string().uuid(), reference: z.string().max(200).optional(), idempotencyKey: z.string().max(100).optional() })),
  requireManagerOrAdmin,
  (req, res) => StockTransferController.request(req as any, res)
)

router.get(
  '/',
  requireAnyRole,
  (req, res) => StockTransferController.list(req as any, res)
)

router.post(
  '/:id/ship',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => StockTransferController.ship(req as any, res)
)

router.post(
  '/:id/receive',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => StockTransferController.receive(req as any, res)
)

export default router
