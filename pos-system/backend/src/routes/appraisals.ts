import { Router } from 'express'
import AppraisalController from '../controllers/appraisalController'
import { authenticateToken, requireAnyRole, requireManagerOrAdmin } from '../middleware/auth'

const router = Router()

router.use(authenticateToken)

router.get('/', requireAnyRole, AppraisalController.list)
router.get('/:id', requireAnyRole, AppraisalController.getById)
router.post('/', requireManagerOrAdmin, AppraisalController.create)
router.put('/:id', requireManagerOrAdmin, AppraisalController.update)
router.delete('/:id', requireManagerOrAdmin, AppraisalController.remove)

export default router

