import { Router } from 'express'
import CertificationController from '../controllers/certificationController'
import { authenticateToken, requireAnyRole, requireManagerOrAdmin } from '../middleware/auth'

const router = Router()

router.use(authenticateToken)

router.get('/', requireAnyRole, CertificationController.list)
router.get('/:id', requireAnyRole, CertificationController.getById)
router.post('/', requireManagerOrAdmin, CertificationController.create)
router.put('/:id', requireManagerOrAdmin, CertificationController.update)
router.delete('/:id', requireManagerOrAdmin, CertificationController.remove)

export default router

