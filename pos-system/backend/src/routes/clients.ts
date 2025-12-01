import { Router } from 'express';
import { ClientController } from '../controllers/clientController';
import { validateBody, validateQuery } from '../middleware/validation';
import { authenticateToken, requireManagerOrAdmin, requireAnyRole } from '../middleware/auth';
import { createClientSchema, updateClientSchema, clientQuerySchema } from '../schemas/client';
import { z } from 'zod';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Esquemas para validación de parámetros
const uuidSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

const codeSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
});

// Rutas de consulta (todos los roles)
router.get('/', requireAnyRole, validateQuery(clientQuerySchema), ClientController.getClients);
router.get('/vip', requireAnyRole, ClientController.getVipClients);
router.get('/by-code/:code', requireAnyRole, ClientController.getClientByCode);
router.get('/:id', requireAnyRole, ClientController.getClientById);
router.get('/:id/stats', requireAnyRole, ClientController.getClientStats);

// Rutas de modificación (manager y admin para crear/editar, todos pueden crear clientes básicos)
router.post('/', requireAnyRole, validateBody(createClientSchema), ClientController.createClient);
router.put('/:id', requireManagerOrAdmin, validateBody(updateClientSchema), ClientController.updateClient);
router.delete('/:id', requireManagerOrAdmin, ClientController.deleteClient);

export default router;