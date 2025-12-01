import { Router } from 'express'
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth'
import { validateBody, validateParams, z } from '../middleware/zodValidation'
import { RfidController } from '../controllers/rfidController'

const router = Router()

router.use(authenticateToken)

router.post(
  '/ingest',
  validateBody(z.object({ epcs: z.array(z.string().min(1)).min(1) })),
  requireAnyRole,
  (req, res) => RfidController.ingest(req as any, res)
)

router.post(
  '/assign/:assetId',
  validateParams(z.object({ assetId: z.string().uuid() })),
  validateBody(z.object({ epc: z.string().min(1) })),
  requireManagerOrAdmin,
  (req, res) => RfidController.assign(req as any, res)
)

export default router
