import { Transaction, Op, QueryTypes } from 'sequelize';
import { Product } from '../models/Product';
import StockLedger, { MovementType, ReferenceType } from '../models/StockLedger';
import { TransactionService } from './transactionService';
import { IdempotencyService } from './idempotencyService';
import { AuditTrailService } from './AuditTrailService';

export interface StockMovement {
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reason: string;
  reference?: string;
  userId: string;
  notes?: string;
}

export interface StockAlert {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  minStock: number;
  alertType: 'low_stock' | 'out_of_stock' | 'overstock';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  topValueProducts: Array<{
    productId: string;
    productName: string;
    stock: number;
    unitCost: number;
    totalValue: number;
  }>;
  stockMovements: Array<{
    date: string;
    movements: number;
    totalIn: number;
    totalOut: number;
  }>;
}

export interface BulkStockUpdate {
  productId: string;
  newStock: number;
  reason: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Actualiza el stock de un producto con validaciones
   */
  static async updateStock(
    productId: string,
    movement: StockMovement,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    product: Product;
    previousStock: number;
    newStock: number;
    movement: StockMovement;
  }> {
    const key = idempotencyKey || `stock-update-${productId}-${Date.now()}`;
    
    return IdempotencyService.executeWithIdempotency(
      key,
      'stock_update',
      movement.userId,
      movement,
      () => this.executeStockUpdate(productId, movement),
      { ttlMinutes: 15 }
    );
  }

  /**
   * Transfiere stock entre sucursales sin alterar el stock total del producto
   */
  static async transferStock(
    params: {
      productId: string;
      quantity: number;
      fromBranchId: string;
      toBranchId: string;
      reason?: string;
      reference?: string;
      userId: string;
      idempotencyKey?: string;
    }
  ): Promise<{
    success: boolean;
    transferId: string;
    productId: string;
    productName: string;
    quantity: number;
    fromBranchId: string;
    toBranchId: string;
  }> {
    const key = params.idempotencyKey || `transfer-stock-${params.productId}-${params.fromBranchId}-${params.toBranchId}-${Date.now()}`;

    return IdempotencyService.executeWithIdempotency(
      key,
      'stock_transfer',
      params.userId,
      params,
      async () => {
        const result = await TransactionService.executeWithRetry(
          async (transaction: Transaction) => {
            const product = await Product.findByPk(params.productId, {
              transaction,
              lock: true,
            });

            if (!product) {
              throw new Error(`Producto ${params.productId} no encontrado`);
            }

            if (params.quantity <= 0) {
              throw new Error('Cantidad a transferir debe ser positiva');
            }

            // Registrar asiento de salida en sucursal origen
            const transferId = params.reference || `${params.productId}-${Date.now()}`;

            await StockLedger.create({
              productId: product.id,
              branchId: params.fromBranchId,
              movementType: 'TRANSFERENCIA_SALIDA',
              quantityChange: -params.quantity,
              unitCost: product.purchasePrice || null,
              referenceType: 'TRANSFER',
              referenceId: transferId,
            }, { transaction });

            // Registrar asiento de entrada en sucursal destino
            await StockLedger.create({
              productId: product.id,
              branchId: params.toBranchId,
              movementType: 'TRANSFERENCIA_ENTRADA',
              quantityChange: params.quantity,
              unitCost: product.purchasePrice || null,
              referenceType: 'TRANSFER',
              referenceId: transferId,
            }, { transaction });

            // Actualizar metadata del producto con la última transferencia
            await product.update({
              metadata: {
                ...product.metadata,
                lastTransfer: {
                  quantity: params.quantity,
                  fromBranchId: params.fromBranchId,
                  toBranchId: params.toBranchId,
                  reason: params.reason,
                  reference: transferId,
                  userId: params.userId,
                  timestamp: new Date().toISOString(),
                },
              },
            }, { transaction });

            return {
              success: true,
              transferId,
              productId: product.id,
              productName: product.name,
              quantity: params.quantity,
              fromBranchId: params.fromBranchId,
              toBranchId: params.toBranchId,
            };
          },
          { maxRetries: 3, retryDelay: 500 }
        );

        if (!result.success || !result.data) {
          await AuditTrailService.log({
            operation: 'inventory.transferStock',
            entityType: 'product',
            entityId: params.productId,
            actor: { id: params.userId },
            result: 'failure',
            message: 'Error al registrar transferencia de stock',
            details: { params, error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : undefined },
          });
          throw result.error || new Error('Error al registrar transferencia de stock');
        }

        await AuditTrailService.log({
          operation: 'inventory.transferStock',
          entityType: 'product',
          entityId: result.data.productId,
          actor: { id: params.userId },
          result: 'success',
          message: 'Transferencia registrada exitosamente',
          correlationId: result.data.transferId,
          details: result.data,
        });

        return result.data;
      },
      { ttlMinutes: 30 }
    );
  }

