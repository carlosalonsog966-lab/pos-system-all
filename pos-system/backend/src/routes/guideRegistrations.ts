import { Router } from 'express';
import { GuideRegistrationController } from '../controllers/guideRegistrationController';
import { validateBody, validateQuery } from '../middleware/validation';
import { authenticateToken, requireAnyRole, requireManagerOrAdmin } from '../middleware/auth';
import { 
  createGuideRegistrationSchema, 
  updateGuideRegistrationSchema, 
  guideRegistrationQuerySchema,
  guideStatsQuerySchema 
} from '../schemas/guideRegistration';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de consulta
router.get('/', requireAnyRole, validateQuery(guideRegistrationQuerySchema), GuideRegistrationController.getRegistrations);
router.get('/:id', requireAnyRole, GuideRegistrationController.getRegistrationById);

// Rutas de estadísticas
router.get('/guide/:id/stats', requireAnyRole, validateQuery(guideStatsQuerySchema), GuideRegistrationController.getGuideStats);
router.get('/guide/:id/closure', requireAnyRole, validateQuery(guideStatsQuerySchema), GuideRegistrationController.getClosurePercentage);

// Rutas de creación y modificación
router.post('/', requireAnyRole, validateBody(createGuideRegistrationSchema), GuideRegistrationController.createRegistration);
router.put('/:id', requireAnyRole, validateBody(updateGuideRegistrationSchema), GuideRegistrationController.updateRegistration);
router.delete('/:id', requireManagerOrAdmin, GuideRegistrationController.deleteRegistration);

export default router;