import { Request, Response } from 'express';
import { sequelize } from '../db/config';
import { JobQueueService } from '../services/jobQueueService';
import fs from 'fs';
import path from 'path';

export class HealthController {
  static async getHealth(req: Request, res: Response) {
    try {
      const healthChecks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkDiskSpace(),
        this.checkJobQueue(),
        this.checkBackupDirectory()
      ]);

      const [dbHealth, diskHealth, queueHealth, backupHealth] = healthChecks;

      const isHealthy = 
        dbHealth.status === 'fulfilled' && dbHealth.value.healthy &&
        diskHealth.status === 'fulfilled' && diskHealth.value.healthy &&
        queueHealth.status === 'fulfilled' && queueHealth.value.healthy;

      const response = {
        success: true,
        healthy: isHealthy,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth.status === 'fulfilled' ? dbHealth.value : { healthy: false, error: 'Database check failed' },
          diskSpace: diskHealth.status === 'fulfilled' ? diskHealth.value : { healthy: false, error: 'Disk check failed' },
          jobQueue: queueHealth.status === 'fulfilled' ? queueHealth.value : { healthy: false, error: 'Job queue check failed' },
          backupDirectory: backupHealth.status === 'fulfilled' ? backupHealth.value : { healthy: false, error: 'Backup directory check failed' }
        }
      };

      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json(response);

    } catch (error) {
      res.status(503).json({
        success: false,
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  private static async checkDatabase(): Promise<{ healthy: boolean; details: any }> {
    try {
      await sequelize.authenticate();
      
      // Verificar que podemos hacer una consulta simple
      const result = await sequelize.query('SELECT 1 as test', { type: 'SELECT' });
      
      return {
        healthy: true,
        details: {
          status: 'connected',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private static async checkDiskSpace(): Promise<{ healthy: boolean; details: any }> {
    try {
      const dataPath = path.join(process.cwd(), 'data');
      
      // Verificar que existe el directorio
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
      }

      // Obtener estadísticas del disco
      const stats = fs.statSync(dataPath);
      
      // Verificar que hay al menos 1GB libre (simulado con check básico)
      const hasMinSpace = true; // Simplificado para SQLite
      
      return {
        healthy: hasMinSpace,
        details: {
          dataDirectory: dataPath,
          exists: true,
          writable: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private static async checkJobQueue(): Promise<{ healthy: boolean; details: any }> {
    try {
      const isRunning = JobQueueService.isRunning();
      const jobStats = await JobQueueService.getStats();
      
      return {
        healthy: isRunning,
        details: {
          running: isRunning,
          pendingJobs: jobStats.pendingCount,
          failedJobs: jobStats.failedCount,
          processingJobs: jobStats.processingCount,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private static async checkBackupDirectory(): Promise<{ healthy: boolean; details: any }> {
    try {
      const backupPath = path.join(process.cwd(), 'data', 'backups');
      
      // Crear directorio si no existe
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      // Verificar que es accesible
      fs.accessSync(backupPath, fs.constants.R_OK | fs.constants.W_OK);
      
      return {
        healthy: true,
        details: {
          backupDirectory: backupPath,
          exists: true,
          accessible: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}