import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import { ExportsIntegrityService } from './ExportsIntegrityService';
import path from 'path';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Product } from '../models/Product';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { logger } from '../middleware/logger';
import { SettingsService } from './settingsService';

interface TicketData {
  sale: Sale & {
    items?: (SaleItem & { product?: Product })[];
    client?: Client;
    user?: User;
  };
  storeInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    currency?: string;
    footer?: string;
    logoPath?: string;
  };
}

export class TicketService {
  private static readonly TICKET_WIDTH = 297.64; // A6 width in points (105mm)
  private static readonly TICKET_HEIGHT = 419.53; // A6 height in points (148mm)
  private static readonly MARGIN = 20;
  private static readonly LINE_HEIGHT = 12;
  private static readonly serviceLogger = logger;

  /**
   * Genera un código QR como buffer de imagen
   */
  private static async generateQRCode(data: string, size: number = 100): Promise<Buffer> {
    try {
      TicketService.serviceLogger.debug('Generating QR code', { dataLength: data.length, size });
       
       const qrBuffer = await QRCode.toBuffer(data, {
         type: 'png',
         width: size,
         margin: 1,
         color: {
           dark: '#000000',
           light: '#FFFFFF'
         }
       });
       
       TicketService.serviceLogger.debug('QR code generated successfully', { bufferSize: qrBuffer.length });
      return qrBuffer;
    } catch (error) {
      TicketService.serviceLogger.error('Error generating QR code', { 
         error: error instanceof Error ? error.message : 'Unknown error',
         data: data.substring(0, 50) + '...'
       });
      throw error;
    }
  }

  /**
   * Genera un código de barras como buffer de imagen
   */
  private static async generateBarcode(code: string, width: number = 200, height: number = 50): Promise<Buffer> {
    try {
      TicketService.serviceLogger.debug('Generating barcode', { code, width, height });
      
      const canvas = createCanvas(width, height);
      
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2,
        height: height - 10,
        displayValue: true,
        fontSize: 12,
        textMargin: 2,
        margin: 5
      });
      
