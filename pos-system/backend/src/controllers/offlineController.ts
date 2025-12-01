import { Request, Response } from 'express';
import { OfflineStorageService } from '../services/OfflineStorageService';
import { BarcodeService } from '../services/BarcodeService';
import { ExcelImportService } from '../services/ExcelImportService';
import { FileManagerService } from '../services/FileManagerService';
import { OfflineBackupService } from '../services/OfflineBackupService';
import multer from 'multer';
import * as path from 'path';
import { Product } from '../models/Product';
import ProductAsset from '../models/ProductAsset';

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
     cb(null, 'C:\\ProgramData\\SistemaPOS\\DATOS\\IMPORTACIONES');
   },
   filename: (req, file, cb) => {
     const timestamp = Date.now();
     cb(null, `${timestamp}_${file.originalname}`);
   }
});

export const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
     const allowedTypes = ['.xlsx', '.xls'];
     const fileExt = path.extname(file.originalname).toLowerCase();
     
     if (allowedTypes.includes(fileExt)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
   },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});

export class OfflineController {
  
  /**
   * Verifica el estado del sistema offline
   */
  static async checkSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const isOnline = await OfflineStorageService.checkSystemHealth();
      const fileSystemHealth = await FileManagerService.checkSystemHealth();
      const systemStats = await FileManagerService.getSystemStats();
      const backupService = OfflineBackupService.getInstance();
      const backupStats = await backupService.getBackupStats();
      
      res.json({
        success: true,
        data: {
          status: isOnline && fileSystemHealth ? 'online' : 'offline',
          timestamp: new Date().toISOString(),
          storage: {
            available: isOnline && fileSystemHealth,
            path: (OfflineStorageService as any).BASE_PATH,
            stats: systemStats
          },
          backups: {
            enabled: backupService.getConfig().enabled,
            stats: backupStats
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error verificando estado del sistema',
        details: (error as Error).message
      });
    }
  }

  /**
   * Guarda producto en almacenamiento offline
   */
  static async saveProduct(req: Request, res: Response) {
    try {
      const productData = req.body;
      
      // Generar código si no existe
      if (!productData.codigo) {
        productData.codigo = BarcodeService.generateProductCode(
          productData.categoria || 'OTROS'
        );
      }

      // Guardar producto
      await OfflineStorageService.saveProduct(productData);
      
      // Generar código de barras y etiqueta
      const barcodePath = await BarcodeService.saveBarcodeFile({
        codigo: productData.codigo,
        nombre: productData.nombre,
        categoria: productData.categoria,
        precio: productData.precio,
        barcode: productData.codigo,
        fechaGeneracion: new Date().toISOString()
      });

      const labelPath = await BarcodeService.saveProductLabel(productData);

      res.json({
        success: true,
        data: {
          product: productData,
          barcodePath,
          labelPath
        },
        message: 'Producto guardado exitosamente'
      });
    } catch (error) {
      console.error('Error guardando producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error guardando producto',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtiene productos por categoría
   */
  static async getProductsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const products = await OfflineStorageService.loadProductsByCategory(category);
      
      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo productos',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtiene todos los productos
   */
  static async getAllProducts(req: Request, res: Response) {
    try {
      const categories = ['ANILLOS', 'COLLARES', 'PULSERAS', 'ARETES', 'RELOJES', 'OTROS'];
      const allProducts = [];

      for (const category of categories) {
        const products = await OfflineStorageService.loadProductsByCategory(category);
        allProducts.push(...products);
      }

      res.json({
        success: true,
        data: allProducts,
        count: allProducts.length
      });
    } catch (error) {
      console.error('Error obteniendo todos los productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo productos',
        error: (error as Error).message
      });
    }
  }

  /**
   * Importa productos desde Excel
   */
  static async importFromExcel(req: Request & { file?: Express.Multer.File }, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó archivo Excel'
        });
      }

      const filePath = req.file.path;
      const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined;

      const result = await ExcelImportService.importFromExcel(filePath, customMapping);

