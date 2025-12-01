import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { EventLog } from '../models/EventLog';
import { Op } from 'sequelize';

const router = Router();

// Proteger todas las rutas de eventos
router.use(authenticateToken);

// Listado de eventos con filtros bÃ¡sicos
router.get('/', async (req, res) => {
  try {
    const { type, severity, from, to, page = '1', limit = '50', search, correlationId } = req.query as any;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    
    if (correlationId) {
      where.correlationId = correlationId;
    }

    if (search) {
      where[Op.or] = [
        { message: { [Op.like]: `%${search}%` } },
        { context: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows: events, count } = await EventLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    res.json({
      success: true,
      data: events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Crear evento manual (Ãºtil para pruebas)
router.post('/', async (req, res) => {
  try {
    const { type, severity = 'info', message, context, userId, details } = req.body || {};
    if (!type || !message) {
      return res.status(400).json({ success: false, error: 'type y message son requeridos' });
    }
    const created = await EventLog.create({ type, severity, message, context, userId, details });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;


