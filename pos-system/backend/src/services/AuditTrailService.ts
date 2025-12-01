import AuditTrail, { AuditResult } from '../models/AuditTrail';
import { Op, fn, col } from 'sequelize';
import { User } from '../models/User';

interface ActorInfo {
  id?: string;
  role?: string;
}

interface LogInput {
  operation: string;
  entityType?: string;
  entityId?: string;
  result: AuditResult;
  message?: string;
  details?: any;
  correlationId?: string;
  actor?: ActorInfo | null;
}

export class AuditTrailService {
  static async log(input: LogInput) {
    const actorId = input.actor?.id ?? undefined;
    let actorRole = input.actor?.role ?? undefined;

    // Enriquecer actorRole automáticamente si no se proporcionó y hay actorId
    if (!actorRole && actorId) {
      try {
        const user = await User.findByPk(actorId, { attributes: ['role'] });
        if (user) {
          actorRole = user.role;
        }
      } catch (err) {
        // No bloquear la auditoría si falla la consulta del usuario
      }
    }
    await AuditTrail.create({
      operation: input.operation,
      entityType: input.entityType ?? undefined,
      entityId: input.entityId ?? undefined,
      actorId,
      actorRole,
      result: input.result,
      message: input.message ?? undefined,
      details: input.details ?? undefined,
      correlationId: input.correlationId ?? undefined,
    });
  }

  static async list(query: { entityType?: string; entityId?: string; actorId?: string; operation?: string }) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.operation) where.operation = query.operation;
    return AuditTrail.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  static async getById(id: string) {
    return AuditTrail.findByPk(id);
  }

  /**
   * Lista auditorías de reembolsos de ventas con filtros opcionales.
   * Filtros: saleId (entityId), actorId, result, startDate, endDate
   */
  static async listRefunds(query: { saleId?: string; actorId?: string; result?: AuditResult; startDate?: string; endDate?: string }) {
    const where: any = { operation: 'sale.refund', entityType: 'Sale' };
    if (query.saleId) where.entityId = query.saleId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.result) where.result = query.result;
    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : new Date(0);
      const end = query.endDate ? new Date(query.endDate) : new Date();
      where.createdAt = { [Op.between]: [start, end] };
    }
    return AuditTrail.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  /**
   * Genera un resumen de auditoría con filtros y agregaciones.
   * Filtros soportados: startDate, endDate, operation, entityType, entityId, actorId, result, correlationId
   * Devuelve: total, por operación, por resultado y conteo diario dentro del período.
   */
  static async report(query: {
    startDate?: string;
    endDate?: string;
    operation?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    result?: AuditResult;
    correlationId?: string;
  }) {
    const where: any = {};
    if (query.operation) where.operation = query.operation;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.result) where.result = query.result;
    if (query.correlationId) where.correlationId = query.correlationId;

    // Rango de fechas
    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : new Date(0);
      const end = query.endDate ? new Date(query.endDate) : new Date();
      where.createdAt = { [Op.between]: [start, end] };
    }

    // Total
    const total = await AuditTrail.count({ where });

    // Agregación por operación
    const byOperationRows = await AuditTrail.findAll({
      where,
      attributes: ['operation', [fn('COUNT', col('*')), 'count']],
      group: ['operation'],
      order: [[fn('COUNT', col('*')), 'DESC']],
    });
    const byOperation = byOperationRows.map((r: any) => ({ operation: r.get('operation'), count: Number(r.get('count')) }));

    // Agregación por resultado
    const byResultRows = await AuditTrail.findAll({
      where,
      attributes: ['result', [fn('COUNT', col('*')), 'count']],
      group: ['result'],
      order: [['result', 'ASC']],
    });
    const byResult = byResultRows.map((r: any) => ({ result: r.get('result') as AuditResult, count: Number(r.get('count')) }));

    // Conteo diario (fecha sin tiempo)
    const dateCol = fn('date', col('createdAt')) as any;
    const dailyRows = await AuditTrail.findAll({
      where,
      attributes: [[dateCol, 'date'], [fn('COUNT', col('*')), 'count']],
      group: ['date'],
      order: [['date', 'ASC']],
    });
    const daily = dailyRows.map((r: any) => ({ date: String(r.get('date')), count: Number(r.get('count')) }));

    return {
      total,
      byOperation,
      byResult,
      daily,
      topOperations: byOperation.slice(0, 10),
    };
  }
}
