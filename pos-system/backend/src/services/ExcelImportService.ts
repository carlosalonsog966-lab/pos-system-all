import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { OfflineStorageService } from './OfflineStorageService';
import { BarcodeService } from './BarcodeService';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface ExcelImportResult {
  success: boolean;
  totalRows: number;
  importedProducts: number;
  errors: string[];
  skippedRows: number;
  generatedCodes: string[];
}

export interface ProductMapping {
  nombre?: string;
  categoria?: string;
  precio?: string;
  peso?: string;
  metal?: string;
  descripcion?: string;
  proveedor?: string;
  costo?: string;
  stock?: string;
}

export class ExcelImportService {
  private static readonly IMPORT_PATH = 'C:\\ProgramData\\SistemaPOS\\DATOS\\IMPORTACIONES';

  /**
   * Mapeos comunes de columnas de Excel
   */
  private static readonly COLUMN_MAPPINGS = {
    // Nombres posibles para cada campo
    nombre: ['nombre', 'producto', 'descripcion', 'item', 'articulo', 'name'],
    categoria: ['categoria', 'tipo', 'category', 'class', 'clasificacion'],
    precio: ['precio', 'price', 'valor', 'costo_venta', 'precio_venta'],
    peso: ['peso', 'weight', 'gramos', 'gr', 'grams'],
    metal: ['metal', 'material', 'aleacion', 'tipo_metal'],
    descripcion: ['descripcion', 'detalle', 'description', 'observaciones'],
    proveedor: ['proveedor', 'supplier', 'fabricante'],
    costo: ['costo', 'cost', 'precio_compra', 'costo_compra'],
    stock: ['stock', 'cantidad', 'inventory', 'existencia', 'qty']
  };

  /**
   * Categorías válidas para joyería
   */
  private static readonly VALID_CATEGORIES = [
    'ANILLOS', 'COLLARES', 'PULSERAS', 'ARETES', 'RELOJES', 'OTROS'
  ];

  /**
   * Lee archivo Excel y extrae datos
   */
  static async readExcelFile(filePath: string): Promise<any[]> {
    try {
      const fileBuffer = await readFile(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Tomar la primera hoja
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      return jsonData as any[];
    } catch (error) {
      console.error('Error leyendo archivo Excel:', error);
      throw new Error(`No se pudo leer el archivo Excel: ${(error as Error).message}`);
    }
  }

  /**
   * Detecta automáticamente las columnas del Excel
   */
  static detectColumns(headers: string[]): ProductMapping {
    const mapping: ProductMapping = {};
    
    for (const [field, possibleNames] of Object.entries(ExcelImportService.COLUMN_MAPPINGS)) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.toString().toLowerCase().trim();
        
        if (possibleNames.some(name => header.includes(name))) {
          (mapping as any)[field] = headers[i];
          break;
        }
      }
    }
    
