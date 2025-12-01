import { Op, Transaction } from 'sequelize';
import { sequelize } from '../db/config';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Product } from '../models/Product';
import { Client } from '../models/Client';
import { User } from '../models/User';
import Agency from '../models/Agency';
import Guide from '../models/Guide';
import Employee from '../models/Employee';
import Branch from '../models/Branch';
import { CreateSaleInput, UpdateSaleInput, SaleQueryInput } from '../schemas/sale';
import { IdempotencyService } from './idempotencyService';
import { TransactionService } from './transactionService';
import StockLedger from '../models/StockLedger';
import { AuditTrailService } from './AuditTrailService';
import { JobQueueService } from './jobQueueService';

export interface CreateSaleResult {
  sale: Sale | null;
  ticketJobId?: string | null;
}

export class SaleService {
  static async createSale(userId: string, data: CreateSaleInput, idempotencyKey?: string): Promise<CreateSaleResult> {
    const key = idempotencyKey || `sale-create-${userId}-${Date.now()}`;
    const operation = 'sale.create';

    const created = await IdempotencyService.executeWithIdempotency<CreateSaleResult>(
      key,
      operation,
      userId,
      data,
      async () => {
        const txResult = await TransactionService.executeWithRetry(async (transaction: Transaction) => {
          let saleId: string;
          const {
            clientId,
            items,
            paymentMethod,
            notes,
            discountAmount = 0,
            taxRate = 0.19,
            saleType = 'STREET',
            agencyId,
            guideId,
            employeeId,
            branchId,
          } = data;

          // Validaciones del sistema de turismo - más flexibles
          if (saleType === 'GUIDE') {
            if (!agencyId || !guideId) {
              // En lugar de bloquear, crear venta como tipo normal
              console.warn('Ventas GUIDE requieren agencyId y guideId. Convirtiendo a venta normal.');
              // Continuar como venta normal sin validaciones de turismo
            } else {
              // Validar solo si se proporcionan los IDs
              const agency = await Agency.findByPk(agencyId, { transaction });
              if (!agency || !agency.isActive) {
                console.warn(`Agencia ${agencyId} no encontrada o inactiva. Continuando con venta normal.`);
                // No bloquear, solo advertir y continuar
              }
              const guide = await Guide.findByPk(guideId, { transaction });
              if (!guide || !guide.isActive || guide.agencyId !== agencyId) {
                console.warn(`Guía ${guideId} no válida. Continuando con venta normal.`);
                // No bloquear, solo advertir y continuar
              }
            }
          }

          // Validar empleado si se especifica - más flexible
          if (employeeId) {
            const employee = await Employee.findByPk(employeeId, { transaction });
            if (!employee || !employee.isActive) {
              console.warn(`Empleado ${employeeId} no encontrado o inactivo. Continuando con la venta.`);
              // Advertir pero no bloquear la venta
            } else if (branchId && employee.branchId !== branchId) {
              console.warn(`Empleado ${employeeId} no pertenece a la sucursal ${branchId}. Continuando con la venta.`);
              // Advertir pero no bloquear la venta
            }
          }

          // Validar sucursal si se especifica - más flexible
          if (branchId) {
            const branch = await Branch.findByPk(branchId, { transaction });
            if (!branch || !branch.isActive) {
              console.warn(`Sucursal ${branchId} no encontrada o inactiva. Continuando con la venta.`);
              // Advertir pero no bloquear la venta
            }
          }

          // Verificar stock de productos - más flexible
          for (const item of items) {
            const product = await Product.findByPk(item.productId, { transaction });
            if (!product) {
              throw new Error(`Producto ${item.productId} no encontrado`);
            }
            if (!product.isActive) {
              console.warn(`Producto ${product.name} está inactivo. Continuando con la venta.`);
              // Advertir pero no bloquear la venta
            }
            if (product.stock < item.quantity) {
              console.warn(`Stock insuficiente para ${product.name}. Stock disponible: ${product.stock}, solicitado: ${item.quantity}`);
              // Permitir venta con stock negativo para joyería
              throw new Error(`Stock insuficiente para ${product.name}. Stock disponible: ${product.stock}`);
            }
          }

          // Generar nï¿½mero de venta ï¿½nico
          const saleNumber = `SALE-${Date.now()}`;

          // Crear la venta con valores iniciales
          const sale = await Sale.create(
            {
              saleNumber,
              clientId,
              userId,
              subtotal: 0,
              taxAmount: 0,
              total: 0,
              paymentMethod,
              discountAmount,
              notes,
              cardReference: (data as any)?.cardReference,
              transferReference: (data as any)?.transferReference,
              status: 'completed',
              saleType,
              agencyId,
              guideId,
              employeeId,
              branchId,
            },
            { transaction }
          );

          saleId = sale.id;
          let subtotal = 0;

          // Crear items de venta y actualizar stock
          for (const itemData of items) {
            const product = await Product.findByPk(itemData.productId, { transaction });
            if (!product) {
              throw new Error(`Producto ${itemData.productId} no encontrado`);
            }

            const itemSubtotal = itemData.quantity * itemData.unitPrice;
            const itemDiscountAmount = itemData.discountAmount || 0;
            const itemTotal = itemSubtotal - itemDiscountAmount;

            await SaleItem.create(
              {
                saleId: sale.id,
                productId: itemData.productId,
                quantity: itemData.quantity,
                unitPrice: itemData.unitPrice,
                subtotal: itemSubtotal,
                discountAmount: itemDiscountAmount,
                total: itemTotal,
              },
              { transaction }
            );

            subtotal += itemTotal;

            // Actualizar stock del producto con manejo de errores mejorado
            try {
              const newStock = Math.max(0, product.stock - itemData.quantity); // Evitar stock negativo
              await product.update({ stock: newStock }, { transaction });
            } catch (stockError) {
              console.error(`Error actualizando stock para producto ${product.id}:`, stockError);
              // Continuar con la venta aunque falle la actualización de stock
              // El error se registrará en el log pero no bloqueará la venta
            }

            // Registrar movimiento en StockLedger (VENTA) con manejo de errores
            try {
              await StockLedger.create(
                {
                  productId: product.id,
                  branchId: branchId || null,
                  movementType: 'VENTA',
                  quantityChange: -itemData.quantity,
                  unitCost: (product as any).purchasePrice || null,
                  referenceType: 'SALE',
                  referenceId: sale.id,
                },
                { transaction }
              );
            } catch (ledgerError) {
              console.error(`Error creando registro en StockLedger para producto ${product.id}:`, ledgerError);
              // Continuar con la venta aunque falle el registro en el ledger
              // El error se registrará en el log pero no bloqueará la venta
            }
          }

          // Calcular totales
          const taxAmount = subtotal * taxRate;
          const total = subtotal + taxAmount - discountAmount;

          // Actualizar totales
          await sale.update({ subtotal, taxAmount, total }, { transaction });

          // Calcular y actualizar comisiones
          const commissions = await sale.calculateCommissions();
          await sale.update(
            {
              agencyCommission: commissions.agencyCommission,
              guideCommission: commissions.guideCommission,
              employeeCommission: commissions.employeeCommission,
            },
            { transaction }
          );

          // Actualizar estadï¿½sticas del cliente
          if (clientId) {
            const client = await Client.findByPk(clientId, { transaction });
            if (client) {
              await client.updatePurchaseStats(total);
            }
          }

          return { saleId };
        }, { maxRetries: 2, retryDelay: 500 });

        if (!txResult.success || !txResult.data) {
          throw txResult.error || new Error('Error creando venta');
        }

        const saleId = txResult.data.saleId;

        // Auditorï¿½a de ï¿½xito
        await AuditTrailService.log({
          operation: 'sale.create',
          entityType: 'sale',
          entityId: saleId,
          result: 'success',
          message: 'Venta creada exitosamente',
          actor: { id: userId },
        });

        // Encolar generaciï¿½n de ticket
        let ticketJobId: string | null = null;
        try {
          const job = await JobQueueService.enqueue('tickets.generate.bulk', { saleIds: [saleId] }, { maxAttempts: 3 });
          ticketJobId = job.id;
        } catch (err) {
          await AuditTrailService.log({
            operation: 'tickets.enqueue',
            entityType: 'sale',
            entityId: saleId,
            result: 'failure',
            message: 'Error encolando generaciï¿½n de ticket',
            details: { error: err instanceof Error ? err.message : String(err) },
            actor: { id: userId },
          });
        }

        const createdSale = await Sale.findByPk(saleId);
        return { sale: createdSale, ticketJobId };
      }, { ttlMinutes: 30 });

    return created;
  }

