import fs from 'fs';
import path from 'path';
import * as cron from 'node-cron';
import { sequelize } from '../db/config';
import { SettingsService } from './settingsService';
import { ExportsIntegrityService } from './ExportsIntegrityService';

export interface BackupInfo {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'automatic';
  description?: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export class BackupService {
  private static cronJob: any = null;
  private static backupDirectory: string = path.join(process.cwd(), 'data', 'backups');

  /**
   * Inicializa el servicio de respaldos
   */
  static async initialize(): Promise<void> {
    // Crear directorio de respaldos si no existe
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }

    // Configurar respaldos automáticos basado en configuraciones
    await this.setupAutomaticBackups();
    
    console.log('BackupService initialized');
  }

  /**
   * Configura los respaldos automáticos basado en las configuraciones
   */
  static async setupAutomaticBackups(): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      
      // Detener cron job existente
      if (this.cronJob) {
        this.cronJob.destroy();
        this.cronJob = null;
      }

      // Si los respaldos automáticos están habilitados
      if (settings.autoBackup) {
        let cronExpression: string;
        
        switch (settings.backupFrequency) {
          case 'daily':
            cronExpression = '0 2 * * *'; // Todos los días a las 2:00 AM
            break;
          case 'weekly':
            cronExpression = '0 2 * * 0'; // Domingos a las 2:00 AM
            break;
          case 'monthly':
            cronExpression = '0 2 1 * *'; // Primer día del mes a las 2:00 AM
            break;
          default:
            cronExpression = '0 2 * * 0'; // Por defecto semanal
        }

        this.cronJob = cron.schedule(cronExpression, async () => {
          console.log('Ejecutando respaldo automático...');
          const result = await this.createBackup('automatic', 'Respaldo automático programado');
          if (result.success) {
            console.log('Respaldo automático completado:', result.backup?.filename);
          } else {
            console.error('Error en respaldo automático:', result.error);
          }
        }, {
          timezone: 'America/Mexico_City'
        });

        console.log(`Respaldos automáticos configurados: ${settings.backupFrequency}`);
      }
    } catch (error) {
      console.error('Error configurando respaldos automáticos:', error);
    }
  }

  /**
   * Crea un respaldo de la base de datos
   */
  static async createBackup(type: 'manual' | 'automatic' = 'manual', description?: string): Promise<BackupResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${type}_${timestamp}.db`;
      const filepath = path.join(this.backupDirectory, filename);
      
      // Ruta de la base de datos principal
      const sourceDb = path.join(process.cwd(), 'data', 'pos_system.db');
      
      // Verificar que existe la base de datos
      if (!fs.existsSync(sourceDb)) {
        return {
          success: false,
          error: 'Base de datos no encontrada'
        };
      }

      // Crear respaldo
      fs.copyFileSync(sourceDb, filepath);
      
      // Obtener información del archivo
      const stats = fs.statSync(filepath);
      
      const backup: BackupInfo = {
        id: timestamp,
        filename,
        filepath,
        size: stats.size,
        createdAt: new Date(),
        type,
        description
      };

      // Limpiar respaldos antiguos
      await this.cleanupOldBackups();

      // Registrar integridad en manifest de exports
      try {
        ExportsIntegrityService.recordFile(filepath, 'backup');
      } catch (e) {
        console.warn('[BackupService] No se pudo registrar manifest de integridad', (e as any)?.message);
      }

      return {
        success: true,
        backup
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Lista todos los respaldos disponibles
   */
  static async listBackups(): Promise<BackupInfo[]> {
    try {
      if (!fs.existsSync(this.backupDirectory)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDirectory);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.db')) {
          const filepath = path.join(this.backupDirectory, file);
          const stats = fs.statSync(filepath);
          
          // Extraer información del nombre del archivo
          const parts = file.replace('.db', '').split('_');
          const type = parts[1] as 'manual' | 'automatic';
          const timestamp = parts.slice(2).join('_');

          backups.push({
            id: timestamp,
            filename: file,
            filepath,
            size: stats.size,
            createdAt: stats.birthtime,
            type,
            description: type === 'automatic' ? 'Respaldo automático' : 'Respaldo manual'
          });
        }
      }

      // Ordenar por fecha de creación (más recientes primero)
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error listando respaldos:', error);
      return [];
    }
  }

  /**
   * Restaura la base de datos desde un respaldo
   */
  static async restoreBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        return {
          success: false,
          error: 'Respaldo no encontrado'
        };
      }

      if (!fs.existsSync(backup.filepath)) {
        return {
          success: false,
          error: 'Archivo de respaldo no existe'
        };
      }

      // Cerrar conexiones de la base de datos
      await sequelize.close();

      // Crear respaldo de la base de datos actual antes de restaurar
      const currentBackupResult = await this.createBackup('manual', 'Respaldo antes de restauración');
      if (!currentBackupResult.success) {
        console.warn('No se pudo crear respaldo de seguridad antes de restaurar');
      }

      // Restaurar la base de datos
      const targetDb = path.join(process.cwd(), 'data', 'pos_system.db');
      fs.copyFileSync(backup.filepath, targetDb);

      // Reconectar a la base de datos
      await sequelize.authenticate();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Elimina un respaldo específico
   */
  static async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        return {
          success: false,
          error: 'Respaldo no encontrado'
        };
      }

      if (fs.existsSync(backup.filepath)) {
        fs.unlinkSync(backup.filepath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Limpia respaldos antiguos basado en configuraciones
   */
  static async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const maxBackups = 10; // Mantener máximo 10 respaldos
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos

      const now = Date.now();
      const backupsToDelete = backups.filter((backup, index) => {
        // Eliminar si hay más de maxBackups o si es muy antiguo
        return index >= maxBackups || (now - backup.createdAt.getTime()) > maxAge;
      });

      for (const backup of backupsToDelete) {
        if (fs.existsSync(backup.filepath)) {
          fs.unlinkSync(backup.filepath);
          console.log(`Respaldo antiguo eliminado: ${backup.filename}`);
        }
      }
    } catch (error) {
      console.error('Error limpiando respaldos antiguos:', error);
    }
  }

  /**
   * Obtiene estadísticas de respaldos
   */
  static async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    lastBackup?: Date;
    nextScheduledBackup?: Date;
    automaticBackupsEnabled: boolean;
  }> {
    try {
      const backups = await this.listBackups();
      const settings = await SettingsService.getSettings();
      
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const lastBackup = backups.length > 0 ? backups[0].createdAt : undefined;
      
      let nextScheduledBackup: Date | undefined;
      if (settings.autoBackup && this.cronJob) {
        // Calcular próximo respaldo basado en la frecuencia
        const now = new Date();
        switch (settings.backupFrequency) {
          case 'daily':
            nextScheduledBackup = new Date(now);
            nextScheduledBackup.setDate(now.getDate() + 1);
            nextScheduledBackup.setHours(2, 0, 0, 0);
            break;
          case 'weekly':
            nextScheduledBackup = new Date(now);
            const daysUntilSunday = (7 - now.getDay()) % 7;
            nextScheduledBackup.setDate(now.getDate() + (daysUntilSunday || 7));
            nextScheduledBackup.setHours(2, 0, 0, 0);
            break;
          case 'monthly':
            nextScheduledBackup = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0, 0);
            break;
        }
      }

      return {
        totalBackups: backups.length,
        totalSize,
        lastBackup,
        nextScheduledBackup,
        automaticBackupsEnabled: settings.autoBackup
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de respaldos:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        automaticBackupsEnabled: false
      };
    }
  }

  /**
   * Detiene el servicio de respaldos
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
  }
}