    return mapping;
  }

  /**
   * Normaliza categoría de producto
   */
  private static normalizeCategory(categoria: string): string {
    if (!categoria) return 'OTROS';
    
    const normalized = categoria.toUpperCase().trim();
    
    // Mapeos específicos
    const categoryMap = {
      'ANILLO': 'ANILLOS',
      'RING': 'ANILLOS',
      'COLLAR': 'COLLARES',
      'NECKLACE': 'COLLARES',
      'PULSERA': 'PULSERAS',
      'BRACELET': 'PULSERAS',
      'ARETE': 'ARETES',
      'EARRING': 'ARETES',
      'RELOJ': 'RELOJES',
      'WATCH': 'RELOJES'
    };

    // Buscar coincidencia exacta
    if (ExcelImportService.VALID_CATEGORIES.includes(normalized)) {
      return normalized;
    }

    // Buscar en mapeos
    for (const [key, value] of Object.entries(categoryMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return 'OTROS';
  }

  /**
   * Convierte fila de Excel a producto
   */
  private static convertRowToProduct(row: any[], headers: string[], mapping: ProductMapping): any {
    const product: any = {};
    
    // Mapear campos básicos
    for (const [field, columnName] of Object.entries(mapping)) {
      if (columnName) {
        const columnIndex = headers.indexOf(columnName);
        if (columnIndex >= 0 && row[columnIndex] !== undefined) {
          let value = row[columnIndex];
          
          // Procesar según el tipo de campo
          switch (field) {
            case 'precio':
            case 'costo':
              value = ExcelImportService.parsePrice(value);
              break;
            case 'peso':
              value = ExcelImportService.parseWeight(value);
              break;
            case 'categoria':
              value = ExcelImportService.normalizeCategory(value);
              break;
            case 'stock':
              value = parseInt(value) || 0;
              break;
            default:
              value = value?.toString().trim() || '';
          }
          
          product[field] = value;
        }
      }
    }

    // Generar código único
    product.codigo = BarcodeService.generateProductCode(product.categoria || 'OTROS');
    
    // Metadatos
    product.fechaCreacion = new Date().toISOString();
    product.fechaModificacion = new Date().toISOString();
    product.origen = 'IMPORTACION_EXCEL';
    product.activo = true;

    return product;
  }

  /**
   * Parsea precio desde diferentes formatos
   */
  private static parsePrice(value: any): number {
    if (typeof value === 'number') return value;
    
    const str = value?.toString().replace(/[$,\s]/g, '') || '0';
    const parsed = parseFloat(str);
    
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parsea peso desde diferentes formatos
   */
  private static parseWeight(value: any): number {
    if (typeof value === 'number') return value;
    
    const str = value?.toString().replace(/[^\d.]/g, '') || '0';
    const parsed = parseFloat(str);
    
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Valida producto antes de importar
   */
  private static validateProduct(product: any): string[] {
    const errors: string[] = [];
    
    if (!product.nombre || product.nombre.trim() === '') {
      errors.push('Nombre del producto es requerido');
    }
    
    if (!product.precio || product.precio <= 0) {
      errors.push('Precio debe ser mayor a 0');
    }
    
    if (!ExcelImportService.VALID_CATEGORIES.includes(product.categoria)) {
      errors.push(`Categoría inválida: ${product.categoria}`);
    }
    
    return errors;
  }

  /**
   * Importa productos desde archivo Excel
   */
  static async importFromExcel(
    filePath: string, 
    customMapping?: ProductMapping
  ): Promise<ExcelImportResult> {
    const result: ExcelImportResult = {
      success: false,
      totalRows: 0,
      importedProducts: 0,
      errors: [],
      skippedRows: 0,
      generatedCodes: []
    };

    try {
      // Leer archivo Excel
      const excelData = await ExcelImportService.readExcelFile(filePath);
      
      if (excelData.length === 0) {
        throw new Error('El archivo Excel está vacío');
      }

      // Primera fila como headers
      const headers = excelData[0] as string[];
      const dataRows = excelData.slice(1);
      
      result.totalRows = dataRows.length;

      // Detectar columnas automáticamente o usar mapping personalizado
      const mapping = customMapping || ExcelImportService.detectColumns(headers);
      
      console.log('Mapping detectado:', mapping);

      // Procesar cada fila
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Saltar filas vacías
        if (!row || row.every((cell: any) => !cell || cell.toString().trim() === '')) {
          result.skippedRows++;
          continue;
        }

        try {
          // Convertir fila a producto
          const product = ExcelImportService.convertRowToProduct(row, headers, mapping);
          
          // Validar producto
          const validationErrors = ExcelImportService.validateProduct(product);
          
          if (validationErrors.length > 0) {
            result.errors.push(`Fila ${i + 2}: ${validationErrors.join(', ')}`);
            result.skippedRows++;
            continue;
          }

          // Guardar producto
          await OfflineStorageService.saveProduct(product);
          
          // Generar código de barras y etiqueta
          await BarcodeService.saveBarcodeFile({
            codigo: product.codigo,
            nombre: product.nombre,
            categoria: product.categoria,
            precio: product.precio,
            barcode: product.codigo,
            fechaGeneracion: new Date().toISOString()
          });

          await BarcodeService.saveProductLabel(product);

          result.importedProducts++;
          result.generatedCodes.push(product.codigo);

        } catch (error) {
          result.errors.push(`Fila ${i + 2}: Error procesando - ${(error as Error).message}`);
          result.skippedRows++;
        }
      }

      // Crear reporte de importación
      await ExcelImportService.createImportReport(result, filePath);

      result.success = result.importedProducts > 0;

    } catch (error) {
      result.errors.push(`Error general: ${(error as Error).message}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Crea reporte de importación
   */
  private static async createImportReport(result: ExcelImportResult, originalFile: string): Promise<void> {
    try {
      const report = {
        fechaImportacion: new Date().toISOString(),
        archivoOriginal: path.basename(originalFile),
        resumen: {
          totalFilas: result.totalRows,
          productosImportados: result.importedProducts,
          filasOmitidas: result.skippedRows,
          errores: result.errors.length
        },
        codigosGenerados: result.generatedCodes,
        erroresDetallados: result.errors
      };

      const reportPath = path.join(
        'C:\\ProgramData\\SistemaPOS\\EXPORTACIONES\\REPORTES',
        `importacion_${Date.now()}.json`
      );

      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      
    } catch (error) {
      console.error('Error creando reporte de importación:', error);
    }
  }

  /**
   * Obtiene plantilla de Excel para importación
   */
  static generateExcelTemplate(): any {
    const template = [
      ['NOMBRE', 'CATEGORIA', 'PRECIO', 'PESO', 'METAL', 'DESCRIPCION', 'PROVEEDOR', 'COSTO', 'STOCK'],
      ['Anillo de Oro', 'ANILLOS', '1500000', '5.2', 'Oro 18k', 'Anillo con diamante', 'Proveedor A', '800000', '1'],
      ['Collar de Plata', 'COLLARES', '450000', '12.5', 'Plata 925', 'Collar con perlas', 'Proveedor B', '250000', '2'],
      ['Pulsera Elegante', 'PULSERAS', '890000', '8.3', 'Oro 14k', 'Pulsera con zircones', 'Proveedor C', '500000', '1']
    ];

    return template;
  }

  /**
   * Exporta plantilla a archivo Excel
   */
  static async exportTemplate(outputPath?: string): Promise<string> {
    try {
      const template = ExcelImportService.generateExcelTemplate();
      const worksheet = XLSX.utils.aoa_to_sheet(template);
      const workbook = XLSX.utils.book_new();
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

      const fileName = outputPath || path.join(
        'C:\\ProgramData\\SistemaPOS\\EXPORTACIONES',
        `plantilla_productos_${Date.now()}.xlsx`
      );

      XLSX.writeFile(workbook, fileName);

      return fileName;
    } catch (error) {
      console.error('Error exportando plantilla:', error);
      throw error;
    }
  }
}