import { Router } from 'express';
import { IntegrityController } from '../controllers/integrityController';
import { authenticateToken, requireAnyRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/summary', requireAnyRole, IntegrityController.summary);
router.post('/verify', requireAnyRole, IntegrityController.verify);

export default router;
