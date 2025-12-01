import { EventLog } from '../models/EventLog';

export class EventLogService {
  static async record(params: {
    type: 'HEALTH_CHECK' | 'RATE_LIMIT' | 'ERROR' | 'USER_ACTION' | 'DATA_CHANGE' | 'SYSTEM' | 'HEALTH_METRICS';
    severity?: 'info' | 'warning' | 'error';
    message: string;
    context?: string;
    correlationId?: string;
    userId?: string;
    details?: any;
  }): Promise<void> {
    try {
      await EventLog.create({
        type: params.type,
        severity: params.severity || 'info',
        message: params.message,
        context: params.context,
        correlationId: params.correlationId,
        userId: params.userId,
        details: params.details,
      });
    } catch (err) {
      // Silenciar errores para no romper el flujo
      // Se podría enviar a winston o a un fallback de archivo si es necesario
      // console.warn('EventLogService.record failed:', (err as Error).message);
    }
  }
}

export default EventLogService;