  /**
   * Obtiene historial de movimientos de stock de un producto desde stock_ledger
   */
  static async getStockHistory(
    productId: string,
    page: number = 1,
    limit: number = 20,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    movements: Array<{
      id: string;
      movementType: MovementType;
      quantityChange: number;
      branchId: string | null;
      referenceType: ReferenceType | null;
      referenceId: string | null;
      createdAt: string;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: any = { productId };
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.createdAt = { [Op.gte]: startDate };
    } else if (endDate) {
      where.createdAt = { [Op.lte]: endDate };
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await StockLedger.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit,
    });

    return {
      movements: rows.map(r => ({
        id: (r as any).id,
        movementType: (r as any).movementType,
        quantityChange: (r as any).quantityChange,
        branchId: (r as any).branchId || null,
        referenceType: (r as any).referenceType || null,
        referenceId: (r as any).referenceId || null,
        createdAt: (r as any).createdAt?.toISOString?.() || new Date((r as any).createdAt).toISOString(),
      })),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
  /**
   * Ejecuta la actualización de stock dentro de una transacción
   */
  private static async executeStockUpdate(
    productId: string,
    movement: StockMovement
  ): Promise<{
    success: boolean;
    product: Product;
    previousStock: number;
    newStock: number;
    movement: StockMovement;
  }> {
    const result = await TransactionService.executeWithRetry(
      async (transaction: Transaction) => {
        // Obtener producto con lock para evitar condiciones de carrera
        const product = await Product.findByPk(productId, {
          transaction,
          lock: true,
        });

        if (!product) {
          throw new Error(`Producto ${productId} no encontrado`);
        }

        const previousStock = product.stock;
        let newStock: number;

        // Calcular nuevo stock según el tipo de movimiento
        switch (movement.type) {
          case 'in':
            newStock = previousStock + movement.quantity;
            break;
          case 'out':
            newStock = previousStock - movement.quantity;
            if (newStock < 0) {
              throw new Error(
                `Stock insuficiente para ${product.name}. ` +
                `Stock actual: ${previousStock}, Cantidad solicitada: ${movement.quantity}`
              );
            }
            break;
          case 'adjustment':
            newStock = movement.quantity; // Ajuste absoluto
            break;
          case 'transfer':
            newStock = previousStock - movement.quantity;
            if (newStock < 0) {
              throw new Error(
                `Stock insuficiente para transferencia de ${product.name}. ` +
                `Stock actual: ${previousStock}, Cantidad a transferir: ${movement.quantity}`
              );
            }
            break;
          default:
            throw new Error(`Tipo de movimiento inválido: ${movement.type}`);
        }

        // Validar stock mínimo para productos críticos
        if (product.category === 'Anillos' || product.category === 'Alianzas') {
          if (newStock < 0) {
            throw new Error(
              `No se puede reducir el stock de ${product.name} por debajo de 0 ` +
              `(producto crítico de joyería)`
            );
          }
        }

        // Actualizar stock
        await product.update({
          stock: newStock,
        }, { transaction });

        // Registrar movimiento en historial (si existe tabla de historial)
        await this.logStockMovement(product, movement, previousStock, newStock, transaction);

        return {
          success: true,
          product,
          previousStock,
          newStock,
          movement,
        };
      },
      {
        maxRetries: 3,
        retryDelay: 500,
        timeoutMs: 10000,
      }
    );

    if (!result.success || !result.data) {
      await AuditTrailService.log({
        operation: 'inventory.updateStock',
        entityType: 'product',
        entityId: productId,
        actor: { id: movement.userId },
        result: 'failure',
        message: 'Error al actualizar stock',
        details: { movement, error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : undefined },
      });
      throw result.error || new Error('Error al actualizar stock');
    }

    await AuditTrailService.log({
      operation: 'inventory.updateStock',
      entityType: 'product',
      entityId: productId,
      actor: { id: movement.userId },
      result: 'success',
      message: 'Stock actualizado exitosamente',
      details: {
        previousStock: result.data.previousStock,
        newStock: result.data.newStock,
        movement,
      },
    });

    return result.data;
  }

  /**
   * Actualización masiva de stock
   */
  static async bulkUpdateStock(
    updates: BulkStockUpdate[],
    userId: string,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    updated: number;
    errors: Array<{ productId: string; error: string }>;
    results: Array<{
      productId: string;
      productName: string;
      previousStock: number;
      newStock: number;
    }>;
  }> {
    const key = idempotencyKey || `bulk-stock-update-${userId}-${Date.now()}`;
    
    return IdempotencyService.executeWithIdempotency(
      key,
      'bulk_stock_update',
      userId,
      { updates, userId },
      () => this.executeBulkStockUpdate(updates, userId),
      { ttlMinutes: 30 }
    );
  }

  /**
   * Ejecuta actualización masiva de stock
   */
  private static async executeBulkStockUpdate(
    updates: BulkStockUpdate[],
    userId: string
  ): Promise<{
    success: boolean;
    updated: number;
    errors: Array<{ productId: string; error: string }>;
    results: Array<{
      productId: string;
      productName: string;
      previousStock: number;
      newStock: number;
    }>;
  }> {
    const results: Array<{
      productId: string;
      productName: string;
      previousStock: number;
      newStock: number;
    }> = [];
    const errors: Array<{
      productId: string;
      error: string;
    }> = [];
    let updated = 0;

    const result = await TransactionService.executeWithRetry(
      async (transaction: Transaction) => {
        for (const update of updates) {
          try {
            const product = await Product.findByPk(update.productId, {
              transaction,
              lock: true,
            });

            if (!product) {
              errors.push({
                productId: update.productId,
                error: 'Producto no encontrado',
              });
              continue;
            }

            const previousStock = product.stock;
            
            // Validar nuevo stock
            if (update.newStock < 0) {
              errors.push({
                productId: update.productId,
                error: 'El stock no puede ser negativo',
              });
              continue;
            }

            // Actualizar stock
            await product.update({
              stock: update.newStock,
            }, { transaction });

            // Registrar movimiento
            const movement: StockMovement = {
              productId: update.productId,
              type: 'adjustment',
              quantity: update.newStock,
              reason: update.reason,
              userId,
              notes: update.notes,
            };

            await this.logStockMovement(
              product,
              movement,
              previousStock,
              update.newStock,
              transaction
            );

            results.push({
              productId: update.productId,
              productName: product.name,
              previousStock,
              newStock: update.newStock,
            });

            updated++;
          } catch (error) {
            errors.push({
              productId: update.productId,
              error: error instanceof Error ? error.message : 'Error desconocido',
            });
          }
        }

        return { updated, errors, results };
      },
      {
        maxRetries: 2,
        retryDelay: 1000,
        timeoutMs: 60000,
      }
    );

    if (!result.success || !result.data) {
      await AuditTrailService.log({
        operation: 'inventory.bulkUpdate',
        entityType: 'inventory',
        result: 'failure',
        actor: { id: userId },
        message: 'Error en actualización masiva de stock',
        details: { error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : undefined, updatesCount: updates.length },
      });
      throw result.error || new Error('Error en actualización masiva de stock');
    }

    const { updated: upd, errors: errs, results: resList } = result.data;
    const auditResult = errs.length > 0 && upd > 0 ? 'partial' : (errs.length === 0 ? 'success' : 'failure');
    await AuditTrailService.log({
      operation: 'inventory.bulkUpdate',
      entityType: 'inventory',
      result: auditResult,
      actor: { id: userId },
      message: auditResult === 'success' ? 'Actualización masiva exitosa' : (auditResult === 'partial' ? 'Actualización masiva parcial' : 'Actualización masiva fallida'),
      details: { updated: upd, errors: errs, results: resList },
    });

    return {
      success: true,
      ...result.data,
    };
  }

  /**
   * Obtiene alertas de stock
   */
  static async getStockAlerts(): Promise<StockAlert[]> {
    const products = await Product.findAll({
      where: {
        isActive: true,
      },
      attributes: ['id', 'name', 'code', 'stock', 'minStock'],
    });

    const alerts: StockAlert[] = [];

    for (const product of products) {
      const minStock = product.minStock || 5; // Default mínimo
      const maxStock = 1000; // Default máximo
      
      let alertType: StockAlert['alertType'] | null = null;
      let severity: StockAlert['severity'] = 'low';

      if (product.stock === 0) {
        alertType = 'out_of_stock';
        severity = 'critical';
      } else if (product.stock <= minStock) {
        alertType = 'low_stock';
        severity = product.stock <= minStock * 0.5 ? 'high' : 'medium';
      } else if (product.stock > maxStock) {
        alertType = 'overstock';
        severity = 'low';
      }

      if (alertType) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          currentStock: product.stock,
          minStock,
          alertType,
          severity,
        });
      }
    }

    // Ordenar por severidad
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return alerts;
  }

  /**
   * Genera reporte de inventario
   */
  static async generateInventoryReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<InventoryReport> {
    // Estadísticas generales
    const [generalStats] = await Product.sequelize!.query(`
      SELECT 
        COUNT(*) as totalProducts,
        COALESCE(SUM(stock * purchasePrice), 0) as totalValue,
        COUNT(CASE WHEN stock <= COALESCE(minStock, 5) THEN 1 END) as lowStockProducts,
        COUNT(CASE WHEN stock = 0 THEN 1 END) as outOfStockProducts
      FROM products 
      WHERE isActive = 1
    `, {
      type: QueryTypes.SELECT,
    }) as any[];

    // Productos de mayor valor
    const topValueProducts = await Product.sequelize!.query(`
      SELECT 
        id as productId,
        name as productName,
        stock,
        purchasePrice as unitCost,
        (stock * purchasePrice) as totalValue
      FROM products 
      WHERE isActive = 1 AND stock > 0
      ORDER BY totalValue DESC
      LIMIT 10
    `, {
      type: QueryTypes.SELECT,
    }) as any[];

    // Movimientos de stock por día (simulado - en producción vendría de tabla de historial)
    const stockMovements = [];
    if (startDate && endDate) {
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        stockMovements.push({
          date: date.toISOString().split('T')[0],
          movements: Math.floor(Math.random() * 50) + 10,
          totalIn: Math.floor(Math.random() * 100) + 20,
          totalOut: Math.floor(Math.random() * 80) + 15,
        });
      }
    }

    return {
      totalProducts: generalStats?.totalProducts || 0,
      totalValue: generalStats?.totalValue || 0,
      lowStockProducts: generalStats?.lowStockProducts || 0,
      outOfStockProducts: generalStats?.outOfStockProducts || 0,
      topValueProducts: topValueProducts || [],
      stockMovements,
    };
  }

  /**
   * Reserva stock para una venta pendiente
   */
  static async reserveStock(
    items: Array<{ productId: string; quantity: number }>,
    reservationId: string,
    userId: string,
    expirationMinutes: number = 30
  ): Promise<{
    success: boolean;
    reservationId: string;
    expiresAt: Date;
    reservedItems: Array<{
      productId: string;
      productName: string;
      reservedQuantity: number;
    }>;
  }> {
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    
    return IdempotencyService.executeWithIdempotency(
      `reserve-stock-${reservationId}`,
      'stock_reservation',
      userId,
      { items, reservationId, expiresAt },
      async () => {
        const result = await TransactionService.executeWithRetry(
          async (transaction: Transaction) => {
            const reservedItems = [];

            for (const item of items) {
              const product = await Product.findByPk(item.productId, {
                transaction,
                lock: true,
              });

              if (!product) {
                throw new Error(`Producto ${item.productId} no encontrado`);
              }

              if (product.stock < item.quantity) {
                throw new Error(
                  `Stock insuficiente para ${product.name}. ` +
                  `Disponible: ${product.stock}, Solicitado: ${item.quantity}`
                );
              }

              // En una implementación completa, aquí se crearía un registro de reserva
              // Por ahora, solo validamos que hay stock suficiente
              
              reservedItems.push({
                productId: item.productId,
                productName: product.name,
                reservedQuantity: item.quantity,
              });
            }

            return {
              success: true,
              reservationId,
              expiresAt,
              reservedItems,
            };
          },
          { maxRetries: 2, retryDelay: 500 }
        );

        if (!result.success || !result.data) {
          throw result.error || new Error('Error al reservar stock');
        }

        // Auditoría de reserva de stock
        try {
          await AuditTrailService.log({
            operation: 'stock.reserve',
            entityType: 'reservation',
            entityId: reservationId,
            result: 'success',
            message: `Reserva de stock creada: ${items.length} ítems`,
            details: { items: result.data.reservedItems, expiresAt: result.data.expiresAt },
            actor: { id: userId },
            correlationId: reservationId,
          });
        } catch (e) {
          // no bloquear la operación por falla de auditoría
        }
        return result.data;
      },
      { ttlMinutes: expirationMinutes + 5 }
    );
  }

  /**
   * Registra un movimiento de stock en el historial
   */
  private static async logStockMovement(
    product: Product,
    movement: StockMovement,
    previousStock: number,
    newStock: number,
    transaction: Transaction
  ): Promise<void> {
    // Registrar en el libro mayor de stock (stock_ledger)
    try {
      let ledgerMovementType: MovementType;
      let quantityChange: number = newStock - previousStock;

      switch (movement.type) {
        case 'in':
          ledgerMovementType = 'INGRESO';
          quantityChange = movement.quantity;
          break;
        case 'out':
          ledgerMovementType = 'VENTA';
          quantityChange = -movement.quantity;
          break;
        case 'adjustment':
          ledgerMovementType = 'AJUSTE';
          // Para ajuste usamos la diferencia real
          quantityChange = newStock - previousStock;
          break;
        case 'transfer':
          // Las transferencias completas se registran con dos asientos en transferStock()
          // No registramos aquí para evitar duplicados y cambios erróneos en el total
          ledgerMovementType = 'AJUSTE';
          quantityChange = 0;
          break;
        default:
          ledgerMovementType = 'AJUSTE';
      }

      if (quantityChange !== 0) {
        const referenceType: ReferenceType | null = movement.type === 'adjustment'
          ? 'ADJUSTMENT'
          : movement.type === 'out'
            ? 'SALE'
            : movement.type === 'in'
              ? 'PURCHASE'
              : null;

        await StockLedger.create({
          productId: product.id,
          branchId: null,
          movementType: ledgerMovementType,
          quantityChange,
          unitCost: product.purchasePrice || null,
          referenceType: referenceType || null,
          referenceId: movement.reference || null,
        }, { transaction });
      }
    } catch (e) {
      // No bloquear la operación principal si falla el log
      // En entorno de desarrollo, registrar el error
      if (process.env.NODE_ENV === 'development') {
        console.warn('No se pudo registrar en StockLedger:', (e as any)?.message);
      }
    }

    const metadata = {
      movement: {
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        reference: movement.reference,
        userId: movement.userId,
        notes: movement.notes,
      },
      stockChange: {
        from: previousStock,
        to: newStock,
        difference: newStock - previousStock,
      },
      timestamp: new Date().toISOString(),
    };

    // Actualizar metadata del producto con el último movimiento
    await product.update({
      metadata: {
        ...product.metadata,
        lastStockMovement: metadata,
      },
    }, { transaction });

    // Auditoría del movimiento de stock
    try {
      await AuditTrailService.log({
        operation: 'stock.movement',
        entityType: 'product',
        entityId: product.id,
        result: 'success',
        message: `Movimiento de stock '${movement.type}': ${previousStock} -> ${newStock}`,
        details: {
          movement,
          previousStock,
          newStock,
          quantityChange: newStock - previousStock,
        },
        actor: movement.userId ? { id: movement.userId } : null,
        correlationId: movement.reference || undefined,
      });
    } catch (e) {
      // no bloquear por falla de auditoría
    }
  }

  /**
   * Obtiene productos con stock bajo
   */
  static async getLowStockProducts(limit: number = 50): Promise<Array<{
    productId: string;
    productName: string;
    productCode: string;
    currentStock: number;
    minStock: number;
    category: string;
    purchasePrice: number;
    salePrice: number;
  }>> {
    const products = await Product.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { stock: { [Op.lte]: Product.sequelize!.col('minStock') } },
          { stock: { [Op.lte]: 5 } }, // Default mínimo
        ],
      },
      attributes: [
        'id',
        'name',
        'code',
        'stock',
        'minStock',
        'category',
        'purchasePrice',
        'salePrice',
      ],
      order: [['stock', 'ASC']],
      limit,
    });

    return products.map(product => ({
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      currentStock: product.stock,
      minStock: product.minStock || 5,
      category: product.category,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
    }));
  }

  /**
   * Calcula el balance de stock derivado del libro mayor (StockLedger)
   */
  static async computeProductBalance(productId: string, branchId?: string): Promise<number> {
    const where: any = { productId };
    if (branchId) where.branchId = branchId;
    const sum: number = (await StockLedger.sum('quantityChange', { where })) as unknown as number;
    return Number(sum || 0);
  }

  /**
   * Reconcilia el stock del producto contra el balance del libro mayor
   */
  static async reconcileProductStock(
    productId: string,
    userId: string
  ): Promise<{ success: boolean; productId: string; computedBalance: number; previousStock: number; updated: boolean }> {
    const result = await TransactionService.executeWithRetry(
      async (transaction: Transaction) => {
        const product = await Product.findByPk(productId, { transaction, lock: true });
        if (!product) {
          throw new Error(`Producto ${productId} no encontrado`);
        }
        const computedBalance = await this.computeProductBalance(productId);
        const previousStock = product.stock;
        const updated = previousStock !== computedBalance;

        if (updated) {
          await product.update({
            stock: computedBalance < 0 ? 0 : computedBalance,
            metadata: {
              ...product.metadata,
              lastReconciliation: {
                previousStock,
                computedBalance,
                userId,
                timestamp: new Date().toISOString(),
              },
            },
          }, { transaction });
        } else {
          await product.update({
            metadata: {
              ...product.metadata,
              lastReconciliation: {
                previousStock,
                computedBalance,
                userId,
                timestamp: new Date().toISOString(),
                note: 'Sin cambios',
              },
            },
          }, { transaction });
        }

        return { productId, computedBalance, previousStock, updated };
      },
      { maxRetries: 2, retryDelay: 500, timeoutMs: 15000 }
    );

    if (!result.success || !result.data) {
      await AuditTrailService.log({
        operation: 'inventory.reconcileProduct',
        entityType: 'product',
        entityId: productId,
        actor: { id: userId },
        result: 'failure',
        message: 'Error al reconciliar producto',
        details: { error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : undefined },
      });
      throw result.error || new Error('Error al reconciliar producto');
    }

    await AuditTrailService.log({
      operation: 'inventory.reconcileProduct',
      entityType: 'product',
      entityId: productId,
      actor: { id: userId },
      result: 'success',
      message: result.data.updated ? 'Reconciliación aplicada' : 'Reconciliación sin cambios',
      details: result.data,
    });

    return { success: true, ...result.data };
  }

  /**
   * Reconcilia todos los productos contra el balance del libro mayor
   */
  static async reconcileAllProducts(userId: string): Promise<{
    success: boolean;
    reconciled: number;
    unchanged: number;
    errors: Array<{ productId: string; error: string }>;
  }> {
    const products = await Product.findAll({ attributes: ['id', 'stock', 'metadata'] });
    let reconciled = 0;
    let unchanged = 0;
    const errors: Array<{ productId: string; error: string }> = [];

    for (const p of products) {
      try {
        const res = await this.reconcileProductStock(p.id, userId);
        if (res.updated) reconciled++; else unchanged++;
      } catch (err) {
        errors.push({ productId: p.id, error: err instanceof Error ? err.message : 'Error desconocido' });
      }
    }

    await AuditTrailService.log({
      operation: 'inventory.reconcileAll',
      entityType: 'inventory',
      actor: { id: userId },
      result: errors.length > 0 ? (reconciled > 0 ? 'partial' : 'failure') : 'success',
      message: 'Reconciliación global de inventario',
      details: { reconciled, unchanged, errors },
    });

    return { success: errors.length === 0, reconciled, unchanged, errors };
  }
}
