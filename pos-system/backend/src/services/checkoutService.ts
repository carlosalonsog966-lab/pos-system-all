import { Transaction, QueryTypes } from 'sequelize';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Product } from '../models/Product';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { TransactionService } from './transactionService';
import { IdempotencyService } from './idempotencyService';
import { 
  CheckoutInput, 
  CheckoutResponse, 
  StockValidationInput,
  validateCheckoutBusinessRules,
  checkoutSchema 
} from '../schemas/checkout';

export interface CheckoutStats {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalSold: number;
    revenue: number;
  }>;
}

export class CheckoutService {
  /**
   * Procesa un checkout completo con todas las validaciones y controles
   */
  static async processCheckout(
    userId: string,
    checkoutData: CheckoutInput
  ): Promise<CheckoutResponse> {
    // Validar esquema Zod
    const validatedData = checkoutSchema.parse(checkoutData);
    
    // Validar reglas de negocio
    const businessErrors = validateCheckoutBusinessRules(validatedData);
    if (businessErrors.length > 0) {
      throw new Error(`Errores de validación: ${businessErrors.join(', ')}`);
    }

    // Ejecutar con idempotencia
    return IdempotencyService.executeWithIdempotency(
      validatedData.idempotencyKey,
      'checkout',
      userId,
      validatedData,
      () => this.executeCheckout(userId, validatedData),
      { ttlMinutes: 30 }
    );
  }

  /**
   * Ejecuta el checkout dentro de una transacción
   */
  private static async executeCheckout(
    userId: string,
    data: CheckoutInput
  ): Promise<CheckoutResponse> {
    const result = await TransactionService.executeWithRetry(
      async (transaction: Transaction) => {
        // 1. Validar stock disponible
        await this.validateStock(data.items, transaction);
        
        // 2. Validar usuario
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        // 3. Validar cliente si se proporciona
        let client = null;
        if (data.clientId) {
          client = await Client.findByPk(data.clientId, { transaction });
          if (!client) {
            throw new Error('Cliente no encontrado');
          }
        }

        // 4. Calcular totales
        const calculations = await this.calculateTotals(data, transaction);
        
        // 5. Generar número de venta único
        const saleNumber = await this.generateSaleNumber(transaction);
        
        // 6. Crear la venta
        const sale = await Sale.create({
          saleNumber,
          clientId: data.clientId || undefined,
          userId,
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          discountAmount: calculations.discountAmount,
          total: calculations.total,
          paymentMethod: data.paymentMethod,
          notes: data.notes || undefined,
          status: 'completed',
        }, { transaction });

        // 7. Crear items de venta y actualizar stock
        const saleItems = await this.createSaleItems(sale.id, data.items, transaction);
        
        // 8. Actualizar estadísticas del cliente
        if (client) {
          await this.updateClientStats(client, calculations.total, transaction);
        }

        // 9. Aplicar descuentos de lealtad si corresponde
        if (data.applyLoyaltyDiscount && client) {
          await this.applyLoyaltyDiscount(client, calculations.total, transaction);
        }

        return {
          sale,
          saleItems,
          client,
          calculations,
        };
      },
      {
        maxRetries: 3,
        retryDelay: 1000,
        timeoutMs: 30000,
        logQueries: false,
      }
    );

    if (!result.success || !result.data) {
      throw result.error || new Error('Error en el checkout');
    }

    const { sale, saleItems, client } = result.data;

    // Construir respuesta
    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      subtotal: sale.subtotal,
      taxAmount: sale.taxAmount,
      discountAmount: sale.discountAmount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      status: sale.status as 'completed' | 'pending' | 'failed',
      items: saleItems.map(item => ({
        productId: item.productId,
        productName: item.product?.name || 'Producto',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      client: client ? {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`.trim(),
        email: client.email || undefined,
      } : undefined,
      createdAt: sale.createdAt,
      qrCode: undefined, // Se generará en el ticket service
      ticketUrl: undefined, // Se generará en el ticket service
    };
  }

  /**
   * Valida que hay stock suficiente para todos los productos
   */
  private static async validateStock(
    items: CheckoutInput['items'],
    transaction: Transaction
  ): Promise<void> {
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction });
      
      if (!product) {
        throw new Error(`Producto ${item.productId} no encontrado`);
      }
      
      if (!product.isActive) {
        throw new Error(`Producto ${product.name} no está activo`);
      }
      
      if (product.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para ${product.name}. ` +
          `Disponible: ${product.stock}, Solicitado: ${item.quantity}`
        );
      }

      // Validar precio unitario
      if (Math.abs(item.unitPrice - product.salePrice) > 0.01) {
        throw new Error(
          `Precio unitario incorrecto para ${product.name}. ` +
          `Esperado: ${product.salePrice}, Recibido: ${item.unitPrice}`
        );
      }
    }
  }

  /**
   * Calcula todos los totales de la venta
   */
  private static async calculateTotals(
    data: CheckoutInput,
    transaction: Transaction
  ): Promise<{
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
  }> {
    let subtotal = 0;

    // Calcular subtotal de items
    for (const item of data.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discountAmount || 0;
      subtotal += itemSubtotal - itemDiscount;
    }

    // Calcular descuento total
    let discountAmount = data.discountAmount;
    if (data.discountPercentage && data.discountPercentage > 0) {
      discountAmount = subtotal * (data.discountPercentage / 100);
    }

    // Aplicar descuento al subtotal
    const discountedSubtotal = subtotal - discountAmount;
    
    // Calcular impuestos sobre el subtotal con descuento
    const taxAmount = discountedSubtotal * data.taxRate;
    
    // Total final
    const total = discountedSubtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      total,
    };
  }