      const buffer = canvas.toBuffer('image/png');
      TicketService.serviceLogger.debug('Barcode generated successfully', { bufferSize: buffer.length });
       return buffer;
     } catch (error) {
       TicketService.serviceLogger.error('Error generating barcode', { 
         error: error instanceof Error ? error.message : 'Unknown error',
         code
       });
      throw error;
    }
  }

  static async generateTicketPDF(
    saleId: string,
    options?: {
      locale?: string;
      template?: { compact?: boolean; includeLogo?: boolean; showCareTips?: boolean };
    }
  ): Promise<Buffer> {
    try {
      TicketService.serviceLogger.info('Starting ticket PDF generation', { saleId });
      // Obtener datos de la venta
      const sale = await Sale.findByPk(saleId, {
        include: [
          {
            model: SaleItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product'
              }
            ]
          },
          {
            model: Client,
            as: 'client'
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      if (!sale) {
        throw new Error('Venta no encontrada');
      }

      // Cargar información de la tienda desde SettingsService
      const settings = await SettingsService.getSettings();
      const storeInfo = {
        name: settings.companyName || 'Mi Empresa',
        address: settings.companyAddress || '',
        phone: settings.companyPhone || '',
        email: settings.companyEmail || '',
        taxId: settings.companyTaxId || '',
        currency: settings.currency || 'COP',
        footer: settings.receiptFooter || undefined,
        logoPath: settings.companyLogo || undefined,
      };

      const ticketData: TicketData = { sale, storeInfo };

      return await this.createPDFTicket(ticketData, options);
    } catch (error) {
      TicketService.serviceLogger.error('Error generating ticket PDF', { 
         error: error instanceof Error ? error.message : 'Unknown error',
         saleId 
       });
      throw new Error(`Error generando ticket PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  private static async createPDFTicket(
    data: TicketData,
    options?: {
      locale?: string;
      template?: { compact?: boolean; includeLogo?: boolean; showCareTips?: boolean };
    }
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [this.TICKET_WIDTH, this.TICKET_HEIGHT],
          margins: {
            top: this.MARGIN,
            bottom: this.MARGIN,
            left: this.MARGIN,
            right: this.MARGIN
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        let currentY = this.MARGIN;
        const settings = await SettingsService.getSettings();
        const locale = options?.locale || settings.locale || 'es-CO';
        const compact = options?.template?.compact === true;
        const includeLogo = options?.template?.includeLogo !== false;
        const showCareTips = options?.template?.showCareTips === true;

        // Header - Información de la tienda
        // Logo opcional
        if (includeLogo && data.storeInfo.logoPath) {
          try {
            const logoAbsPath = path.isAbsolute(data.storeInfo.logoPath)
              ? data.storeInfo.logoPath
              : path.join(process.cwd(), data.storeInfo.logoPath);
            const logoBuffer = await fs.readFile(logoAbsPath);
            const logoWidth = compact ? 70 : 80;
            const logoX = (this.TICKET_WIDTH - logoWidth) / 2;
            doc.image(logoBuffer, logoX, currentY, { width: logoWidth });
            currentY += compact ? 40 : 50;
          } catch (error) {
            TicketService.serviceLogger.warn('Failed to load company logo, continuing without it', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        doc.fontSize(compact ? 13 : 14).font('Helvetica-Bold');
        currentY = this.addCenteredText(doc, data.storeInfo.name, currentY);
        currentY += compact ? 3 : 5;

        doc.fontSize(compact ? 7 : 8).font('Helvetica');
        currentY = this.addCenteredText(doc, data.storeInfo.address, currentY);
        currentY = this.addCenteredText(doc, data.storeInfo.phone, currentY);
        currentY = this.addCenteredText(doc, data.storeInfo.email, currentY);
        if (data.storeInfo.taxId && data.storeInfo.taxId.trim() !== '') {
          currentY = this.addCenteredText(doc, data.storeInfo.taxId, currentY);
        }
        currentY += compact ? 6 : 10;

        // Línea separadora
        doc.moveTo(this.MARGIN, currentY)
           .lineTo(this.TICKET_WIDTH - this.MARGIN, currentY)
           .stroke();
        currentY += 10;

        // Información de la venta
        doc.fontSize(compact ? 9 : 10).font('Helvetica-Bold');
        currentY = this.addCenteredText(doc, 'TICKET DE VENTA', currentY);
        currentY += compact ? 3 : 5;

        doc.fontSize(compact ? 7 : 8).font('Helvetica');
        currentY = this.addText(doc, `Ticket: ${data.sale.saleNumber}`, this.MARGIN, currentY);
        currentY = this.addText(doc, `Fecha: ${new Date(data.sale.saleDate).toLocaleString(locale)}`, this.MARGIN, currentY);
        
        if (data.sale.client) {
          currentY = this.addText(doc, `Cliente: ${data.sale.client.firstName} ${data.sale.client.lastName}`, this.MARGIN, currentY);
        }
        
        if (data.sale.user) {
          currentY = this.addText(doc, `Vendedor: ${data.sale.user.username}`, this.MARGIN, currentY);
        }
        
        currentY += 5;

        // Línea separadora
        doc.moveTo(this.MARGIN, currentY)
           .lineTo(this.TICKET_WIDTH - this.MARGIN, currentY)
           .stroke();
        currentY += 8;

        // Headers de joyas
        doc.fontSize(compact ? 6 : 7).font('Helvetica-Bold');
        const colWidths = {
          qty: 20,
          name: 100,
          price: 35,
          total: 40
        };

        let x = this.MARGIN;
        doc.text('Cant', x, currentY, { width: colWidths.qty, align: 'center' });
        x += colWidths.qty;
        doc.text('Joya', x, currentY, { width: colWidths.name, align: 'left' });
        x += colWidths.name;
        doc.text('Precio', x, currentY, { width: colWidths.price, align: 'right' });
        x += colWidths.price;
        doc.text('Total', x, currentY, { width: colWidths.total, align: 'right' });
        currentY += this.LINE_HEIGHT;

        // Línea separadora
        doc.moveTo(this.MARGIN, currentY)
           .lineTo(this.TICKET_WIDTH - this.MARGIN, currentY)
           .stroke();
        currentY += compact ? 3 : 5;

        // Items de la venta
        doc.fontSize(7).font('Helvetica');
        if (data.sale.items) {
          for (const item of data.sale.items) {
            x = this.MARGIN;
            
            // Cantidad
            doc.text(item.quantity.toString(), x, currentY, { width: colWidths.qty, align: 'center' });
            x += colWidths.qty;
            
            // Nombre de la joya
            const jewelryName = item.product?.name || 'Joya';
            doc.text(jewelryName, x, currentY, { width: colWidths.name, align: 'left' });
            x += colWidths.name;
            
            // Precio unitario
        doc.text(this.formatCurrency(item.unitPrice, data.storeInfo.currency, locale), x, currentY, { width: colWidths.price, align: 'right' });
            x += colWidths.price;
            
            // Total del item
        doc.text(this.formatCurrency(item.total, data.storeInfo.currency, locale), x, currentY, { width: colWidths.total, align: 'right' });
            
            currentY += this.LINE_HEIGHT;

            // Detalles específicos de joyería
            if (item.product) {
              const jewelryDetails = this.getJewelryDetails(item.product);
              if (jewelryDetails.length > 0) {
                doc.fontSize(6).font('Helvetica');
                for (const detail of jewelryDetails) {
                  currentY = this.addText(doc, `  ${detail}`, this.MARGIN + colWidths.qty, currentY - 2);
                }
                currentY += 2;
              }
            }
          }
        }

        currentY += 5;

        // Línea separadora
        doc.moveTo(this.MARGIN, currentY)
           .lineTo(this.TICKET_WIDTH - this.MARGIN, currentY)
           .stroke();
        currentY += 8;

        // Totales
        doc.fontSize(8).font('Helvetica');
        const totalsX = this.TICKET_WIDTH - this.MARGIN - 80;
        
        currentY = this.addText(doc, `Subtotal: ${this.formatCurrency(data.sale.subtotal, data.storeInfo.currency, locale)}`, totalsX, currentY);
        
        if (data.sale.discountAmount > 0) {
        currentY = this.addText(doc, `Descuento: ${this.formatCurrency(data.sale.discountAmount, data.storeInfo.currency, locale)}`, totalsX, currentY);
        }
        
        if (data.sale.taxAmount > 0) {
        currentY = this.addText(doc, `IVA: ${this.formatCurrency(data.sale.taxAmount, data.storeInfo.currency, locale)}`, totalsX, currentY);
        }

        // Total final
        doc.fontSize(10).font('Helvetica-Bold');
        currentY = this.addText(doc, `TOTAL: ${this.formatCurrency(data.sale.total, data.storeInfo.currency, locale)}`, totalsX, currentY);
        currentY += 5;

        // Método de pago
        doc.fontSize(8).font('Helvetica');
        const paymentMethodText = this.getPaymentMethodText(data.sale.paymentMethod);
        currentY = this.addText(doc, `Método de pago: ${paymentMethodText}`, this.MARGIN, currentY);

        // Referencias de pago (tarjeta/transferencia) si existen
        doc.fontSize(8).font('Helvetica');
        if (data.sale.cardReference) {
          currentY = this.addText(doc, `Autorización Tarjeta: ${data.sale.cardReference}`, this.MARGIN, currentY);
        }
        if (data.sale.transferReference) {
          currentY = this.addText(doc, `Referencia Transferencia: ${data.sale.transferReference}`, this.MARGIN, currentY);
        }
        currentY += 10;

        // Línea separadora
        doc.moveTo(this.MARGIN, currentY)
           .lineTo(this.TICKET_WIDTH - this.MARGIN, currentY)
           .stroke();
        currentY += 10;

        // Footer
        doc.fontSize(7).font('Helvetica');
        currentY = this.addCenteredText(doc, '¡Gracias por su compra!', currentY);
        currentY = this.addCenteredText(doc, 'Conserve este ticket como comprobante', currentY);
        currentY += 3;
        currentY = this.addCenteredText(doc, 'Garantía válida presentando este ticket', currentY);
        currentY = this.addCenteredText(doc, 'Cuidados: Evite contacto con químicos', currentY);
        currentY = this.addCenteredText(doc, 'Limpie con paño suave y seco', currentY);
        
        if (data.sale.notes) {
          currentY += 5;
          currentY = this.addCenteredText(doc, `Notas: ${data.sale.notes}`, currentY);
        }

        // Generar y agregar código de barras para el número de ticket
        try {
          currentY += 10;
          const barcodeBuffer = await this.generateBarcode(data.sale.saleNumber, 180, 40);
          const barcodeX = (this.TICKET_WIDTH - 180) / 2;
          doc.image(barcodeBuffer, barcodeX, currentY, { width: 180, height: 40 });
          currentY += 45;
        } catch (error) {
          TicketService.serviceLogger.warn('Failed to generate barcode, continuing without it', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        // Generar y agregar código QR con información de la venta
        try {
          const qrData = JSON.stringify({
            ticket: data.sale.saleNumber,
            fecha: data.sale.saleDate,
            total: data.sale.total,
            tienda: data.storeInfo.name,
            verificacion: `${data.sale.id}-${data.sale.saleNumber}`
          });
          
          const qrBuffer = await this.generateQRCode(qrData, 80);
          const qrX = (this.TICKET_WIDTH - 80) / 2;
          doc.image(qrBuffer, qrX, currentY, { width: 80, height: 80 });
          currentY += 85;
          
          currentY = this.addCenteredText(doc, 'Escanea para verificar autenticidad', currentY);
        } catch (error) {
          TicketService.serviceLogger.warn('Failed to generate QR code, continuing without it', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }

        // Footer opcional de recibo
        if (data.storeInfo.footer && data.storeInfo.footer.trim() !== '') {
          currentY += 10;
          doc.fontSize(8).font('Helvetica-Oblique');
          currentY = this.addCenteredText(doc, data.storeInfo.footer, currentY);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static addText(doc: PDFKit.PDFDocument, text: string, x: number, y: number): number {
    doc.text(text, x, y);
    return y + this.LINE_HEIGHT;
  }

  private static addCenteredText(doc: PDFKit.PDFDocument, text: string, y: number): number {
    const textWidth = doc.widthOfString(text);
    const x = (this.TICKET_WIDTH - textWidth) / 2;
    doc.text(text, x, y);
    return y + this.LINE_HEIGHT;
  }

  private static formatCurrency(amount: number, currency: string = 'COP', locale: string = 'es-CO'): string {
    try {
      return new Intl.NumberFormat(locale || 'es-CO', {
        style: 'currency',
        currency: currency || 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      // Fallback simple si la moneda no es soportada
      return `${amount.toFixed(0)} ${currency}`;
    }
  }

  private static getPaymentMethodText(method: string): string {
    const methods: { [key: string]: string } = {
      'cash': 'Efectivo',
      'card': 'Tarjeta',
      'transfer': 'Transferencia',
      'mixed': 'Mixto'
    };
    return methods[method] || method;
  }

  private static getJewelryDetails(product: any): string[] {
    const details: string[] = [];

    // Categoría y material
    if (product.category) {
      details.push(`Categoría: ${product.category}`);
    }

    // Metal y pureza
    if (product.metal && product.metalPurity) {
      details.push(`Metal: ${product.metal} ${product.metalPurity}`);
    } else if (product.metal) {
      details.push(`Metal: ${product.metal}`);
    } else if (product.material && product.purity) {
      details.push(`Material: ${product.material} ${product.purity}`);
    } else if (product.material) {
      details.push(`Material: ${product.material}`);
    }

    // Peso
    if (product.grams) {
      details.push(`Peso: ${product.grams}g`);
    } else if (product.weight) {
      details.push(`Peso: ${product.weight}g`);
    }

    // Talla de anillo
    if (product.ringSize) {
      details.push(`Talla: ${product.ringSize}`);
    } else if (product.size && product.category?.toLowerCase().includes('anillo')) {
      details.push(`Talla: ${product.size}`);
    }

    // Longitud de cadena
    if (product.chainLengthCm) {
      details.push(`Longitud: ${product.chainLengthCm}cm`);
    } else if (product.size && (product.category?.toLowerCase().includes('cadena') || product.category?.toLowerCase().includes('collar'))) {
      details.push(`Longitud: ${product.size}`);
    }

    // Información de piedras
    if (product.stoneType) {
      let stoneInfo = `Piedra: ${product.stoneType}`;
      if (product.stoneCarat) {
        stoneInfo += ` (${product.stoneCarat}ct)`;
      }
      if (product.stoneColor) {
        stoneInfo += ` - ${product.stoneColor}`;
      }
      if (product.stoneCut) {
        stoneInfo += ` - Corte ${product.stoneCut}`;
      }
      details.push(stoneInfo);
    }

    // Color
    if (product.color && !product.stoneColor) {
      details.push(`Color: ${product.color}`);
    }

    // Acabado
    if (product.finish) {
      details.push(`Acabado: ${product.finish}`);
    }

    // Baño/Recubrimiento
    if (product.plating) {
      details.push(`Baño: ${product.plating}`);
    }

    // Colección
    if (product.collection) {
      details.push(`Colección: ${product.collection}`);
    }

    // Género
    if (product.gender) {
      details.push(`Género: ${product.gender}`);
    }

    // Pieza única
    if (product.isUniquePiece) {
      details.push('Pieza Única');
    }

    // Garantía
    if (product.warrantyMonths && product.warrantyMonths > 0) {
      details.push(`Garantía: ${product.warrantyMonths} meses`);
    }

    // Sello/Marca
    if (product.hallmark) {
      details.push(`Sello: ${product.hallmark}`);
    }

    // Código de barras
    if (product.barcode) {
      details.push(`Código: ${product.barcode}`);
    }

    return details;
  }

  static async saveTicketToFile(
    saleId: string,
    options?: {
      locale?: string;
      template?: { compact?: boolean; includeLogo?: boolean; showCareTips?: boolean };
    }
  ): Promise<string> {
    try {
      const pdfBuffer = await this.generateTicketPDF(saleId, options);
      
      // Crear directorio si no existe
      const base = ExportsIntegrityService.getExportsBasePath();
      const ticketsDir = path.join(base, 'tickets');
      await fs.mkdir(ticketsDir, { recursive: true });
      
      // Generar nombre de archivo único
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ticket-${saleId}-${timestamp}.pdf`;
      const filepath = path.join(ticketsDir, filename);
      
      // Guardar archivo
      await fs.writeFile(filepath, pdfBuffer);
      
      // Registrar integridad en manifest de exports
      try {
        const { ExportsIntegrityService } = await import('./ExportsIntegrityService');
        ExportsIntegrityService.recordFile(filepath, 'ticket');
      } catch (e) {
        console.warn('[TicketService] No se pudo registrar manifest de integridad', (e as any)?.message);
      }

      return filename;
    } catch (error) {
      throw new Error(`Error guardando ticket: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
}
