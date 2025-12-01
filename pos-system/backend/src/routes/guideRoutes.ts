import { Router } from 'express';
import { GuideController } from '../controllers/guideController';

const router = Router();

// Obtener todos los guías
router.get('/', GuideController.getAllGuides);

// Obtener guía por ID
router.get('/:id', GuideController.getGuideById);

// Crear nuevo guía
router.post('/', GuideController.createGuide);

// Actualizar guía
router.put('/:id', GuideController.updateGuide);

// Eliminar guía (soft delete)
router.delete('/:id', GuideController.deleteGuide);

// Registrar personas del día para un guía
router.post('/:id/daily-people', GuideController.registerDailyPeople);

// Obtener reportes diarios de un guía
router.get('/:id/daily-reports', GuideController.getDailyReports);

// Obtener estadísticas del guía
router.get('/:id/stats', GuideController.getGuideStats);

export default router;