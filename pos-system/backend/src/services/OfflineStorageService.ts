import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class OfflineStorageService {
  private static readonly BASE_PATH = 'C:\\ProgramData\\SistemaPOS';
  
  // Rutas principales
  private static readonly PATHS = {
    DATOS: path.join(OfflineStorageService.BASE_PATH, 'DATOS'),
    PRODUCTOS: path.join(OfflineStorageService.BASE_PATH, 'DATOS', 'PRODUCTOS'),
    VENTAS: path.join(OfflineStorageService.BASE_PATH, 'DATOS', 'VENTAS'),
    CLIENTES: path.join(OfflineStorageService.BASE_PATH, 'DATOS', 'CLIENTES'),
    PROVEEDORES: path.join(OfflineStorageService.BASE_PATH, 'DATOS', 'PROVEEDORES'),
    INVENTARIO: path.join(OfflineStorageService.BASE_PATH, 'DATOS', 'INVENTARIO'),
    RESPALDOS: path.join(OfflineStorageService.BASE_PATH, 'RESPALDOS'),
    EXPORTACIONES: path.join(OfflineStorageService.BASE_PATH, 'EXPORTACIONES'),
    CONFIGURACION: path.join(OfflineStorageService.BASE_PATH, 'CONFIGURACION'),
  };

  // Categorías de productos
  private static readonly PRODUCT_CATEGORIES = {
    ANILLOS: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'ANILLOS'),
    COLLARES: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'COLLARES'),
    PULSERAS: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'PULSERAS'),
    ARETES: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'ARETES'),
    RELOJES: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'RELOJES'),
    OTROS: path.join(OfflineStorageService.PATHS.PRODUCTOS, 'OTROS'),
  };

  /**
   * Verifica si el directorio base existe
   */
  static async isInitialized(): Promise<boolean> {
    try {
      await stat(OfflineStorageService.BASE_PATH);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Guarda datos en formato JSON
   */
  static async saveData(category: string, filename: string, data: any): Promise<void> {
    try {
      const categoryPath = OfflineStorageService.PATHS[category as keyof typeof OfflineStorageService.PATHS];
      if (!categoryPath) {
        throw new Error(`Categoría no válida: ${category}`);
      }

      // Asegurar que el directorio existe
      await mkdir(categoryPath, { recursive: true });

      const filePath = path.join(categoryPath, `${filename}.json`);
      const jsonData = JSON.stringify(data, null, 2);
      
      await writeFile(filePath, jsonData, 'utf8');
      
      // Crear respaldo automático
      await OfflineStorageService.createBackup(category, filename, data);
      
    } catch (error) {
      console.error(`Error guardando datos en ${category}/${filename}:`, error);
      throw error;
    }
  }

  /**
   * Lee datos desde archivo JSON
   */
  static async loadData(category: string, filename: string): Promise<any> {
    try {
      const categoryPath = OfflineStorageService.PATHS[category as keyof typeof OfflineStorageService.PATHS];
      if (!categoryPath) {
        throw new Error(`Categoría no válida: ${category}`);
      }

      const filePath = path.join(categoryPath, `${filename}.json`);
      const jsonData = await readFile(filePath, 'utf8');
      
      return JSON.parse(jsonData);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // Archivo no existe
      }
      console.error(`Error cargando datos de ${category}/${filename}:`, error);
      throw error;
    }
  }

  /**
   * Guarda producto en su categoría correspondiente
   */
  static async saveProduct(product: any): Promise<void> {
    try {
      const category = product.category?.toUpperCase() || 'OTROS';
      const categoryPath = OfflineStorageService.PRODUCT_CATEGORIES[category as keyof typeof OfflineStorageService.PRODUCT_CATEGORIES] 
        || OfflineStorageService.PRODUCT_CATEGORIES.OTROS;

      await mkdir(categoryPath, { recursive: true });

      const filename = `${product.codigo || product.id || Date.now()}`;
      const filePath = path.join(categoryPath, `${filename}.json`);
      
      // Agregar metadatos
      const productWithMeta = {
        ...product,
        fechaCreacion: product.fechaCreacion || new Date().toISOString(),
        fechaModificacion: new Date().toISOString(),
        version: 1
      };

      await writeFile(filePath, JSON.stringify(productWithMeta, null, 2), 'utf8');
      
      // Actualizar índice de productos
      await OfflineStorageService.updateProductIndex(productWithMeta);
      
    } catch (error) {
      console.error('Error guardando producto:', error);
      throw error;
    }
  }

  /**
   * Carga todos los productos de una categoría
   */
  static async loadProductsByCategory(category: string): Promise<any[]> {
    try {
      const categoryPath = OfflineStorageService.PRODUCT_CATEGORIES[category.toUpperCase() as keyof typeof OfflineStorageService.PRODUCT_CATEGORIES];
      if (!categoryPath) {
        throw new Error(`Categoría no válida: ${category}`);
      }

      const files = await readdir(categoryPath);
      const products = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(categoryPath, file);
          const productData = await readFile(filePath, 'utf8');
          products.push(JSON.parse(productData));
        }
      }

      return products;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []; // Directorio no existe
      }
      console.error(`Error cargando productos de categoría ${category}:`, error);
      throw error;
    }
  }

  /**
   * Crea respaldo automático
   */
  private static async createBackup(category: string, filename: string, data: any): Promise<void> {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const backupPath = path.join(OfflineStorageService.PATHS.RESPALDOS, 'DIARIOS', dateStr);
      await mkdir(backupPath, { recursive: true });

      const backupFile = path.join(backupPath, `${category}_${filename}_${Date.now()}.json`);
      await writeFile(backupFile, JSON.stringify(data, null, 2), 'utf8');
      
    } catch (error) {
      console.error('Error creando respaldo:', error);
      // No lanzar error para no interrumpir el guardado principal
    }
  }

  /**
   * Actualiza índice de productos para búsquedas rápidas
   */
  private static async updateProductIndex(product: any): Promise<void> {
    try {
      const indexPath = path.join(OfflineStorageService.PATHS.DATOS, 'product_index.json');
      
      let index: any[] = [];
      try {
        const indexData = await readFile(indexPath, 'utf8');
        index = JSON.parse(indexData);
      } catch {
        // Índice no existe, crear nuevo
      }

      // Remover entrada existente si existe
      index = index.filter(item => item.codigo !== product.codigo);
      
      // Agregar nueva entrada
      index.push({
        codigo: product.codigo,
        nombre: product.nombre,
        categoria: product.category,
        precio: product.precio,
        fechaModificacion: product.fechaModificacion
      });

      await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
      
    } catch (error) {
      console.error('Error actualizando índice de productos:', error);
    }
  }

  /**
   * Exporta datos a archivo
   */
  static async exportData(type: string, data: any, filename?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportFilename = filename || `${type}_export_${timestamp}.json`;
      
      const exportPath = path.join(OfflineStorageService.PATHS.EXPORTACIONES, 'REPORTES');
      await mkdir(exportPath, { recursive: true });

      const filePath = path.join(exportPath, exportFilename);
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

      return filePath;
    } catch (error) {
      console.error('Error exportando datos:', error);
      throw error;
    }
  }

  /**
   * Verifica la salud del sistema offline
   */
  static async checkSystemHealth(): Promise<boolean> {
    try {
      // Verificar que todas las carpetas principales existan
      for (const dirPath of Object.values(OfflineStorageService.PATHS)) {
        try {
          await stat(dirPath);
        } catch {
          await mkdir(dirPath, { recursive: true });
        }
      }

      // Verificar que las carpetas de categorías existan
      for (const categoryPath of Object.values(OfflineStorageService.PRODUCT_CATEGORIES)) {
        try {
          await stat(categoryPath);
        } catch {
          await mkdir(categoryPath, { recursive: true });
        }
      }

      return true;
    } catch (error) {
      console.error('Error verificando salud del sistema:', error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  static async getSystemStats(): Promise<any> {
    try {
      const stats = {
        totalProductos: 0,
        productosPorCategoria: {} as Record<string, number>,
        ultimoRespaldo: null,
        espacioUtilizado: 0
      };

      // Contar productos por categoría
      for (const [category, categoryPath] of Object.entries(OfflineStorageService.PRODUCT_CATEGORIES)) {
        try {
          const files = await readdir(categoryPath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          stats.productosPorCategoria[category] = jsonFiles.length;
          stats.totalProductos += jsonFiles.length;
        } catch {
          stats.productosPorCategoria[category] = 0;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}