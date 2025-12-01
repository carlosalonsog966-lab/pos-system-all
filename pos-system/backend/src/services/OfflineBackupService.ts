import * as cron from 'node-cron';
import * as path from 'path';
import { FileManagerService } from './FileManagerService';
import { ExportsIntegrityService } from './ExportsIntegrityService';

export interface BackupConfig {
  enabled: boolean;
  dailyTime: string; // Formato HH:MM
  weeklyDay: number; // 0-6 (Domingo-Sábado)
  monthlyDay: number; // 1-31
  retentionDays: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  autoCleanup: boolean;
}

export interface BackupResult {
  success: boolean;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  timestamp: Date;
  filePath?: string;
  error?: string;
  size?: number;
}

export class OfflineBackupService {
  private static instance: OfflineBackupService;
  private config: BackupConfig;
  private scheduledTasks: cron.ScheduledTask[] = [];

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): OfflineBackupService {
    if (!OfflineBackupService.instance) {
      OfflineBackupService.instance = new OfflineBackupService();
    }
    return OfflineBackupService.instance;
  }

  private getDefaultConfig(): BackupConfig {
    return {
      enabled: true,
      dailyTime: '02:00', // 2:00 AM
      weeklyDay: 0, // Domingo
      monthlyDay: 1, // Primer día del mes
      retentionDays: {
        daily: 7,
        weekly: 30,
        monthly: 365
      },
      autoCleanup: true
    };
  }

  /**
   * Inicializa el servicio de respaldos
   */
  async initialize(): Promise<void> {
    try {
      // Cargar configuración desde archivo
      await this.loadConfig();
      
      // Configurar tareas programadas
      if (this.config.enabled) {
        this.scheduleBackups();
      }

      console.log('✅ Servicio de respaldos offline inicializado');
    } catch (error) {
      console.error('❌ Error inicializando servicio de respaldos:', error);
      throw error;
    }
  }

  /**
   * Carga la configuración desde archivo
   */
  private async loadConfig(): Promise<void> {
    try {
      const configPath = path.join(FileManagerService.PATHS.CONFIG, 'backup-config.json');
      const savedConfig = await FileManagerService.readJsonFile<BackupConfig>(configPath);
      
      if (savedConfig) {
        this.config = { ...this.getDefaultConfig(), ...savedConfig };
      } else {
        // Guardar configuración por defecto
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Error cargando configuración de respaldos:', error);
      // Usar configuración por defecto
    }
  }

  /**
   * Guarda la configuración actual
   */
  async saveConfig(): Promise<void> {
    try {
      const configPath = path.join(FileManagerService.PATHS.CONFIG, 'backup-config.json');
      await FileManagerService.writeJsonFile(configPath, this.config);
    } catch (error) {
      console.error('Error guardando configuración de respaldos:', error);
      throw error;
    }
  }

  /**
   * Programa las tareas de respaldo automático
   */
  private scheduleBackups(): void {
    // Limpiar tareas existentes
    this.scheduledTasks.forEach(task => task.destroy());
    this.scheduledTasks = [];

    // Respaldo diario
    const dailyTask = cron.schedule(`0 ${this.config.dailyTime.split(':')[1]} ${this.config.dailyTime.split(':')[0]} * * *`, 
      () => this.performBackup('daily')
    );
    this.scheduledTasks.push(dailyTask);

    // Respaldo semanal
    const weeklyTask = cron.schedule(`0 ${this.config.dailyTime.split(':')[1]} ${this.config.dailyTime.split(':')[0]} * * ${this.config.weeklyDay}`, 
      () => this.performBackup('weekly')
    );
    this.scheduledTasks.push(weeklyTask);

    // Respaldo mensual
    const monthlyTask = cron.schedule(`0 ${this.config.dailyTime.split(':')[1]} ${this.config.dailyTime.split(':')[0]} ${this.config.monthlyDay} * *`, 
      () => this.performBackup('monthly')
    );
    this.scheduledTasks.push(monthlyTask);

    // Iniciar todas las tareas
    this.scheduledTasks.forEach(task => task.start());

    console.log('📅 Tareas de respaldo programadas:');
    console.log(`   - Diario: ${this.config.dailyTime}`);
    console.log(`   - Semanal: Día ${this.config.weeklyDay} a las ${this.config.dailyTime}`);
    console.log(`   - Mensual: Día ${this.config.monthlyDay} a las ${this.config.dailyTime}`);
  }

  /**
   * Realiza un respaldo del tipo especificado
   */
  async performBackup(type: 'daily' | 'weekly' | 'monthly' | 'manual', correlationId?: string): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      type,
      timestamp: new Date()
    };

    try {
      console.log(`🔄 Iniciando respaldo ${type}...`);

      // Crear nombre del archivo de respaldo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${type}-${timestamp}`;

      // Determinar carpeta de destino (unificada bajo exports)
      const backupFolder = type === 'daily' ? 'DIARIOS' : 
                          type === 'weekly' ? 'SEMANALES' : 
                          type === 'manual' ? 'MANUALES' : 'MENSUALES';

      const backupDir = path.join(ExportsIntegrityService.getExportsBasePath(), 'backups', backupFolder);

      // Crear respaldo de cada directorio de datos
      const backupData = {
        timestamp: new Date().toISOString(),
        type,
        version: '1.0.0',
        data: {} as any
      };

      // Respaldar productos
      const productsFiles = await FileManagerService.listFiles(FileManagerService.PATHS.PRODUCTS);
      backupData.data.products = {};
      for (const file of productsFiles) {
        if (file.name.endsWith('.json')) {
          const content = await FileManagerService.readJsonFile(file.path);
          backupData.data.products[file.name] = content;
        }
      }

      // Respaldar ventas
      const salesFiles = await FileManagerService.listFiles(FileManagerService.PATHS.SALES);
      backupData.data.sales = {};
      for (const file of salesFiles) {
        if (file.name.endsWith('.json')) {
          const content = await FileManagerService.readJsonFile(file.path);
          backupData.data.sales[file.name] = content;
        }
      }

      // Respaldar clientes
      const clientsFiles = await FileManagerService.listFiles(FileManagerService.PATHS.CLIENTS);
      backupData.data.clients = {};
      for (const file of clientsFiles) {
        if (file.name.endsWith('.json')) {
          const content = await FileManagerService.readJsonFile(file.path);
          backupData.data.clients[file.name] = content;
        }
      }

      // Respaldar inventario
      const inventoryFiles = await FileManagerService.listFiles(FileManagerService.PATHS.INVENTORY);
      backupData.data.inventory = {};
      for (const file of inventoryFiles) {
        if (file.name.endsWith('.json')) {
          const content = await FileManagerService.readJsonFile(file.path);
          backupData.data.inventory[file.name] = content;
        }
      }

      // Guardar respaldo
      const backupPath = path.join(backupDir, `${backupName}.json`);
      await FileManagerService.writeJsonFile(backupPath, backupData);

      // Registrar en el manifest de exports (cálculo de hash interno)
      try {
        ExportsIntegrityService.recordFile(backupPath, 'backup', correlationId || undefined);
      } catch (e) {
        console.warn('[OfflineBackupService] No se pudo registrar manifest de integridad', (e as any)?.message);
      }

      // Calcular tamaño del respaldo
      const stats = await FileManagerService.listFiles(backupDir);
      const backupFile = stats.find(f => f.name === `${backupName}.json`);
      
      result.success = true;
      result.filePath = backupPath;
      result.size = backupFile?.size || 0;

      console.log(`✅ Respaldo ${type} completado: ${backupPath}`);

      // Limpiar respaldos antiguos si está habilitado
      if (this.config.autoCleanup && type !== 'manual') {
        await this.cleanOldBackups(type as 'daily' | 'weekly' | 'monthly');
      }

      // Registrar respaldo en historial
      await this.logBackup(result);

    } catch (error) {
      result.error = (error as Error).message;
      console.error(`❌ Error en respaldo ${type}:`, error);
    }

    return result;
  }

  /**
   * Limpia respaldos antiguos según la configuración de retención
   */
  private async cleanOldBackups(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    try {
      const folderMap = {
        daily: 'DIARIOS',
        weekly: 'SEMANALES',
        monthly: 'MENSUALES'
      };

      const backupDir = path.join(ExportsIntegrityService.getExportsBasePath(), 'backups', folderMap[type]);
      const retentionDays = this.config.retentionDays[type];

      const deletedCount = await FileManagerService.cleanOldFiles(backupDir, retentionDays);
      
      if (deletedCount > 0) {
        console.log(`🧹 Limpieza automática: ${deletedCount} respaldos ${type} antiguos eliminados`);
      }
    } catch (error) {
      console.error(`Error limpiando respaldos ${type}:`, error);
    }
  }

  /**
   * Registra un respaldo en el historial
   */
  private async logBackup(result: BackupResult): Promise<void> {
    try {
      const logPath = path.join(FileManagerService.PATHS.CONFIG, 'backup-history.json');
      let history = await FileManagerService.readJsonFile<BackupResult[]>(logPath) || [];

      // Agregar nuevo respaldo al historial
      history.unshift(result);

      // Mantener solo los últimos 100 registros
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      await FileManagerService.writeJsonFile(logPath, history);
    } catch (error) {
      console.error('Error registrando respaldo en historial:', error);
    }
  }

  /**
   * Obtiene el historial de respaldos
   */
  async getBackupHistory(): Promise<BackupResult[]> {
    try {
      const logPath = path.join(FileManagerService.PATHS.CONFIG, 'backup-history.json');
      return await FileManagerService.readJsonFile<BackupResult[]>(logPath) || [];
    } catch (error) {
      console.error('Error obteniendo historial de respaldos:', error);
      return [];
    }
  }

  /**
   * Restaura un respaldo específico
   */
  async restoreBackup(backupPath: string): Promise<boolean> {
    try {
      console.log(`🔄 Restaurando respaldo: ${backupPath}`);

      const backupData = await FileManagerService.readJsonFile(backupPath) as any;
      if (!backupData || !backupData.data) {
        throw new Error('Archivo de respaldo inválido');
      }

      // Restaurar productos
      if (backupData.data.products) {
        for (const [fileName, content] of Object.entries(backupData.data.products as Record<string, any>)) {
          const filePath = path.join(FileManagerService.PATHS.PRODUCTS, fileName);
          await FileManagerService.writeJsonFile(filePath, content);
        }
      }

      // Restaurar ventas
      if (backupData.data.sales) {
        for (const [fileName, content] of Object.entries(backupData.data.sales as Record<string, any>)) {
          const filePath = path.join(FileManagerService.PATHS.SALES, fileName);
          await FileManagerService.writeJsonFile(filePath, content);
        }
      }

      // Restaurar clientes
      if (backupData.data.clients) {
        for (const [fileName, content] of Object.entries(backupData.data.clients as Record<string, any>)) {
          const filePath = path.join(FileManagerService.PATHS.CLIENTS, fileName);
          await FileManagerService.writeJsonFile(filePath, content);
        }
      }

      // Restaurar inventario
      if (backupData.data.inventory) {
        for (const [fileName, content] of Object.entries(backupData.data.inventory as Record<string, any>)) {
          const filePath = path.join(FileManagerService.PATHS.INVENTORY, fileName);
          await FileManagerService.writeJsonFile(filePath, content);
        }
      }

      console.log('✅ Respaldo restaurado exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error restaurando respaldo:', error);
      return false;
    }
  }

  /**
   * Actualiza la configuración de respaldos
   */
  async updateConfig(newConfig: Partial<BackupConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();

    // Reprogramar tareas si está habilitado
    if (this.config.enabled) {
      this.scheduleBackups();
    } else {
      // Detener todas las tareas
      this.scheduledTasks.forEach(task => task.destroy());
      this.scheduledTasks = [];
    }
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Obtiene estadísticas de respaldos
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    lastBackup?: BackupResult;
    nextScheduled: {
      daily: string;
      weekly: string;
      monthly: string;
    };
  }> {
    try {
      const history = await this.getBackupHistory();
      const totalSize = await FileManagerService.getDirectorySize(path.join(ExportsIntegrityService.getExportsBasePath(), 'backups'));

      // Calcular próximos respaldos programados
      const now = new Date();
      const nextDaily = new Date(now);
      nextDaily.setHours(parseInt(this.config.dailyTime.split(':')[0]), parseInt(this.config.dailyTime.split(':')[1]), 0, 0);
      if (nextDaily <= now) {
        nextDaily.setDate(nextDaily.getDate() + 1);
      }

      const nextWeekly = new Date(now);
      const daysUntilWeekly = (this.config.weeklyDay - now.getDay() + 7) % 7;
      nextWeekly.setDate(now.getDate() + (daysUntilWeekly === 0 ? 7 : daysUntilWeekly));
      nextWeekly.setHours(parseInt(this.config.dailyTime.split(':')[0]), parseInt(this.config.dailyTime.split(':')[1]), 0, 0);

      const nextMonthly = new Date(now.getFullYear(), now.getMonth() + 1, this.config.monthlyDay);
      nextMonthly.setHours(parseInt(this.config.dailyTime.split(':')[0]), parseInt(this.config.dailyTime.split(':')[1]), 0, 0);

      return {
        totalBackups: history.length,
        totalSize,
        lastBackup: history[0],
        nextScheduled: {
          daily: nextDaily.toISOString(),
          weekly: nextWeekly.toISOString(),
          monthly: nextMonthly.toISOString()
        }
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de respaldos:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        nextScheduled: {
          daily: '',
          weekly: '',
          monthly: ''
        }
      };
    }
  }
}
