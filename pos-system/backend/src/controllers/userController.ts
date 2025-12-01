import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User } from '../models/User';
import { sequelize } from '../db/config';
import { UserQueryInput, CreateUserInput, UpdateUserInput, ResetPasswordInput } from '../schemas/user';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

export class UserController {
  static async listUsers(req: Request, res: Response) {
    try {
      const { page, pageSize, search, role, isActive, sortBy, sortOrder } = req.query as any;

      // Normalizar y aplicar valores por defecto de forma defensiva
      const allowedSortBy = new Set(['username', 'email', 'role', 'isActive', 'createdAt', 'lastLogin']);
      const pageNum = typeof page === 'number' ? page : Number(page) || 1;
      const pageSizeNum = typeof pageSize === 'number' ? pageSize : (Number(pageSize) || Number((req.query as any).limit) || 10);
      const sortByVal = (typeof sortBy === 'string' && allowedSortBy.has(sortBy)) ? sortBy : 'username';
      const sortOrderVal = sortOrder === 'DESC' ? 'DESC' : 'ASC';
      const isActiveVal = typeof isActive === 'boolean' ? isActive : (typeof isActive === 'string' ? (isActive.toLowerCase() === 'true' ? true : (isActive.toLowerCase() === 'false' ? false : undefined)) : undefined);

      const where: any = {};
      if (role) where.role = role;
      if (typeof isActiveVal === 'boolean') where.isActive = isActiveVal;
      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        where[Op.or] = [
          { username: { [Op.like]: term } },
          { email: { [Op.like]: term } },
        ];
      }

      const offset = (pageNum - 1) * pageSizeNum;
      const order = [[sortByVal, sortOrderVal]] as any;

      const { rows, count } = await User.findAndCountAll({
        where,
        offset,
        limit: pageSizeNum,
        order,
        attributes: { exclude: ['password'] },
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: count,
          totalPages: Math.ceil(count / pageSizeNum),
        },
      });
    } catch (error) {
      console.error('Error al listar usuarios:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const data: CreateUserInput = req.body;

      const existsByUsername = await User.findOne({ where: { username: data.username } });
      if (existsByUsername) {
        return res.status(400).json({ success: false, error: 'Ya existe un usuario con ese nombre de usuario' });
      }

      const existsByEmail = await User.findOne({ where: { email: data.email } });
      if (existsByEmail) {
        return res.status(400).json({ success: false, error: 'Ya existe un usuario con ese email' });
      }

      const user = await User.create({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role,
        isActive: data.isActive ?? true,
      });

      const safe = user.toJSON();
      res.status(201).json({ success: true, data: safe });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateUserInput = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      if (data.username && data.username !== user.username) {
        const exists = await User.findOne({ where: { username: data.username, id: { [Op.ne]: id } as any } });
        if (exists) {
          return res.status(400).json({ success: false, error: 'Ya existe otro usuario con ese nombre de usuario' });
        }
      }
      if (data.email && data.email !== user.email) {
        const exists = await User.findOne({ where: { email: data.email, id: { [Op.ne]: id } as any } });
        if (exists) {
          return res.status(400).json({ success: false, error: 'Ya existe otro usuario con ese email' });
        }
      }

      if (data.username !== undefined) user.username = data.username;
      if (data.email !== undefined) user.email = data.email;
      if (data.role !== undefined) user.role = data.role as any;
      if (data.isActive !== undefined) user.isActive = data.isActive;

      await user.save();
      const safe = user.toJSON();
      res.json({ success: true, data: safe });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  static async setStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body as { isActive: boolean };

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      user.isActive = isActive;
      await user.save();
      const safe = user.toJSON();
      res.json({ success: true, data: safe });
    } catch (error) {
      console.error('Error al cambiar estado de usuario:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body as ResetPasswordInput;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      user.password = newPassword; // hook beforeUpdate hará el hash
      await user.save();
      res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  // Subir avatar de usuario y actualizar avatarUrl
  static async uploadAvatar(req: Request & { file?: Express.Multer.File }, res: Response) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Archivo de imagen requerido' });
      }

      // Ruta del archivo original subido por multer
      const originalPath = (req.file as any).path as string;
      const outputDir = path.dirname(originalPath);
      const AVATAR_SIZE = Number.parseInt(process.env.AVATAR_IMAGE_SIZE || '256', 10) || 256;
      const AVATAR_FORMAT = (process.env.AVATAR_IMAGE_FORMAT || 'webp').toLowerCase();
      const AVATAR_QUALITY = Number.parseInt(process.env.AVATAR_IMAGE_QUALITY || '80', 10) || 80;
      const outExt = AVATAR_FORMAT === 'jpeg' ? '.jpg' : `.${AVATAR_FORMAT}`;
      const outputFilename = `${id}-avatar-${Date.now()}${outExt}`;
      let processedPath = path.join(outputDir, outputFilename);

      // Asegurar columna avatarUrl en SQLite si no existe (fallback a migración)
      try {
        const [rows] = await sequelize.query("SELECT name FROM pragma_table_info('users') WHERE name='avatarUrl'");
        const hasColumn = Array.isArray(rows) && rows.some((r: any) => r.name === 'avatarUrl');
        if (!hasColumn) {
          await sequelize.query('ALTER TABLE users ADD COLUMN avatarUrl TEXT');
        }
      } catch (e) {
        console.warn('[DB] No se pudo verificar/crear columna avatarUrl via PRAGMA', e);
      }
      // Procesar imagen: redimensionar y convertir según configuración
      try {
        const pipeline = sharp(originalPath).resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'center' });
        if (AVATAR_FORMAT === 'webp') {
          await pipeline.toFormat('webp', { quality: AVATAR_QUALITY }).toFile(processedPath);
        } else if (AVATAR_FORMAT === 'jpeg' || AVATAR_FORMAT === 'jpg') {
          await pipeline.jpeg({ quality: AVATAR_QUALITY }).toFile(processedPath);
        } else if (AVATAR_FORMAT === 'png') {
          await pipeline.png().toFile(processedPath);
        } else {
          await pipeline.toFile(processedPath);
        }
        // Borrar archivo original sin procesar para ahorrar espacio
        try {
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
        } catch (delErr) {
          console.warn('[UPLOAD] No se pudo eliminar archivo original:', delErr);
        }
      } catch (procErr) {
        console.error('[UPLOAD] Error procesando imagen con sharp, se usará el archivo original:', procErr);
        // Si falla el procesamiento, usar el archivo original
        processedPath = originalPath;
      }

      const { publicUploadsUrl } = await import('../utils/uploads');
      const publicUrl = publicUploadsUrl(req, 'avatars', path.basename(processedPath));

      // Si el usuario tenía un avatar previo, eliminar el archivo anterior
      try {
        const { resolveUploadsFileFromPublicUrl } = await import('../utils/uploads');
        const prevUrl = (user.get('avatarUrl') as string) || '';
        const prevPath = prevUrl ? resolveUploadsFileFromPublicUrl(prevUrl) : null;
        if (prevPath && fs.existsSync(prevPath)) {
          fs.unlinkSync(prevPath);
        }
      } catch (cleanupErr) {
        console.warn('[UPLOAD] No se pudo eliminar avatar anterior:', cleanupErr);
      }

      user.set('avatarUrl', publicUrl);
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Avatar actualizado exitosamente',
        data: { id: user.id, avatarUrl: user.get('avatarUrl') || publicUrl },
      });
    } catch (error) {
      console.error('Error al subir avatar:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  // Eliminar usuario (soft delete): desactiva y protege último admin y auto-eliminación
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const requester = (req as any).user as User | undefined;

      if (!id) {
        return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
      }

      // Evitar que un usuario elimine su propia cuenta
      if (requester && requester.id === id) {
        return res.status(400).json({ success: false, error: 'No puedes eliminar tu propia cuenta' });
      }

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      // Proteger contra eliminación del último admin activo
      if (user.role === 'admin') {
        const remainingAdmins = await User.count({
          where: {
            role: 'admin',
            isActive: true,
            id: { [Op.ne]: id } as any,
          }
        });
        if (remainingAdmins === 0) {
          return res.status(400).json({ success: false, error: 'No puedes eliminar el último administrador activo' });
        }
      }

      user.isActive = false;
      await user.save();

      return res.json({ success: true, message: 'Usuario desactivado exitosamente', data: user.toJSON() });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  // Desactivar en masa todos los usuarios que no son admin
  static async bulkDeactivateNonAdmin(req: Request, res: Response) {
    try {
      const [affected] = await User.update(
        { isActive: false },
        { where: { role: { [Op.ne]: 'admin' } as any, isActive: true } }
      );
      return res.json({ success: true, message: 'Usuarios no admin desactivados', affected });
    } catch (error) {
      console.error('Error al desactivar usuarios no admin:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export default UserController;
