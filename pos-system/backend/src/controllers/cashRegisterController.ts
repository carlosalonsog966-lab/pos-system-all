import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CashRegister } from '../models/CashRegister';
import { CashCount } from '../models/CashCount';
import { User } from '../models/User';
import { Sale } from '../models/Sale';
import { Op } from 'sequelize';
import { sha256OfBuffer } from '../utils/hash';
import { ExportsIntegrityService } from '../services/ExportsIntegrityService';
import { applyIntegrityHeaders } from '../utils/integrityHeaders';

export class CashRegisterController {
  // Obtener sesión actual de caja
  static async getCurrentSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      const currentSession = await CashRegister.findOne({
        where: {
          userId,
          status: 'open'
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }],
        order: [['openedAt', 'DESC']]
      });

      if (!currentSession) {
        return res.json({
          success: true,
          data: null,
          message: 'No hay sesión de caja abierta'
        });
      }

      // Calcular campos adicionales
      const sessionData = {
        ...currentSession.toJSON(),
        userName: (currentSession as any).user?.username || 'Usuario',
        expectedCash: currentSession.getExpectedCash(),
        cashDifference: currentSession.getCashDifference(),
        sessionDuration: currentSession.getSessionDuration()
      };

      res.json({
        success: true,
        data: sessionData,
      });
    } catch (error) {
      console.error('Error getting current session:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener sesión actual',
      });
    }
  }

  // Listar sesiones de caja con filtros
  static async listSessions(req: AuthRequest, res: Response) {
    try {
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role as 'admin' | 'manager' | 'cashier' | undefined;
      const { status, from, to, userId } = req.query as any;

      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      const where: any = {};
      // rol: admin/manager puede ver por userId, cashier solo suyas
      const effectiveUserId = (requesterRole === 'admin' || requesterRole === 'manager') && userId ? userId : requesterId;
      where.userId = effectiveUserId;

      if (status) {
        where.status = status;
      }

      if (from || to) {
        where.openedAt = {};
        if (from) where.openedAt[Op.gte] = new Date(from);
        if (to) where.openedAt[Op.lte] = new Date(to);
      }

      const sessions = await CashRegister.findAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }],
        order: [['openedAt', 'DESC']]
      });

      const data = sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: (s as any).user?.username || 'Usuario',
        openingAmount: Number(s.openingAmount),
        closingAmount: s.closingAmount != null ? Number(s.closingAmount) : undefined,
        totalSales: Number(s.totalSales),
        totalCash: Number(s.totalCash),
        totalCard: Number(s.totalCard),
        totalTransfer: Number(s.totalTransfer),
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        expectedCash: s.getExpectedCash(),
        cashDifference: s.getCashDifference(),
        sessionDuration: s.getSessionDuration(),
      }));

      return res.json({ success: true, data });
    } catch (error) {
      console.error('Error listing sessions:', error);
      return res.status(500).json({ success: false, error: 'Error al listar sesiones de caja' });
    }
  }
  // Exportar conteos de denominaciones por sesión (CSV)
  static async exportDenominationCounts(req: AuthRequest, res: Response) {
    try {
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role as 'admin' | 'manager' | 'cashier' | undefined;
      const { sessionId } = req.params;
      const { from, to, userId } = req.query as any;

      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      const session = await CashRegister.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Sesión de caja no encontrada' });
      }

      const effectiveUserId = (requesterRole === 'admin' || requesterRole === 'manager') && userId ? userId : requesterId;
      const where: any = {
        cashRegisterId: sessionId,
        userId: effectiveUserId,
      };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
      }

      const counts = await CashCount.findAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }],
        order: [['createdAt', 'DESC']]
      });

      const expectedCash = session.getExpectedCash();
      const rows = counts.map((count) => ({
        id: count.id,
        sessionId,
        createdAt: count.createdAt.toISOString(),
        userId: count.userId,
        userName: (count as any).user?.username || 'Usuario',
        countedAmount: Number(count.countedAmount),
        expectedCash,
        cashDifference: Number(count.countedAmount) - expectedCash,
        denominations: JSON.stringify(count.denominations),
        notes: count.notes || ''
      }));

      // Generar CSV
      const headers = ['id','sessionId','createdAt','userId','userName','countedAmount','expectedCash','cashDifference','denominations','notes'];
      const csvLines = [headers.join(','), ...rows.map(r => headers.map(h => {
        const val = (r as any)[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        // Wrap with quotes if contains comma or newline
        return /[",\n]/.test(str) ? `"${str}"` : str;
      }).join(','))];

      const csv = csvLines.join('\n');
      const bom = '\uFEFF';
      const body = bom + csv;
      const byteLength = Buffer.byteLength(body, 'utf8');
      const checksum = sha256OfBuffer(Buffer.from(body, 'utf8'));
      const filename = `denomination-counts-${sessionId}.csv`;
      const manifest = ExportsIntegrityService.readManifest();
      const expected = manifest.entries.find(e => e.filename === filename)?.sha256 || '';
      applyIntegrityHeaders(res, { filename, contentType: 'text/csv; charset=utf-8', body, setContentLength: true });
      return res.status(200).send(body);
    } catch (error) {
      console.error('Error exporting denomination counts:', error);
      return res.status(500).json({ success: false, error: 'Error al exportar conteos por denominaciones' });
    }
  }
  // Registrar conteo por denominaciones (arqueo intermedio)
  static async recordDenominationCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { denominations, notes } = req.body as { denominations: Record<string, number>; notes?: string };

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      if (!denominations || typeof denominations !== 'object') {
        return res.status(400).json({ success: false, error: 'Denominaciones inválidas' });
      }

      // Obtener sesión actual abierta
      const currentSession = await CashRegister.findOne({
        where: { userId, status: 'open' }
      });

      if (!currentSession) {
        return res.status(400).json({ success: false, error: 'No hay sesión de caja abierta' });
      }

      // Calcular el total contado a partir de las denominaciones
      let countedAmount = 0;
      for (const [denomStr, count] of Object.entries(denominations)) {
        const denom = parseFloat(denomStr);
        const qty = Number(count);
        if (!isFinite(denom) || !isFinite(qty) || qty < 0 || denom < 0) {
          return res.status(400).json({ success: false, error: `Denominación inválida: ${denomStr}` });
        }
        countedAmount += denom * qty;
      }

      // Crear registro de conteo
      console.log('[DenominationCount] Creating CashCount with:', {
        cashRegisterId: currentSession.id,
        userId,
        denominations,
        countedAmount,
        notes: notes || undefined,
      });
      const cashCount = await CashCount.create({
        cashRegisterId: currentSession.id,
        userId,
        denominations,
        countedAmount,
        notes: notes || undefined,
      });

      const responseData = {
        id: cashCount.id,
        sessionId: currentSession.id,
        countedAmount: Number(cashCount.countedAmount),
        expectedCash: currentSession.getExpectedCash(),
        cashDifference: Number(cashCount.countedAmount) - currentSession.getExpectedCash(),
        denominations: cashCount.denominations,
        createdAt: cashCount.createdAt,
        userId,
      };

      return res.status(201).json({ success: true, data: responseData, message: 'Conteo por denominaciones registrado' });
    } catch (error) {
      console.error('Error recording denomination count:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
      });
      return res.status(500).json({ success: false, error: 'Error al registrar conteo por denominaciones' });
    }
  }

  // Listar conteos de denominaciones por sesión
  static async listDenominationCounts(req: AuthRequest, res: Response) {
    try {
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role as 'admin' | 'manager' | 'cashier' | undefined;
      const { sessionId } = req.params;
      const { page = 1, pageSize = 20, from, to, userId } = req.query as any;

      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      // Verificar sesión
      const session = await CashRegister.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Sesión de caja no encontrada' });
      }

      // Construir filtros
      const effectiveUserId = (requesterRole === 'admin' || requesterRole === 'manager') && userId ? userId : requesterId;
      const where: any = {
        cashRegisterId: sessionId,
        userId: effectiveUserId,
      };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
      }

      const limit = Math.max(1, Math.min(Number(pageSize) || 20, 200));
      const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

      // Obtener conteos con paginación
      const { rows: counts, count: total } = await CashCount.findAndCountAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const expectedCash = session.getExpectedCash();

      const data = counts.map((count) => ({
        id: count.id,
        sessionId,
        countedAmount: Number(count.countedAmount),
        expectedCash,
        cashDifference: Number(count.countedAmount) - expectedCash,
        denominations: count.denominations,
        createdAt: count.createdAt,
        userId,
        userName: (count as any).user?.username || 'Usuario'
      }));

      const meta = {
        page: Math.max(1, Number(page) || 1),
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };

      return res.json({ success: true, data, meta });
    } catch (error) {
      console.error('Error listing denomination counts:', error);
      return res.status(500).json({ success: false, error: 'Error al listar conteos por denominaciones' });
    }
  }

  // Abrir caja registradora
  static async openCashRegister(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { openingAmount } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      if (!openingAmount || openingAmount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto de apertura inválido',
        });
      }

      // Verificar si ya hay una sesión abierta
      const existingSession = await CashRegister.findOne({
        where: {
          userId,
          status: 'open'
        }
      });

      if (existingSession) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe una sesión de caja abierta',
        });
      }

      // Crear nueva sesión
      const newSession = await CashRegister.create({
        userId,
        openingAmount: parseFloat(openingAmount),
        totalSales: 0,
        totalCash: 0,
        totalCard: 0,
        totalTransfer: 0,
        status: 'open',
        openedAt: new Date()
      });

      // Incluir información del usuario
      const sessionWithUser = await CashRegister.findByPk(newSession.id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }]
      });

      const sessionData = {
        ...sessionWithUser!.toJSON(),
        userName: (sessionWithUser as any).user?.username || 'Usuario',
        expectedCash: sessionWithUser!.getExpectedCash(),
        cashDifference: sessionWithUser!.getCashDifference(),
        sessionDuration: sessionWithUser!.getSessionDuration()
      };

      res.status(201).json({
        success: true,
        data: sessionData,
        message: 'Caja registradora abierta exitosamente'
      });
    } catch (error) {
      console.error('Error opening cash register:', error);
      res.status(500).json({
        success: false,
        error: 'Error al abrir caja registradora',
      });
    }
  }

  // Cerrar caja registradora
  static async closeCashRegister(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const { closingAmount, notes } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      if (!closingAmount || closingAmount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto de cierre inválido',
        });
      }

      const session = await CashRegister.findOne({
        where: {
          id: sessionId,
          userId,
          status: 'open'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Sesión de caja no encontrada o ya cerrada',
        });
      }

      // Cerrar sesión
      session.close(parseFloat(closingAmount), notes);
      await session.save();

      // Obtener sesión actualizada con usuario
      const updatedSession = await CashRegister.findByPk(session.id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }]
      });

      const sessionData = {
        ...updatedSession!.toJSON(),
        userName: (updatedSession as any).user?.username || 'Usuario',
        expectedCash: updatedSession!.getExpectedCash(),
        cashDifference: updatedSession!.getCashDifference(),
        sessionDuration: updatedSession!.getSessionDuration()
      };

      res.json({
        success: true,
        data: sessionData,
        message: 'Caja registradora cerrada exitosamente'
      });
    } catch (error) {
      console.error('Error closing cash register:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cerrar caja registradora',
      });
    }
  }

  // Obtener transacciones del día
  static async getTodayTransactions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Obtener ventas del día
      const sales = await Sale.findAll({
        where: {
          createdAt: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }],
        order: [['createdAt', 'DESC']]
      });

      // Convertir ventas a formato de transacciones
      const transactions = sales.map(sale => ({
        id: sale.id,
        type: 'sale',
        amount: sale.total,
        paymentMethod: sale.paymentMethod,
        description: `Venta #${sale.id.slice(-8)}`,
        timestamp: sale.createdAt,
        reference: sale.id,
        userId: sale.userId,
        userName: (sale as any).user?.username || 'Usuario'
      }));

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      console.error('Error getting today transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener transacciones del día',
      });
    }
  }

  // Obtener estadísticas de sesión
  static async getSessionStats(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      const session = await CashRegister.findOne({
        where: {
          id: sessionId,
          userId
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada',
        });
      }

      // Calcular estadísticas básicas
      const stats = {
        totalTransactions: 0, // Se puede calcular desde las ventas
        averageTransaction: 0,
        totalSales: session.totalSales,
        totalCash: session.totalCash,
        totalCard: session.totalCard,
        totalTransfer: session.totalTransfer,
        sessionDuration: session.getSessionDuration(),
        expectedCash: session.getExpectedCash(),
        cashDifference: session.getCashDifference()
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting session stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas de sesión',
      });
    }
  }

  // Registrar movimiento de efectivo
  static async addCashMovement(req: AuthRequest, res: Response) {
    try {
      const { type, amount, reason, description } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
        });
      }

      // Obtener sesión actual
      const currentSession = await CashRegister.findOne({
        where: {
          userId,
          status: 'open'
        }
      });

      if (!currentSession) {
        return res.status(400).json({
          success: false,
          error: 'No hay sesión de caja abierta',
        });
      }

      // Actualizar totales según el tipo de movimiento
      if (type === 'cash_in') {
        currentSession.totalCash += parseFloat(amount);
      } else if (type === 'cash_out') {
        currentSession.totalCash -= parseFloat(amount);
      }

      await currentSession.save();

      // Crear registro de transacción (esto se podría expandir con una tabla de transacciones)
      const transaction = {
        id: `mov_${Date.now()}`,
        type,
        amount: parseFloat(amount),
        paymentMethod: 'cash',
        description: `${reason}: ${description || ''}`,
        timestamp: new Date(),
        userId,
        userName: req.user?.username || 'Usuario'
      };

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Movimiento registrado exitosamente'
      });
    } catch (error) {
      console.error('Error adding cash movement:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar movimiento',
      });
    }
  }
}
