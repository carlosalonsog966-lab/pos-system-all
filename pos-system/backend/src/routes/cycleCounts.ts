import { Router } from 'express'
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth'
import { validateBody, validateParams, z } from '../middleware/zodValidation'
import { CycleCountController } from '../controllers/cycleCountController'

const router = Router()

router.use(authenticateToken)

router.post(
  '/',
  validateBody(z.object({ branchId: z.string().uuid().optional(), type: z.enum(['cyclic', 'general']), tolerancePct: z.number().min(0).max(100).optional(), note: z.string().max(1000).optional() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.create(req as any, res)
)

router.get(
  '/',
  requireAnyRole,
  (req, res) => CycleCountController.list(req as any, res)
)

router.get(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  requireAnyRole,
  (req, res) => CycleCountController.get(req as any, res)
)

router.post(
  '/:id/start',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.start(req as any, res)
)

router.post(
  '/:id/complete',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.complete(req as any, res)
)

router.post(
  '/:id/preload',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.preloadItems(req as any, res)
)

router.post(
  '/:id/items/:itemId/count',
  validateParams(z.object({ id: z.string().uuid(), itemId: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.setItemCount(req as any, res)
)

router.post(
  '/:id/apply-adjustments',
  validateParams(z.object({ id: z.string().uuid() })),
  requireManagerOrAdmin,
  (req, res) => CycleCountController.applyAdjustments(req as any, res)
)

export default router
