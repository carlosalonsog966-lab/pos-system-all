import JsBarcode from 'jsbarcode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { OfflineStorageService } from './OfflineStorageService';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface ProductBarcode {
  codigo: string;
  nombre: string;
  categoria: string;
  precio: number;
  barcode: string;
  fechaGeneracion: string;
}

export class BarcodeService {
  private static readonly BARCODE_PATH = 'C:\\ProgramData\\SistemaPOS\\EXPORTACIONES\\CODIGOS_BARRAS';
  private static readonly ETIQUETAS_PATH = 'C:\\ProgramData\\SistemaPOS\\EXPORTACIONES\\ETIQUETAS';

  /**
   * Genera un código único para productos de joyería
   */
  static generateProductCode(categoria: string, index?: number): string {
    const prefijos = {
      'ANILLOS': 'AN',
      'COLLARES': 'CO',
      'PULSERAS': 'PU',
      'ARETES': 'AR',
      'RELOJES': 'RE',
      'OTROS': 'OT'
    };

    const prefijo = prefijos[categoria.toUpperCase() as keyof typeof prefijos] || 'OT';
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos
    const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `${prefijo}${timestamp}${randomNum}`;
  }

  /**
   * Genera código de barras en formato SVG
   */
  static generateBarcodeSVG(code: string): string {
    try {
      // Crear un canvas virtual para generar el SVG
      const canvas = {
        getContext: () => ({
          fillRect: () => {},
          fillText: () => {},
          measureText: () => ({ width: 0 })
        })
      };

      let svgString = '';
      
      // Configurar JsBarcode para generar SVG
      JsBarcode(canvas as any, code, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        textAlign: 'center',
        textPosition: 'bottom',
        background: '#ffffff',
        lineColor: '#000000'
      });

      // Generar SVG manualmente para mayor control
      svgString = `
        <svg width="150" height="70" xmlns="http://www.w3.org/2000/svg">
          <rect width="150" height="70" fill="white"/>
          <g transform="translate(10, 10)">
            ${BarcodeService.generateBarcodePattern(code)}
          </g>
          <text x="75" y="65" text-anchor="middle" font-family="Arial" font-size="10" fill="black">${code}</text>
        </svg>
      `;

      return svgString;
    } catch (error) {
      console.error('Error generando código de barras:', error);
      throw error;
    }
  }

  /**
   * Genera el patrón de barras para CODE128
   */
  private static generateBarcodePattern(code: string): string {
    // Implementación simplificada de CODE128
    const patterns = {
      '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10010011000',
      '4': '10010001100', '5': '10001001100', '6': '10011001000', '7': '10011000100',
      '8': '10001100100', '9': '11001001000', 'A': '11001000100', 'B': '11000100100'
    };

    let barcodePattern = '';
    let x = 0;

    for (const char of code) {
      const pattern = patterns[char as keyof typeof patterns] || patterns['0'];
      
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') {
          barcodePattern += `<rect x="${x}" y="0" width="1" height="40" fill="black"/>`;
        }
        x += 1;
      }
      x += 2; // Espacio entre caracteres
    }

    return barcodePattern;
  }

  /**
   * Guarda código de barras como archivo SVG
   */
  static async saveBarcodeFile(product: ProductBarcode): Promise<string> {
    try {
      await mkdir(BarcodeService.BARCODE_PATH, { recursive: true });

      const svgContent = BarcodeService.generateBarcodeSVG(product.barcode);
      const filename = `${product.codigo}_barcode.svg`;
      const filePath = path.join(BarcodeService.BARCODE_PATH, filename);

      await writeFile(filePath, svgContent, 'utf8');

      return filePath;
    } catch (error) {
      console.error('Error guardando archivo de código de barras:', error);
      throw error;
    }
  }

  /**
   * Genera etiqueta completa para producto de joyería
   */
  static generateProductLabel(product: any): string {
    const barcodeSVG = BarcodeService.generateBarcodeSVG(product.codigo);
    
    const labelSVG = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo blanco -->
        <rect width="300" height="200" fill="white" stroke="black" stroke-width="1"/>
        
        <!-- Título de la tienda -->
        <text x="150" y="20" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="black">
          JOYERÍA DE LUJO
        </text>
        
        <!-- Línea separadora -->
        <line x1="20" y1="25" x2="280" y2="25" stroke="black" stroke-width="0.5"/>
        
        <!-- Información del producto -->
        <text x="25" y="45" font-family="Arial" font-size="12" font-weight="bold" fill="black">
          ${product.nombre || 'Producto'}
        </text>
        
        <text x="25" y="60" font-family="Arial" font-size="10" fill="black">
          Categoría: ${product.categoria || 'N/A'}
        </text>
        
        <text x="25" y="75" font-family="Arial" font-size="10" fill="black">
          Código: ${product.codigo}
        </text>
        
        ${product.peso ? `<text x="25" y="90" font-family="Arial" font-size="10" fill="black">Peso: ${product.peso}g</text>` : ''}
        
        ${product.metal ? `<text x="25" y="105" font-family="Arial" font-size="10" fill="black">Metal: ${product.metal}</text>` : ''}
        
        <!-- Precio -->
        <text x="25" y="130" font-family="Arial" font-size="16" font-weight="bold" fill="red">
          $${product.precio?.toLocaleString() || '0'}
        </text>
        
        <!-- Código de barras -->
        <g transform="translate(75, 140)">
          ${BarcodeService.generateBarcodePattern(product.codigo)}
          <text x="75" y="55" text-anchor="middle" font-family="Arial" font-size="8" fill="black">${product.codigo}</text>
        </g>
        
        <!-- Fecha -->
        <text x="280" y="195" text-anchor="end" font-family="Arial" font-size="8" fill="gray">
          ${new Date().toLocaleDateString()}
        </text>
      </svg>
    `;

    return labelSVG;
  }

  /**
   * Guarda etiqueta de producto
   */
  static async saveProductLabel(product: any): Promise<string> {
    try {
      await mkdir(BarcodeService.ETIQUETAS_PATH, { recursive: true });

      const labelSVG = BarcodeService.generateProductLabel(product);
      const filename = `${product.codigo}_etiqueta.svg`;
      const filePath = path.join(BarcodeService.ETIQUETAS_PATH, filename);

      await writeFile(filePath, labelSVG, 'utf8');

      return filePath;
    } catch (error) {
      console.error('Error guardando etiqueta de producto:', error);
      throw error;
    }
  }

  static generateAssetLabel(product: any, asset: any): string {
    const code = product?.codigo || product?.code || ''
    const serial = asset?.serial || ''
    const barcodeSVG = BarcodeService.generateBarcodeSVG(code)
    const labelSVG = `
      <svg width="300" height="220" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="220" fill="white" stroke="black" stroke-width="1"/>
        <text x="150" y="20" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="black">JOYERÍA DE LUJO</text>
        <line x1="20" y1="25" x2="280" y2="25" stroke="black" stroke-width="0.5"/>
        <text x="25" y="45" font-family="Arial" font-size="12" font-weight="bold" fill="black">${product?.nombre || product?.name || 'Producto'}</text>
        <text x="25" y="60" font-family="Arial" font-size="10" fill="black">Categoría: ${product?.categoria || product?.category || 'N/A'}</text>
        <text x="25" y="75" font-family="Arial" font-size="10" fill="black">Código: ${code}</text>
        <text x="25" y="90" font-family="Arial" font-size="10" fill="black">Serial: ${serial}</text>
        ${product?.peso ? `<text x="25" y="105" font-family="Arial" font-size="10" fill="black">Peso: ${product.peso}g</text>` : ''}
        ${product?.metal ? `<text x="25" y="120" font-family="Arial" font-size="10" fill="black">Metal: ${product.metal}</text>` : ''}
        ${asset?.hallmark ? `<text x="25" y="135" font-family="Arial" font-size="10" fill="black">Hallmark: ${asset.hallmark}</text>` : ''}
        <text x="25" y="150" font-family="Arial" font-size="14" font-weight="bold" fill="red">$${(product?.precio ?? product?.salePrice ?? 0).toLocaleString?.() || String(product?.precio ?? product?.salePrice ?? 0)}</text>
        <g transform="translate(75, 160)">
          ${BarcodeService.generateBarcodePattern(code)}
          <text x="75" y="55" text-anchor="middle" font-family="Arial" font-size="8" fill="black">${code}</text>
        </g>
        <text x="280" y="210" text-anchor="end" font-family="Arial" font-size="8" fill="gray">${new Date().toLocaleDateString()}</text>
      </svg>
    `
    return labelSVG
  }

  static generateVitrineLabel(product: any, asset?: any): string {
    const code = product?.codigo || product?.code || ''
    const brand = product?.brand || product?.marca || ''
    const metal = product?.metal || ''
    const purity = product?.metalPurity || ''
    const stone = product?.stoneType || ''
    const clarity = product?.stoneClarity || ''
    const carat = product?.stoneCarat ?? ''
    const serial = asset?.serial || ''
    const price = product?.precio ?? product?.salePrice ?? 0
    const labelSVG = `
      <svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="240" fill="white" stroke="black" stroke-width="1"/>
        <text x="160" y="20" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold">JOYERÍA DE LUJO</text>
        <line x1="20" y1="26" x2="300" y2="26" stroke="black" stroke-width="0.5"/>
        <text x="24" y="48" font-family="Arial" font-size="12" font-weight="bold">${product?.nombre || product?.name || 'Producto'}</text>
        ${brand ? `<text x="24" y="64" font-family="Arial" font-size="11">Marca: ${brand}</text>` : ''}
        <text x="24" y="80" font-family="Arial" font-size="11">Metal: ${metal || 'N/A'}${purity ? ` ${purity}` : ''}</text>
        ${stone ? `<text x="24" y="96" font-family="Arial" font-size="11">Gema: ${stone}${carat ? ` ${carat}ct` : ''}${clarity ? ` ${clarity}` : ''}</text>` : ''}
        ${serial ? `<text x="24" y="112" font-family="Arial" font-size="11">Serial: ${serial}</text>` : ''}
        <text x="24" y="136" font-family="Arial" font-size="16" font-weight="bold" fill="red">$${(price).toLocaleString?.() || String(price)}</text>
        <g transform="translate(85, 160)">
          ${BarcodeService.generateBarcodePattern(code)}
          <text x="75" y="55" text-anchor="middle" font-family="Arial" font-size="8">${code}</text>
        </g>
        <text x="300" y="230" text-anchor="end" font-family="Arial" font-size="9" fill="gray">${new Date().toLocaleDateString()}</text>
      </svg>
    `
    return labelSVG
  }

  static async saveVitrineLabel(product: any, asset?: any): Promise<string> {
    await mkdir(BarcodeService.ETIQUETAS_PATH, { recursive: true })
    const labelSVG = BarcodeService.generateVitrineLabel(product, asset)
    const code = product?.codigo || product?.code || 'code'
    const serial = asset?.serial || 'vitrine'
    const filename = `${code}_${serial}_vitrina.svg`
    const filePath = path.join(BarcodeService.ETIQUETAS_PATH, filename)
    await writeFile(filePath, labelSVG, 'utf8')
    return filePath
  }

  static async saveAssetLabel(product: any, asset: any): Promise<string> {
    await mkdir(BarcodeService.ETIQUETAS_PATH, { recursive: true })
    const labelSVG = BarcodeService.generateAssetLabel(product, asset)
    const code = product?.codigo || product?.code || 'code'
    const serial = asset?.serial || 'serial'
    const filename = `${code}_${serial}_etiqueta.svg`
    const filePath = path.join(BarcodeService.ETIQUETAS_PATH, filename)
    await writeFile(filePath, labelSVG, 'utf8')
    return filePath
  }

  /**
   * Genera códigos de barras para múltiples productos
   */
  static async generateBulkBarcodes(products: any[]): Promise<string[]> {
    const results: string[] = [];

    for (const product of products) {
      try {
        // Generar código si no existe
        if (!product.codigo) {
          product.codigo = BarcodeService.generateProductCode(product.categoria || 'OTROS');
        }

        // Guardar código de barras
        const barcodePath = await BarcodeService.saveBarcodeFile({
          codigo: product.codigo,
          nombre: product.nombre,
          categoria: product.categoria,
          precio: product.precio,
          barcode: product.codigo,
          fechaGeneracion: new Date().toISOString()
        });

        // Guardar etiqueta
        const labelPath = await BarcodeService.saveProductLabel(product);

        results.push(barcodePath);
        results.push(labelPath);

        // Guardar producto actualizado
        await OfflineStorageService.saveProduct(product);

      } catch (error) {
        console.error(`Error procesando producto ${product.nombre}:`, error);
      }
    }

    return results;
  }

  /**
   * Valida formato de código de barras
   */
  static validateBarcodeFormat(code: string): boolean {
    // Validar que el código tenga el formato correcto
    const regex = /^(AN|CO|PU|AR|RE|OT)\d{8}$/;
    return regex.test(code);
  }

  /**
   * Obtiene información del código de barras
   */
  static decodeBarcodeInfo(code: string): any {
    if (!BarcodeService.validateBarcodeFormat(code)) {
      return null;
    }

    const prefijo = code.substring(0, 2);
    const timestamp = code.substring(2, 8);
    const random = code.substring(8, 10);

    const categorias = {
      'AN': 'ANILLOS',
      'CO': 'COLLARES', 
      'PU': 'PULSERAS',
      'AR': 'ARETES',
      'RE': 'RELOJES',
      'OT': 'OTROS'
    };

    return {
      categoria: categorias[prefijo as keyof typeof categorias],
      timestamp,
      random,
      fechaGeneracion: new Date(parseInt(timestamp) * 1000).toISOString()
    };
  }
}
