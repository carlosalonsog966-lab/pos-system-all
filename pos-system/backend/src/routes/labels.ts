import { Router } from 'express'
import LabelController from '../controllers/labelController'
import { authenticateToken, requireManagerOrAdmin } from '../middleware/auth'

const router = Router()

router.use(authenticateToken)

router.post('/product-assets/:id/vitrine', requireManagerOrAdmin, LabelController.generateVitrineLabelForAsset)

export default router

