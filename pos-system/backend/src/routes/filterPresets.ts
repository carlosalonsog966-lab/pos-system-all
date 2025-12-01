import { Router } from 'express';
import { authenticateToken, requireAnyRole } from '../middleware/auth';
import { FilterPresetController } from '../controllers/filterPresetController';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Listar presets (globales + del usuario)
router.get('/', requireAnyRole, FilterPresetController.list);

// Obtener preset por defecto (prioriza usuario, luego global)
router.get('/default', requireAnyRole, FilterPresetController.getDefault);

// Crear nuevo preset
router.post('/', requireAnyRole, FilterPresetController.create);

// Actualizar preset
router.put('/:id', requireAnyRole, FilterPresetController.update);

// Eliminar preset
router.delete('/:id', requireAnyRole, FilterPresetController.remove);

export default router;

