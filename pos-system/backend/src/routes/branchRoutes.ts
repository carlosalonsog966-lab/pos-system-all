import { Router } from 'express';
import { BranchController } from '../controllers/branchController';

const router = Router();

// Obtener todas las sucursales
router.get('/', BranchController.getAllBranches);

// Obtener sucursal por ID
router.get('/:id', BranchController.getBranchById);

// Crear nueva sucursal
router.post('/', BranchController.createBranch);

// Actualizar sucursal
router.put('/:id', BranchController.updateBranch);

// Eliminar sucursal (soft delete)
router.delete('/:id', BranchController.deleteBranch);

// Obtener estadísticas de la sucursal
router.get('/:id/stats', BranchController.getBranchStats);

export default router;