import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateBody } from '../middleware/validation';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { loginSchema, registerSchema, changePasswordSchema } from '../schemas/auth';

const router = Router();

// Rutas públicas
router.post('/login', validateBody(loginSchema), AuthController.login);

// Endpoint temporal de prueba para tickets (SIN AUTENTICACIÓN)
router.get('/test-ticket/:saleId', async (req, res) => {
  try {
    const { TicketController } = await import('../controllers/ticketController');
    await TicketController.generateTicket(req, res);
  } catch (error) {
    console.error('Error en endpoint de prueba:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas protegidas
router.use(authenticateToken);

router.get('/profile', AuthController.getProfile);
router.post('/change-password', validateBody(changePasswordSchema), AuthController.changePassword);
router.post('/logout', AuthController.logout);
router.post('/refresh', AuthController.refresh);

// Rutas de administrador
router.post('/register', requireAdmin, validateBody(registerSchema), AuthController.register);

export default router;
