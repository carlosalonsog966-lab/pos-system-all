import { Router } from 'express'
import ProductAssetController from '../controllers/productAssetController'

const router = Router()

router.get('/', ProductAssetController.list)
router.get('/:id', ProductAssetController.getById)
router.post('/', ProductAssetController.create)
router.put('/:id', ProductAssetController.update)
router.delete('/:id', ProductAssetController.remove)

export default router

