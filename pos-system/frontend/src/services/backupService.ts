import { api, normalizeListPayload, normalizeSinglePayload } from '../lib/api';

export interface BackupInfo {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  createdAt: string;
  type: 'manual' | 'automatic';
  description?: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  lastBackup?: string;
  nextScheduledBackup?: string;
  automaticBackupsEnabled: boolean;
}

export interface BackupResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export class BackupService {
  /**
   * Obtener lista de respaldos
   */
  static async getBackups(): Promise<BackupInfo[]> {
    try {
      const response = await api.get('/backup', { __suppressGlobalError: true } as any);
      return normalizeListPayload<BackupInfo>(response.data);
    } catch (error) {
      console.warn('Error obteniendo respaldos, devolviendo lista vacía');
      return [];
    }
  }

  /**
   * Obtener estadísticas de respaldos
   */
  static async getBackupStats(): Promise<BackupStats> {
    try {
      const response = await api.get('/backup/stats', { __suppressGlobalError: true } as any);
      return normalizeSinglePayload<BackupStats>(response.data) as BackupStats;
    } catch (error) {
      console.warn('Error obteniendo estadísticas de respaldos, devolviendo valores por defecto');
      return { totalBackups: 0, totalSize: 0, automaticBackupsEnabled: false } as BackupStats;
    }
  }

  /**
   * Crear respaldo manual
   */
  static async createBackup(description?: string): Promise<BackupInfo> {
    try {
      const response = await api.post('/backup', { description });
      const info = normalizeSinglePayload<BackupInfo>(response.data);
      if (response.data.success && info) {
        return info;
      } else {
        throw new Error(response.data.message || 'Error creando respaldo');
      }
    } catch (error: any) {
      console.error('Error creando respaldo:', error);
      throw new Error(error.response?.data?.message || 'Error al crear respaldo');
    }
  }

  /**
   * Restaurar desde un respaldo
   */
  static async restoreBackup(backupId: string): Promise<void> {
    try {
      const response = await api.post(`/backup/${backupId}/restore`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error restaurando respaldo');
      }
    } catch (error: any) {
      console.error('Error restaurando respaldo:', error);
      throw new Error(error.response?.data?.message || 'Error al restaurar respaldo');
    }
  }

  /**
   * Eliminar un respaldo
   */
  static async deleteBackup(backupId: string): Promise<void> {
    try {
      const response = await api.delete(`/backup/${backupId}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error eliminando respaldo');
      }
    } catch (error: any) {
      console.error('Error eliminando respaldo:', error);
      throw new Error(error.response?.data?.message || 'Error al eliminar respaldo');
    }
  }

  /**
   * Reconfigurar respaldos automáticos
   */
  static async setupAutomaticBackups(): Promise<void> {
    try {
      const response = await api.post('/backup/setup');
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error configurando respaldos automáticos');
      }
    } catch (error: any) {
      console.error('Error configurando respaldos automáticos:', error);
      throw new Error(error.response?.data?.message || 'Error al configurar respaldos automáticos');
    }
  }

  /**
   * Formatear tamaño de archivo
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formatear fecha
   */
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
