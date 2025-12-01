import { promises as fs } from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
}

export interface BackupInfo {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  timestamp: Date;
  size: number;
  files: string[];
  status: 'completed' | 'failed' | 'in_progress';
}

export class FileManagerService {
  private static readonly BASE_PATH = 'C:\\ProgramData\\SistemaPOS';
  
  // Rutas principales del sistema
  static readonly PATHS = {
    BASE: FileManagerService.BASE_PATH,
    DATA: path.join(FileManagerService.BASE_PATH, 'DATOS'),
    PRODUCTS: path.join(FileManagerService.BASE_PATH, 'DATOS', 'PRODUCTOS'),
    SALES: path.join(FileManagerService.BASE_PATH, 'DATOS', 'VENTAS'),
    CLIENTS: path.join(FileManagerService.BASE_PATH, 'DATOS', 'CLIENTES'),
    PROVIDERS: path.join(FileManagerService.BASE_PATH, 'DATOS', 'PROVEEDORES'),
    INVENTORY: path.join(FileManagerService.BASE_PATH, 'DATOS', 'INVENTARIO'),
    BACKUPS: path.join(FileManagerService.BASE_PATH, 'RESPALDOS'),
    EXPORTS: path.join(FileManagerService.BASE_PATH, 'EXPORTACIONES'),
    CONFIG: path.join(FileManagerService.BASE_PATH, 'CONFIGURACION'),
    BARCODES: path.join(FileManagerService.BASE_PATH, 'EXPORTACIONES', 'CODIGOS_BARRAS'),
    LABELS: path.join(FileManagerService.BASE_PATH, 'EXPORTACIONES', 'ETIQUETAS'),
    REPORTS: path.join(FileManagerService.BASE_PATH, 'EXPORTACIONES', 'REPORTES')
  };

  /**
   * Verifica si el sistema de archivos está disponible
   */
  static async checkSystemHealth(): Promise<boolean> {
    try {
      await fs.access(this.PATHS.BASE);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inicializa la estructura de carpetas si no existe
   */
  static async initializeDirectories(): Promise<void> {
    const directories = Object.values(this.PATHS);
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creando directorio ${dir}:`, error);
        throw error;
      }
    }
  }

  /**
   * Lee un archivo JSON de forma segura
   */
  static async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // Archivo no existe
      }
      throw error;
    }
  }

  /**
   * Escribe un archivo JSON de forma segura
   */
  static async writeJsonFile(filePath: string, data: any): Promise<void> {
    try {
      // Crear directorio padre si no existe
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Escribir archivo con formato bonito
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error escribiendo archivo ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Lista archivos en un directorio
   */
  static async listFiles(directoryPath: string): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        files.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: entry.isDirectory()
        });
      }

      return files;
    } catch (error) {
      console.error(`Error listando archivos en ${directoryPath}:`, error);
      return [];
    }
  }

  /**
   * Copia un archivo
   */
  static async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Crear directorio destino si no existe
      const dir = path.dirname(destinationPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.copyFile(sourcePath, destinationPath);
    } catch (error) {
      console.error(`Error copiando archivo de ${sourcePath} a ${destinationPath}:`, error);
      throw error;
    }
  }

  /**
   * Mueve un archivo
   */
  static async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Crear directorio destino si no existe
      const dir = path.dirname(destinationPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.rename(sourcePath, destinationPath);
    } catch (error) {
      console.error(`Error moviendo archivo de ${sourcePath} a ${destinationPath}:`, error);
      throw error;
    }
  }

  /**
   * Elimina un archivo
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error(`Error eliminando archivo ${filePath}:`, error);
        throw error;
      }
    }
  }

  /**
   * Obtiene el tamaño de un directorio
   */
  static async getDirectorySize(directoryPath: string): Promise<number> {
    try {
      const files = await this.listFiles(directoryPath);
      let totalSize = 0;

      for (const file of files) {
        if (file.isDirectory) {
          totalSize += await this.getDirectorySize(file.path);
        } else {
          totalSize += file.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error(`Error calculando tamaño de directorio ${directoryPath}:`, error);
      return 0;
    }
  }

  /**
   * Limpia archivos antiguos de un directorio
   */
  static async cleanOldFiles(directoryPath: string, maxAgeInDays: number): Promise<number> {
    try {
      const files = await this.listFiles(directoryPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
      
      let deletedCount = 0;

      for (const file of files) {
        if (!file.isDirectory && file.modified < cutoffDate) {
          await this.deleteFile(file.path);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error(`Error limpiando archivos antiguos en ${directoryPath}:`, error);
      return 0;
    }
  }

  /**
   * Crea un respaldo comprimido de un directorio
   */
  static async createBackup(sourceDir: string, backupName: string): Promise<string> {
    try {
      const backupPath = path.join(this.PATHS.BACKUPS, 'DIARIOS', `${backupName}_${new Date().toISOString().split('T')[0]}.json`);
      
      // Recopilar todos los archivos JSON del directorio
      const files = await this.listFiles(sourceDir);
      const backupData: any = {
        timestamp: new Date().toISOString(),
        source: sourceDir,
        files: {}
      };

      for (const file of files) {
        if (!file.isDirectory && file.name.endsWith('.json')) {
          const content = await this.readJsonFile(file.path);
          backupData.files[file.name] = content;
        }
      }

      await this.writeJsonFile(backupPath, backupData);
      return backupPath;
    } catch (error) {
      console.error(`Error creando respaldo de ${sourceDir}:`, error);
      throw error;
    }
  }

  /**
   * Restaura un respaldo
   */
  static async restoreBackup(backupPath: string, targetDir: string): Promise<void> {
    try {
      const backupData = await this.readJsonFile(backupPath) as any;
      if (!backupData || !backupData.files) {
        throw new Error('Archivo de respaldo inválido');
      }

      // Crear directorio objetivo si no existe
      await fs.mkdir(targetDir, { recursive: true });

      // Restaurar cada archivo
      for (const [fileName, content] of Object.entries(backupData.files as Record<string, any>)) {
        const filePath = path.join(targetDir, fileName);
        await this.writeJsonFile(filePath, content);
      }
    } catch (error) {
      console.error(`Error restaurando respaldo ${backupPath}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del sistema de archivos
   */
  static async getSystemStats(): Promise<{
    totalSize: number;
    fileCount: number;
    directories: { [key: string]: { size: number; files: number } };
  }> {
    const stats = {
      totalSize: 0,
      fileCount: 0,
      directories: {} as { [key: string]: { size: number; files: number } }
    };

    try {
      for (const [name, dirPath] of Object.entries(this.PATHS)) {
        const files = await this.listFiles(dirPath);
        const size = await this.getDirectorySize(dirPath);
        
        stats.directories[name] = {
          size,
          files: files.filter(f => !f.isDirectory).length
        };
        
        stats.totalSize += size;
        stats.fileCount += files.filter(f => !f.isDirectory).length;
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas del sistema:', error);
    }

    return stats;
  }

  /**
   * Exporta datos a un archivo específico
   */
  static async exportData(data: any, fileName: string, type: 'reports' | 'barcodes' | 'labels'): Promise<string> {
    const typeMap = {
      reports: this.PATHS.REPORTS,
      barcodes: this.PATHS.BARCODES,
      labels: this.PATHS.LABELS
    };

    const filePath = path.join(typeMap[type], fileName);
    
    if (fileName.endsWith('.json')) {
      await this.writeJsonFile(filePath, data);
    } else {
      await fs.writeFile(filePath, data, 'utf-8');
    }

    return filePath;
  }
}