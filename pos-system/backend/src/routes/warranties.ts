import { Router } from 'express'
import WarrantyController from '../controllers/warrantyController'
import { authenticateToken, requireAnyRole, requireManagerOrAdmin } from '../middleware/auth'

const router = Router()

router.use(authenticateToken)

router.get('/', requireAnyRole, WarrantyController.list)
router.get('/:id', requireAnyRole, WarrantyController.getById)
router.post('/', requireManagerOrAdmin, WarrantyController.create)
router.put('/:id', requireManagerOrAdmin, WarrantyController.update)
router.delete('/:id', requireManagerOrAdmin, WarrantyController.remove)

export default router