      res.json({
        success: result.success,
        data: result,
        message: result.success 
          ? `Importación completada: ${result.importedProducts} productos importados`
          : 'Importación falló'
      });
    } catch (error) {
      console.error('Error importando desde Excel:', error);
      res.status(500).json({
        success: false,
        message: 'Error importando desde Excel',
        error: (error as Error).message
      });
    }
  }

  /**
   * Genera plantilla de Excel
   */
  static async generateExcelTemplate(req: Request, res: Response) {
    try {
      const templatePath = await ExcelImportService.exportTemplate();
      
      res.json({
        success: true,
        data: {
          templatePath,
          downloadUrl: `/api/offline/download-template`
        },
        message: 'Plantilla generada exitosamente'
      });
    } catch (error) {
      console.error('Error generando plantilla:', error);
      res.status(500).json({
        success: false,
        message: 'Error generando plantilla',
        error: (error as Error).message
      });
    }
  }

  /**
   * Descarga plantilla de Excel
   */
  static async downloadTemplate(req: Request, res: Response) {
    try {
      const templatePath = await ExcelImportService.exportTemplate();
      
      res.download(templatePath, 'plantilla_productos.xlsx', (err) => {
        if (err) {
          console.error('Error descargando plantilla:', err);
          res.status(500).json({
            success: false,
            message: 'Error descargando plantilla'
          });
        }
      });
    } catch (error) {
      console.error('Error preparando descarga:', error);
      res.status(500).json({
        success: false,
        message: 'Error preparando descarga',
        error: (error as Error).message
      });
    }
  }

  /**
   * Genera código de barras para producto
   */
  static async generateBarcode(req: Request, res: Response) {
    try {
      const { codigo, nombre, categoria, precio } = req.body;
      
      if (!codigo) {
        return res.status(400).json({
          success: false,
          message: 'Código de producto es requerido'
        });
      }

      const barcodePath = await BarcodeService.saveBarcodeFile({
        codigo,
        nombre: nombre || 'Producto',
        categoria: categoria || 'OTROS',
        precio: precio || 0,
        barcode: codigo,
        fechaGeneracion: new Date().toISOString()
      });

      res.json({
        success: true,
        data: {
          codigo,
          barcodePath,
          downloadUrl: `/api/offline/download-barcode/${codigo}`
        },
        message: 'Código de barras generado exitosamente'
      });
    } catch (error) {
      console.error('Error generando código de barras:', error);
      res.status(500).json({
        success: false,
        message: 'Error generando código de barras',
        error: (error as Error).message
      });
    }
  }

  /**
   * Genera etiqueta para producto
   */
  static async generateLabel(req: Request, res: Response) {
    try {
      const productData = req.body;
      
      if (!productData.codigo) {
        return res.status(400).json({
          success: false,
          message: 'Código de producto es requerido'
        });
      }

      const labelPath = await BarcodeService.saveProductLabel(productData);

      res.json({
        success: true,
        data: {
          labelPath,
          downloadUrl: `/api/offline/download-label/${productData.codigo}`
        },
        message: 'Etiqueta generada exitosamente'
      });
    } catch (error) {
      console.error('Error generando etiqueta:', error);
      res.status(500).json({
        success: false,
        message: 'Error generando etiqueta',
        error: (error as Error).message
      });
    }
  }

  /**
   * Exporta datos del sistema
   */
  static async exportData(req: Request, res: Response) {
    try {
      const { type = 'all' } = req.query;
      
      let exportData: any = {};

      if (type === 'all' || type === 'products') {
        const categories = ['ANILLOS', 'COLLARES', 'PULSERAS', 'ARETES', 'RELOJES', 'OTROS'];
        exportData.products = {};
        
        for (const category of categories) {
          exportData.products[category] = await OfflineStorageService.loadProductsByCategory(category);
        }
      }

      const exportPath = await OfflineStorageService.exportData('system_export', exportData);

      res.json({
        success: true,
        data: {
          exportPath,
          downloadUrl: `/api/offline/download-export`
        },
        message: 'Datos exportados exitosamente'
      });
    } catch (error) {
      console.error('Error exportando datos:', error);
      res.status(500).json({
        success: false,
        message: 'Error exportando datos',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  static async getStats(req: Request, res: Response) {
    try {
      const stats = await OfflineStorageService.getSystemStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: (error as Error).message
      });
    }
  }

  /**
   * Busca productos por código o nombre
   */
  static async searchProducts(req: Request, res: Response) {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Parámetro de búsqueda requerido'
        });
      }

      const categories = ['ANILLOS', 'COLLARES', 'PULSERAS', 'ARETES', 'RELOJES', 'OTROS'];
      const results = [];

      for (const category of categories) {
        const products = await OfflineStorageService.loadProductsByCategory(category);
        
        const filtered = products.filter(product => 
          product.codigo?.toLowerCase().includes(query.toLowerCase()) ||
          product.nombre?.toLowerCase().includes(query.toLowerCase()) ||
          product.descripcion?.toLowerCase().includes(query.toLowerCase())
        );
        
        results.push(...filtered);
      }

      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      console.error('Error buscando productos:', error);
      res.status(500).json({
        success: false,
        message: 'Error buscando productos',
        error: (error as Error).message
      });
    }
  }

  /**
   * Crea un respaldo manual del sistema
   */
  static async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { type, correlationId } = req.body;
      const backupService = OfflineBackupService.getInstance();
      const result = await backupService.performBackup(type || 'manual', correlationId);
      
      res.json({
        success: result.success,
        data: result,
        message: result.success ? 'Respaldo creado exitosamente' : 'Error creando respaldo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error creando respaldo',
        details: (error as Error).message
      });
    }
  }

  /**
   * Obtiene el historial de respaldos
   */
  static async getBackupHistory(req: Request, res: Response): Promise<void> {
    try {
      const backupService = OfflineBackupService.getInstance();
      const history = await backupService.getBackupHistory();
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo historial de respaldos',
        details: (error as Error).message
      });
    }
  }

  /**
   * Restaura un respaldo específico
   */
  static async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupPath } = req.body;
      
      if (!backupPath) {
        res.status(400).json({
          success: false,
          error: 'Ruta del respaldo requerida'
        });
        return;
      }

      const backupService = OfflineBackupService.getInstance();
      const success = await backupService.restoreBackup(backupPath);
      
      res.json({
        success,
        message: success ? 'Respaldo restaurado exitosamente' : 'Error restaurando respaldo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error restaurando respaldo',
        details: (error as Error).message
      });
    }
  }

  /**
   * Actualiza la configuración de respaldos
   */
  static async updateBackupConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      
      const backupService = OfflineBackupService.getInstance();
      await backupService.updateConfig(config);
      
      res.json({
        success: true,
        message: 'Configuración de respaldos actualizada',
        data: backupService.getConfig()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error actualizando configuración de respaldos',
        details: (error as Error).message
      });
    }
  }

  /**
   * Obtiene la configuración actual de respaldos
   */
  static async getBackupConfig(req: Request, res: Response): Promise<void> {
    try {
      const backupService = OfflineBackupService.getInstance();
      const config = backupService.getConfig();
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo configuración de respaldos',
        details: (error as Error).message
      });
    }
  }

  /**
   * Lista archivos en un directorio específico
   */
  static async listFiles(req: Request, res: Response): Promise<void> {
    try {
      const { directory } = req.params;
      
      // Mapear nombres de directorio a rutas reales
      const directoryMap: { [key: string]: string } = {
        'products': FileManagerService.PATHS.PRODUCTS,
        'sales': FileManagerService.PATHS.SALES,
        'clients': FileManagerService.PATHS.CLIENTS,
        'inventory': FileManagerService.PATHS.INVENTORY,
        'backups': FileManagerService.PATHS.BACKUPS,
        'exports': FileManagerService.PATHS.EXPORTS
      };

      const directoryPath = directoryMap[directory];
      if (!directoryPath) {
        res.status(400).json({
          success: false,
          error: 'Directorio no válido'
        });
        return;
      }

      const files = await FileManagerService.listFiles(directoryPath);
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error listando archivos',
        details: (error as Error).message
      });
    }
  }

  /**
   * Obtiene estadísticas detalladas del sistema
   */
  static async getDetailedStats(req: Request, res: Response): Promise<void> {
    try {
      const systemStats = await FileManagerService.getSystemStats();
      const backupService = OfflineBackupService.getInstance();
      const backupStats = await backupService.getBackupStats();
      
      res.json({
        success: true,
        data: {
          system: systemStats,
          backups: backupStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas',
        details: (error as Error).message
      });
    }
  }

  static async generateAssetLabel(req: Request, res: Response) {
    try {
      const { codigo, serial, nombre, categoria, precio, metal, peso, hallmark } = req.body as any
      if (!codigo || !serial) {
        return res.status(400).json({ success: false, message: 'Código y serial son requeridos' })
      }
      const product = { codigo, nombre, categoria, precio, metal, peso }
      const asset = { serial, hallmark }
      const labelPath = await BarcodeService.saveAssetLabel(product, asset)
      return res.json({ success: true, data: { labelPath, downloadUrl: `/api/offline/download-label-asset/${codigo}-${serial}` }, message: 'Etiqueta de pieza generada exitosamente' })
    } catch (error) {
      console.error('Error generando etiqueta de pieza:', error)
      return res.status(500).json({ success: false, message: 'Error generando etiqueta de pieza', error: (error as Error).message })
    }
  }

  static async generateAssetLabelsBulk(req: Request, res: Response) {
    try {
      const { productId, status, limit } = (req.body || {}) as any;
      const where: any = {};
      if (productId) where.productId = productId;
      if (status) where.status = status;
      const items = await ProductAsset.findAll({ where, order: [['createdAt','DESC']], limit: typeof limit === 'number' ? limit : undefined });
      const out: Array<{ serial: string; labelPath: string }> = [];
      for (const a of items) {
        const prod = await Product.findByPk((a as any).productId);
        if (!prod) continue;
        const p = {
          codigo: (prod as any).code || '',
          nombre: (prod as any).name,
          categoria: (prod as any).category,
          precio: Number((prod as any).salePrice || 0),
          metal: (prod as any).metal,
          peso: Number((prod as any).grams || 0),
        };
        const asset = { serial: (a as any).serial, hallmark: (a as any).hallmark };
        const pathLabel = await BarcodeService.saveAssetLabel(p, asset);
        out.push({ serial: asset.serial, labelPath: pathLabel });
      }
      return res.json({ success: true, data: { count: out.length, items: out } });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  /**
   * Prueba de lectura/escritura en la ruta de datos del sistema
   * - Escribe un archivo JSON temporal en la carpeta de CONFIGURACION
   * - Lee el archivo y verifica el contenido
   * - Elimina el archivo de prueba
   */
  static async testStorage(req: Request, res: Response): Promise<void> {
    try {
      // Carpeta de configuración (persistente)
      const configDir = FileManagerService.PATHS.CONFIG;
      const ts = Date.now();
      const filename = `storage-test-${ts}.json`;
      const filePath = path.join(configDir, filename);

      const payload = { test: true, timestamp: new Date(ts).toISOString(), nodeVersion: process.version };

      // Escribir archivo
      await FileManagerService.writeJsonFile(filePath, payload);

      // Leer y validar
      const readBack = await FileManagerService.readJsonFile<any>(filePath);
      const matches = readBack && readBack.test === true && readBack.timestamp === payload.timestamp;

      // Eliminar archivo de prueba (best-effort)
      try { await FileManagerService.deleteFile(filePath); } catch { /* noop */ }

      res.json({
        success: true,
        data: {
          path: configDir,
          filename,
          wrote: true,
          read: !!readBack,
          matches,
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error en prueba de almacenamiento',
        details: (error as Error).message
      });
    }
  }
}
