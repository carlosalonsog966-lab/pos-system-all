import { Response } from 'express';
import { sequelize } from '../db/config';
import { Op } from 'sequelize';
import FilterPreset from '../models/FilterPreset';
import { AuthRequest } from '../middleware/auth';

export class FilterPresetController {
  static async list(req: AuthRequest, res: Response) {
    try {
      const area = (req.query.area as string) || 'inventory';
      const userId = req.user?.id;
      const whereGlobal: any = { area, scope: 'global' };
      const whereUser: any = { area, scope: 'user', userId };
      const [global, user] = await Promise.all([
        FilterPreset.findAll({ where: whereGlobal, order: [['name', 'ASC']] }),
        userId ? FilterPreset.findAll({ where: whereUser, order: [['name', 'ASC']] }) : Promise.resolve([]),
      ]);
      res.json({ success: true, data: [...global, ...user] });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as any)?.message || 'Error al listar presets' });
    }
  }

  static async getDefault(req: AuthRequest, res: Response) {
    try {
      const area = (req.query.area as string) || 'inventory';
      const userId = req.user?.id;
      const userDefault = userId
        ? await FilterPreset.findOne({ where: { area, scope: 'user', userId, isDefault: true } })
        : null;
      const globalDefault = await FilterPreset.findOne({ where: { area, scope: 'global', isDefault: true } });
      res.json({ success: true, data: userDefault || globalDefault || null });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as any)?.message || 'Error al obtener preset por defecto' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { name, area = 'inventory', payload, scope = 'user', isDefault = false } = req.body || {};
      if (!name || !payload) {
        return res.status(400).json({ success: false, error: 'Nombre y payload son requeridos' });
      }
      const role = req.user?.role;
      const userId = req.user?.id || null;
      if (scope === 'global' && !(role === 'admin' || role === 'manager')) {
        return res.status(403).json({ success: false, error: 'No autorizado para crear presets globales' });
      }
      if (scope === 'user' && !userId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }
      // Crear preset
      const preset = await FilterPreset.create({ name, area, scope, userId, payload, isDefault: !!isDefault });
      // Si es default, limpiar otros defaults en el mismo alcance
      if (preset.isDefault) {
        if (scope === 'user' && userId) {
          await FilterPreset.update(
            { isDefault: false },
            { where: { area, scope: 'user', userId, id: { [Op.ne]: preset.id } } }
          );
        } else if (scope === 'global') {
          await FilterPreset.update(
            { isDefault: false },
            { where: { area, scope: 'global', id: { [Op.ne]: preset.id } } }
          );
        }
      }
      res.json({ success: true, data: preset });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as any)?.message || 'Error al crear preset' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, payload, isDefault } = req.body || {};
      const preset = await FilterPreset.findByPk(id);
      if (!preset) return res.status(404).json({ success: false, error: 'Preset no encontrado' });
      const role = req.user?.role;
      const userId = req.user?.id;
      if (preset.scope === 'global') {
        if (!(role === 'admin' || role === 'manager')) {
          return res.status(403).json({ success: false, error: 'No autorizado para actualizar presets globales' });
        }
      } else {
        if (!userId || preset.userId !== userId) {
          return res.status(403).json({ success: false, error: 'No autorizado para actualizar este preset' });
        }
      }
      preset.name = name ?? preset.name;
      preset.payload = payload ?? preset.payload;
      if (typeof isDefault === 'boolean') preset.isDefault = isDefault;
      await preset.save();
      // Gestionar default
      if (typeof isDefault === 'boolean' && isDefault) {
        if (preset.scope === 'user' && userId) {
          await FilterPreset.update(
            { isDefault: false },
            { where: { area: preset.area, scope: 'user', userId, id: { [Op.ne]: preset.id } } }
          );
        } else if (preset.scope === 'global') {
          await FilterPreset.update(
            { isDefault: false },
            { where: { area: preset.area, scope: 'global', id: { [Op.ne]: preset.id } } }
          );
        }
      }
      res.json({ success: true, data: preset });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as any)?.message || 'Error al actualizar preset' });
    }
  }

  static async remove(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const preset = await FilterPreset.findByPk(id);
      if (!preset) return res.status(404).json({ success: false, error: 'Preset no encontrado' });
      const role = req.user?.role;
      const userId = req.user?.id;
      if (preset.scope === 'global') {
        if (!(role === 'admin' || role === 'manager')) {
          return res.status(403).json({ success: false, error: 'No autorizado para eliminar presets globales' });
        }
      } else {
        if (!userId || preset.userId !== userId) {
          return res.status(403).json({ success: false, error: 'No autorizado para eliminar este preset' });
        }
      }
      await preset.destroy();
      res.json({ success: true, message: 'Preset eliminado' });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as any)?.message || 'Error al eliminar preset' });
    }
  }
}
