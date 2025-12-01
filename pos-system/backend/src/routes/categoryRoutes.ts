import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';

const router = Router();

// Obtener todas las categorías
router.get('/', CategoryController.getCategories);

// Obtener categoría por ID
router.get('/:id', CategoryController.getCategoryById);

export default router;