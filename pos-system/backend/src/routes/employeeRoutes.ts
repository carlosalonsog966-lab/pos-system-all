import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';

const router = Router();

// Obtener todos los empleados
router.get('/', EmployeeController.getAllEmployees);

// Obtener empleado por ID
router.get('/:id', EmployeeController.getEmployeeById);

// Crear nuevo empleado
router.post('/', EmployeeController.createEmployee);

// Actualizar empleado
router.put('/:id', EmployeeController.updateEmployee);

// Eliminar empleado (soft delete)
router.delete('/:id', EmployeeController.deleteEmployee);

// Calcular comisión para un empleado
router.post('/:id/calculate-commission', EmployeeController.calculateCommission);

// Obtener estadísticas del empleado
router.get('/:id/stats', EmployeeController.getEmployeeStats);

// Generar códigos de barras en masa para empleados
router.post('/bulk-generate-barcodes', EmployeeController.bulkGenerateEmployeeBarcodes);

export default router;
