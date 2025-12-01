import { Router } from 'express';
import { authenticateToken, requireAdmin, requireManagerOrAdmin } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { UserController } from '../controllers/userController';
import { createUserSchema, updateUserSchema, userQuerySchema, resetPasswordSchema } from '../schemas/user';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ensureUploadsSubdir } from '../utils/uploads';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Listado con filtros y paginación (admin y manager)
router.get('/', requireManagerOrAdmin, validateQuery(userQuerySchema), UserController.listUsers);

// Crear usuario (solo admin)
router.post('/', requireAdmin, validateBody(createUserSchema), UserController.createUser);

// Actualizar usuario (solo admin)
router.put('/:id', requireAdmin, validateBody(updateUserSchema), UserController.updateUser);

// Activar/Desactivar usuario (solo admin)
router.patch('/:id/status', requireAdmin, validateBody(z.object({ isActive: z.boolean() })), UserController.setStatus);

// Resetear contraseña (solo admin)
router.post('/:id/reset-password', requireAdmin, validateBody(resetPasswordSchema), UserController.resetPassword);

// ===== Subida de avatar de usuario (solo admin) =====
const avatarsDir = ensureUploadsSubdir('avatars');
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(avatarsDir)) {
        fs.mkdirSync(avatarsDir, { recursive: true });
      }
    } catch (err) {
      console.error('[UPLOAD] Error creando directorio de avatares:', err);
    }
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const userId = (req.params as any)?.id || 'unknown';
    const unique = `${userId}-${base}-${Date.now()}${ext}`;
    cb(null, unique);
  }
});

const avatarFileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido. Use PNG, JPG, JPEG o WEBP'));
};

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: avatarFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/:id/avatar', requireAdmin, uploadAvatar.single('avatar'), UserController.uploadAvatar);

// Eliminar usuario (soft delete, solo admin)
router.delete('/:id', requireAdmin, UserController.deleteUser);

// Desactivar en masa usuarios no admin (solo admin)
router.delete('/bulk/non-admin', requireAdmin, UserController.bulkDeactivateNonAdmin);

export default router;
