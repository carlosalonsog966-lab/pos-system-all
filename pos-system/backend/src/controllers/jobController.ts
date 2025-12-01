import { Request, Response } from 'express';
import { JobQueue } from '../models/JobQueue';
import { JobQueueService } from '../services/jobQueueService';

export class JobController {
  static async enqueue(req: Request, res: Response) {
    try {
      const { type, payload, scheduledAt, availableAt, maxAttempts } = req.body || {};
      if (!type || typeof type !== 'string') {
        return res.status(400).json({ error: 'type es requerido' });
      }
      const job = await JobQueueService.enqueue(type, payload, {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        availableAt: availableAt ? new Date(availableAt) : undefined,
        maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      });
      return res.status(201).json({ success: true, job });
    } catch (error) {
      return res.status(500).json({ error: 'Error al encolar job', details: (error as any)?.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const { type, status, limit = 50, offset = 0 } = req.query as any;
      const where: any = {};
      if (type) where.type = String(type);
      if (status) where.status = String(status);
      const jobs = await JobQueue.findAll({ where, limit: Number(limit), offset: Number(offset), order: [['createdAt', 'DESC']] });
      return res.json({ success: true, jobs });
    } catch (error) {
      return res.status(500).json({ error: 'Error al listar jobs' });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const job = await JobQueue.findByPk(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job no encontrado' });
      return res.json({ success: true, job });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener job' });
    }
  }

  static async retry(req: Request, res: Response) {
    try {
      const job = await JobQueueService.retry(req.params.id);
      return res.json({ success: true, job });
    } catch (error) {
      return res.status(400).json({ error: (error as any)?.message || 'No se pudo reintentar' });
    }
  }

  static async health(req: Request, res: Response) {
    try {
      const info = await JobQueueService.health();
      return res.json({ success: true, ...info });
    } catch (error) {
      return res.status(500).json({ error: 'Error obteniendo salud del JobQueue' });
    }
  }
}