  /**
   * Genera un número de venta único
   */
  private static async generateSaleNumber(transaction: Transaction): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Buscar el último número del día
    const lastSale = await Sale.findOne({
      where: {
        saleNumber: {
          [require('sequelize').Op.like]: `SALE-${dateStr}%`
        }
      },
      order: [['saleNumber', 'DESC']],
      transaction,
    });

    let sequence = 1;
    if (lastSale) {
      const lastSequence = parseInt(lastSale.saleNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `SALE-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Crea los items de venta y actualiza el stock
   */
  private static async createSaleItems(
    saleId: string,
    items: CheckoutInput['items'],
    transaction: Transaction
  ): Promise<Array<SaleItem & { product?: Product }>> {
    const saleItems = [];

    for (const itemData of items) {
      const product = await Product.findByPk(itemData.productId, { transaction });
      
      if (!product) {
        throw new Error(`Producto ${itemData.productId} no encontrado`);
      }

      // Calcular totales del item
      const itemSubtotal = itemData.quantity * itemData.unitPrice;
      const itemDiscountAmount = itemData.discountAmount || 0;
      const itemTotal = itemSubtotal - itemDiscountAmount;

      // Crear item de venta
      const saleItem = await SaleItem.create({
        saleId,
        productId: itemData.productId,
        quantity: itemData.quantity,
        unitPrice: itemData.unitPrice,
        subtotal: itemSubtotal,
        discountAmount: itemDiscountAmount,
        total: itemTotal,

      }, { transaction });

      // Actualizar stock del producto
      await product.update({
        stock: product.stock - itemData.quantity,
      }, { transaction });

      // Agregar producto al item para la respuesta
      (saleItem as any).product = product;
      saleItems.push(saleItem as SaleItem & { product: Product });
    }

    return saleItems;
  }

  /**
   * Actualiza las estadísticas del cliente
   */
  private static async updateClientStats(
    client: Client,
    total: number,
    transaction: Transaction
  ): Promise<void> {
    const newTotalPurchases = (client.totalPurchases || 0) + total;

    await client.update({
      totalPurchases: newTotalPurchases,
      lastPurchaseDate: new Date(),
    }, { transaction });
  }

  /**
   * Aplica descuentos de lealtad
   */
  private static async applyLoyaltyDiscount(
    client: Client,
    total: number,
    transaction: Transaction
  ): Promise<void> {
    // Lógica de puntos de lealtad (ejemplo: 1% del total como puntos)
    const loyaltyPoints = Math.floor(total * 0.01);
    const currentPoints = client.loyaltyPoints || 0;

    await client.update({
      loyaltyPoints: currentPoints + loyaltyPoints,
    }, { transaction });
  }

  /**
   * Valida stock antes del checkout (sin transacción)
   */
  static async validateStockAvailability(data: StockValidationInput): Promise<{
    valid: boolean;
    errors: string[];
    stockInfo: Array<{
      productId: string;
      productName: string;
      requestedQuantity: number;
      availableStock: number;
      sufficient: boolean;
    }>;
  }> {
    const errors: string[] = [];
    const stockInfo = [];

    for (const item of data.items) {
      const product = await Product.findByPk(item.productId);
      
      if (!product) {
        errors.push(`Producto ${item.productId} no encontrado`);
        continue;
      }

      const sufficient = product.stock >= item.quantity;
      
      if (!sufficient) {
        errors.push(
          `Stock insuficiente para ${product.name}. ` +
          `Disponible: ${product.stock}, Solicitado: ${item.quantity}`
        );
      }

      stockInfo.push({
        productId: item.productId,
        productName: product.name,
        requestedQuantity: item.quantity,
        availableStock: product.stock,
        sufficient,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      stockInfo,
    };
  }

  /**
   * Obtiene estadísticas de checkout
   */
  static async getCheckoutStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<CheckoutStats> {
    const whereClause = [];
    const replacements: any = {};

    if (startDate) {
      whereClause.push('s.createdAt >= :startDate');
      replacements.startDate = startDate;
    }

    if (endDate) {
      whereClause.push('s.createdAt <= :endDate');
      replacements.endDate = endDate;
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [stats] = await Sale.sequelize!.query(`
      SELECT 
        COUNT(*) as totalSales,
        COALESCE(SUM(total), 0) as totalRevenue,
        COALESCE(AVG(total), 0) as averageOrderValue
      FROM sales s
      ${whereString}
    `, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    const topProducts = await Sale.sequelize!.query(`
      SELECT 
        si.productId,
        p.name as productName,
        SUM(si.quantity) as totalSold,
        SUM(si.total) as revenue
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      JOIN products p ON si.productId = p.id
      ${whereString}
      GROUP BY si.productId, p.name
      ORDER BY totalSold DESC
      LIMIT 10
    `, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    return {
      totalSales: stats?.totalSales || 0,
      totalRevenue: stats?.totalRevenue || 0,
      averageOrderValue: stats?.averageOrderValue || 0,
      topProducts: topProducts || [],
    };
  }
}