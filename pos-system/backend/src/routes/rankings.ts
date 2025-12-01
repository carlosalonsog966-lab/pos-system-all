import { Router } from 'express';
import { RankingController } from '../controllers/rankingController';
import { validateQuery } from '../middleware/validation';
import { authenticateToken, requireAnyRole } from '../middleware/auth';
import { 
  weeklyRankingQuerySchema,
  monthlyRankingQuerySchema,
  customRankingQuerySchema,
  performanceQuerySchema,
  productPerformanceQuerySchema
} from '../schemas/ranking';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de rankings generales
router.get('/weekly', requireAnyRole, validateQuery(weeklyRankingQuerySchema), RankingController.getWeeklyRankings);
router.get('/monthly', requireAnyRole, validateQuery(monthlyRankingQuerySchema), RankingController.getMonthlyRankings);
router.get('/custom', requireAnyRole, validateQuery(customRankingQuerySchema), RankingController.getCustomRankings);

// Rutas de rendimiento individual
router.get('/guide/:id/performance', requireAnyRole, validateQuery(performanceQuerySchema), RankingController.getGuidePerformance);
router.get('/employee/:id/performance', requireAnyRole, validateQuery(performanceQuerySchema), RankingController.getEmployeePerformance);

// Rutas de rendimiento por categoría
router.get('/products/performance', requireAnyRole, validateQuery(productPerformanceQuerySchema), RankingController.getProductPerformance);
router.get('/agencies/performance', requireAnyRole, validateQuery(performanceQuerySchema), RankingController.getAgencyPerformance);

export default router;