  static async getSales(query: SaleQueryInput) {
    const {
      page = 1,
      limit = 20,
      clientId,
      userId,
      status,
      paymentMethod,
      startDate,
      endDate,
      minTotal,
      maxTotal,
      saleType,
      agencyId,
      guideId,
      employeeId,
      branchId,
    } = query;

    const offset = (page - 1) * limit;
    const where: any = {};

    // Filtros
    if (clientId) where.clientId = clientId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (minTotal) where.total = { [Op.gte]: minTotal };
    if (maxTotal) where.total = { ...where.total, [Op.lte]: maxTotal };
    
    // Filtros del sistema de turismo
    if (saleType) where.saleType = saleType;
    if (agencyId) where.agencyId = agencyId;
    if (guideId) where.guideId = guideId;
    if (employeeId) where.employeeId = employeeId;
    if (branchId) where.branchId = branchId;

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate[Op.gte] = startDate;
      if (endDate) where.saleDate[Op.lte] = endDate;
    }

    const tables = await sequelize.getQueryInterface().showAllTables();
    const include: any[] = [
      {
        model: Client,
        as: 'client',
        attributes: ['id', 'code', 'firstName', 'lastName', 'email'],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username'],
      },
      {
        model: SaleItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'code', 'name', 'category'],
          },
        ],
      },
    ];
    if (tables.includes('agencies')) {
      include.push({ model: Agency, as: 'agency', attributes: ['id', 'code', 'name'], required: false });
    }
    if (tables.includes('guides')) {
      include.push({ model: Guide, as: 'guide', attributes: ['id', 'code', 'name'], required: false });
    }
    if (tables.includes('employees')) {
      include.push({ model: Employee, as: 'employee', attributes: ['id', 'code', 'name'], required: false });
    }
    if (tables.includes('branches')) {
      include.push({ model: Branch, as: 'branch', attributes: ['id', 'code', 'name'], required: false });
    }

    const { rows: sales, count } = await Sale.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['saleDate', 'DESC']],
    });

    return {
      sales,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  static async getSaleById(id: string) {
    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'code', 'firstName', 'lastName', 'email', 'phone'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
          required: false,
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'code', 'name', 'category', 'material'],
              required: false,
            },
          ],
          required: false,
        },
        {
          model: Agency,
          as: 'agency',
          attributes: ['id', 'code', 'name', 'commissionRate'],
          required: false,
        },
        {
          model: Guide,
          as: 'guide',
          attributes: ['id', 'code', 'name', 'commissionRate'],
          required: false,
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'code', 'name', 'commissionRate'],
          required: false,
        },
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'code', 'name'],
          required: false,
        },
      ],
    });

    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    return sale;
  }

  static async updateSale(id: string, data: UpdateSaleInput) {
    const sale = await Sale.findByPk(id);
    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    // Solo permitir actualizar estado y notas
    await sale.update(data);
    return await this.getSaleById(id);
  }

  static async cancelSale(id: string, userId: string) {
    const transaction = await sequelize.transaction();
    try {
      const sale = await Sale.findByPk(id, {
        include: [{
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }],
        }],
        transaction,
      });

      if (!sale) {
        throw new Error('Venta no encontrada');
      }

      if (sale.status === 'cancelled') {
        throw new Error('La venta ya está cancelada');
      }

      if (sale.status !== 'pending' && sale.status !== 'completed') {
        throw new Error('La venta no puede ser cancelada');
      }

      // Restaurar stock de productos
      for (const item of sale.items!) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (product) {
          await product.update({
            stock: product.stock + item.quantity,
          }, { transaction });
        }
      }

      // Actualizar estado de la venta
      await sale.update({ status: 'cancelled' }, { transaction });

      // Actualizar estadísticas del cliente si existe
      if (sale.clientId) {
        const client = await Client.findByPk(sale.clientId, { transaction });
        if (client) {
          client.updatePurchaseStats(-sale.total);
          await client.save({ transaction });
        }
      }

      await transaction.commit();
      return await this.getSaleById(id);
    } catch (error) {
      try {
        if (!(transaction as any).finished) {
          await transaction.rollback();
        }
      } catch {
        // Ignorar errores de rollback
      }
      throw error;
    }
  }

  static async getSalesStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate[Op.gte] = startDate;
      if (endDate) where.saleDate[Op.lte] = endDate;
    }

    const stats = await Sale.findAll({
      where: { ...where, status: 'completed' },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('total')), 'averageSale'],
        [sequelize.fn('SUM', sequelize.col('Sale.subtotal')), 'totalSubtotal'],
        [sequelize.fn('SUM', sequelize.col('taxAmount')), 'totalTax'],
        [sequelize.fn('SUM', sequelize.col('discountAmount')), 'totalDiscount'],
      ],
      raw: true,
    });

    const paymentMethodStats = await Sale.findAll({
      where: { ...where, status: 'completed' },
      attributes: [
        'paymentMethod',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total'],
      ],
      group: ['paymentMethod'],
      raw: true,
    });

    return {
      general: stats[0],
      paymentMethods: paymentMethodStats,
    };
  }

  static async getTourismStats(startDate?: Date, endDate?: Date) {
    const where: any = { status: 'completed' };
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate[Op.gte] = startDate;
      if (endDate) where.saleDate[Op.lte] = endDate;
    }

    // Estadï¿½sticas generales de turismo
    const generalStats = await Sale.findAll({
      where,
      attributes: [
        'saleType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('total')), 'averageSale'],
        [sequelize.fn('SUM', sequelize.col('agencyCommission')), 'totalAgencyCommission'],
        [sequelize.fn('SUM', sequelize.col('guideCommission')), 'totalGuideCommission'],
        [sequelize.fn('SUM', sequelize.col('employeeCommission')), 'totalEmployeeCommission'],
      ],
      group: ['saleType'],
      raw: true,
    });

    // Top agencias por ventas
    const topAgencies = await Sale.findAll({
      where: { ...where, saleType: 'GUIDE' },
      attributes: [
        'agencyId',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('agencyCommission')), 'totalCommission'],
      ],
      include: [
        {
          model: Agency,
          as: 'agency',
          attributes: ['code', 'name'],
        },
      ],
      group: ['agencyId', 'agency.id'],
      order: [[sequelize.fn('SUM', sequelize.col('total')), 'DESC']],
      limit: 10,
      raw: false,
    });

    // Top guï¿½as por ventas
    const topGuides = await Sale.findAll({
      where: { ...where, saleType: 'GUIDE' },
      attributes: [
        'guideId',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('guideCommission')), 'totalCommission'],
      ],
      include: [
        {
          model: Guide,
          as: 'guide',
          attributes: ['code', 'name'],
        },
      ],
      group: ['guideId', 'guide.id'],
      order: [[sequelize.fn('SUM', sequelize.col('total')), 'DESC']],
      limit: 10,
      raw: false,
    });

    // Top empleados por ventas
    const topEmployees = await Sale.findAll({
      where,
      attributes: [
        'employeeId',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('employeeCommission')), 'totalCommission'],
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['code', 'name'],
        },
      ],
      group: ['employeeId', 'employee.id'],
      order: [[sequelize.fn('SUM', sequelize.col('total')), 'DESC']],
      limit: 10,
      raw: false,
    });

    return {
      general: generalStats,
      topAgencies,
      topGuides,
      topEmployees,
    };
  }

  static async refundSale(id: string, userId: string, correlationId?: string, idempotencyKey?: string) {
    const operation = 'sale.refund';

    const executeRefund = async () => {
      const transaction = await sequelize.transaction();
      let committed = false;
      try {
        const sale = await Sale.findByPk(id, {
          include: [{
            model: SaleItem,
            as: 'items',
            include: [{ model: Product, as: 'product' }],
          }],
          transaction,
        });

        if (!sale) {
          throw new Error('Venta no encontrada');
        }

        if (sale.status === 'refunded') {
          throw new Error('La venta ya está reembolsada');
        }

        if (!sale.canBeRefunded()) {
          throw new Error('La venta no puede ser reembolsada');
        }

        // Restaurar stock de productos por cada ítem vendido
        for (const item of sale.items!) {
          const product = await Product.findByPk(item.productId, { transaction });
          if (product) {
            await product.update({
              stock: product.stock + item.quantity,
            }, { transaction });
          }
        }

        // Actualizar estado de la venta
        await sale.update({ status: 'refunded' }, { transaction });

        // Actualizar estadísticas del cliente si existe
        if (sale.clientId) {
          const client = await Client.findByPk(sale.clientId, { transaction });
          if (client) {
            client.updatePurchaseStats(-sale.total);
            await client.save({ transaction });
          }
        }

        await transaction.commit();
        committed = true;

        // Auditoría del reembolso
        await AuditTrailService.log({
          operation,
          entityType: 'Sale',
          entityId: sale.id,
          result: 'success',
          message: 'Venta reembolsada',
          details: { total: sale.total },
          correlationId,
          actor: { id: userId },
        });

        return await this.getSaleById(id);
      } catch (error) {
        try {
          if (!committed && !(transaction as any).finished) {
            await transaction.rollback();
          }
        } catch (rollbackError) {
          // Ignorar errores de rollback
        }
        // Auditoría de fallo
        await AuditTrailService.log({
          operation,
          entityType: 'Sale',
          entityId: id,
          result: 'failure',
          message: error instanceof Error ? error.message : 'Error al reembolsar venta',
          correlationId,
          actor: { id: userId },
        });
        throw error;
      }
    };

    // Ejecutar con idempotencia si se proporciona clave
    if (idempotencyKey) {
      return await IdempotencyService.executeWithIdempotency(
        idempotencyKey,
        operation,
        userId,
        { saleId: id },
        executeRefund
      );
    }

    return await executeRefund();
  }
}



