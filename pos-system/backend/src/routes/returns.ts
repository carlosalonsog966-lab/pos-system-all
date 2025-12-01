import { Router } from 'express'
import ReturnController from '../controllers/returnController'
import { authenticateToken } from '../middleware/auth'

const router = Router()
router.use(authenticateToken)

router.post('/sales/:saleId/refund', ReturnController.refundSale)

export default router

