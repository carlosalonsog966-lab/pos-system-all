import { Router } from 'express';
import { AgencyController } from '../controllers/agencyController';

const router = Router();

// Obtener todas las agencias
router.get('/', AgencyController.getAllAgencies);

// Obtener agencia por ID
router.get('/:id', AgencyController.getAgencyById);

// Crear nueva agencia
router.post('/', AgencyController.createAgency);

// Actualizar agencia
router.put('/:id', AgencyController.updateAgency);

// Eliminar agencia (soft delete)
router.delete('/:id', AgencyController.deleteAgency);

// Obtener estadísticas de la agencia
router.get('/:id/stats', AgencyController.getAgencyStats);

export default router;