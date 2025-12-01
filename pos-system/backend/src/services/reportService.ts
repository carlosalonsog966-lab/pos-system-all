import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Product } from '../models/Product';
import { Client } from '../models/Client';
import Certification from '../models/Certification';
import Warranty from '../models/Warranty';
import { CashRegister } from '../models/CashRegister';
import { User } from '../models/User';
import { sequelize } from '../db/config';

export interface IncomeStatementData {
  period: { start: Date; end: Date };
  revenue: {
    totalSales: number;
    salesByPaymentMethod: { [key: string]: number };
    salesCount: number;
  };
  costs: {
    costOfGoodsSold: number;
    grossProfit: number;
    grossMargin: number;
  };
  summary: {
    netIncome: number;
    profitMargin: number;
  };
}

export interface CashFlowData {
  period: { start: Date; end: Date };
  inflows: {
    salesCash: number;
    salesCard: number;
    salesTransfer: number;
    total: number;
  };
  outflows: {
    purchases: number;
    expenses: number;
    total: number;
  };
  netCashFlow: number;
  dailyFlow: Array<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
}

export interface InventoryReportData {
  summary: {
    totalJewelry: number;
    totalValue: number;
    lowStockItems: number;
    categories: { [key: string]: number };
  };
  products: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    stock: number;
    minStock: number;
    salePrice: number;
    totalValue: number;
    isLowStock: boolean;
  }>;
}

export interface DashboardMetrics {
  sales: {
    today: number;
    yesterday: number;
    thisMonth: number;
    lastMonth: number;
    growth: {
      daily: number;
      monthly: number;
    };
  };
  inventory: {
    totalJewelry: number;
    lowStockItems: number;
    totalValue: number;
  };
  customers: {
    total: number;
    newThisMonth: number;
    topCustomers: Array<{
      id: string;
      name: string;
      totalPurchases: number;
    }>;
  };
  recentSales: Array<{
    id: string;
    date: Date;
    total: number;
    paymentMethod: string;
    customerName?: string;
  }>;
  // Datos para gráficos
  salesData: Array<{
    name: string;
    ventas: number;
    ingresos: number;
    transacciones: number;
    fecha: string;
  }>;
  revenueData: Array<{
    name: string;
    ingresos: number;
    meta: number;
    fecha: string;
  }>;
  hourlyData: Array<{
    hour: string;
    ventas: number;
    transacciones: number;
    promedio: number;
  }>;
  paymentMethodData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: number;
    category: string;
  }>;
}

export class ReportService {
  // Estado de Resultados
  static async generateIncomeStatement(startDate: Date, endDate: Date): Promise<IncomeStatementData> {
    const sales = await Sale.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
            },
          ],
        },
      ],
    });

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const salesCount = sales.length;

    // Ventas por método de pago
    const salesByPaymentMethod = sales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
      return acc;
    }, {} as { [key: string]: number });

    // Costo de bienes vendidos
    let costOfGoodsSold = 0;
    for (const sale of sales) {
      for (const item of (sale as any).items || []) {
        if (item.product) {
          costOfGoodsSold += item.quantity * item.product.purchasePrice;
        }
      }
    }

    const grossProfit = totalSales - costOfGoodsSold;
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    return {
      period: { start: startDate, end: endDate },
      revenue: {
        totalSales,
        salesByPaymentMethod,
        salesCount,
      },
      costs: {
        costOfGoodsSold,
        grossProfit,
        grossMargin,
      },
      summary: {
        netIncome: grossProfit,
        profitMargin,
      },
    };
  }

  // Reporte de expiración de certificaciones
  static async generateCertificatesExpirationsReport(params: { withinDays?: number } = {}) {
    const withinDays = Number(params.withinDays ?? 90)
    const now = new Date()
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
    const all = await Certification.findAll({})

    const toObj = (c: any) => ({
      id: c.id,
      assetId: c.productAssetId,
      type: c.type,
      authority: c.authority,
      certificateNumber: c.certificateNumber,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      daysToExpire: c.expiryDate ? Math.ceil((new Date(c.expiryDate).getTime() - now.getTime()) / (24*60*60*1000)) : null,
    })

    const expired = all.filter(c => c.expiryDate && new Date(c.expiryDate) < now)
    const expiringSoon = all.filter(c => c.expiryDate && new Date(c.expiryDate) >= now && new Date(c.expiryDate) <= cutoff)

    const byType: Record<string, number> = {}
    const byAuthority: Record<string, number> = {}
    all.forEach(c => {
      byType[c.type] = (byType[c.type] || 0) + 1
      byAuthority[c.authority] = (byAuthority[c.authority] || 0) + 1
    })

    return {
      period: { start: now.toISOString(), end: cutoff.toISOString() },
      summary: {
        total: all.length,
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        byType,
        byAuthority,
      },
      items: {
        expired: expired.map(toObj),
        expiringSoon: expiringSoon.map(toObj),
      },
    }
  }

  // Reporte de expiración de garantías
  static async generateWarrantiesExpirationsReport(params: { withinDays?: number } = {}) {
    const withinDays = Number(params.withinDays ?? 90)
    const now = new Date()
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
    const all = await Warranty.findAll({})

    function computeEndDate(w: any): Date {
      const d = new Date(w.startDate)
      d.setMonth(d.getMonth() + Number(w.months || 0))
      return d
    }

    const toObj = (w: any) => {
      const endDate = computeEndDate(w)
      const daysToExpire = Math.ceil((endDate.getTime() - now.getTime()) / (24*60*60*1000))
      return {
        id: w.id,
        assetId: w.productAssetId,
        saleId: w.saleId,
        startDate: w.startDate,
        months: w.months,
        status: w.status,
        endDate,
        daysToExpire,
      }
    }

    const expired = all.filter(w => computeEndDate(w) < now)
    const expiringSoon = all.filter(w => computeEndDate(w) >= now && computeEndDate(w) <= cutoff)

    const byStatus: Record<string, number> = {}
    all.forEach(w => {
      byStatus[w.status] = (byStatus[w.status] || 0) + 1
    })

    return {
      period: { start: now.toISOString(), end: cutoff.toISOString() },
      summary: {
        total: all.length,
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        byStatus,
      },
      items: {
        expired: expired.map(toObj),
        expiringSoon: expiringSoon.map(toObj),
      },
    }
  }

  // Resumen de auditoría
  static async generateAuditSummary(params: { startDate?: string; endDate?: string } = {}) {
    const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1)
    const end = params.endDate ? new Date(params.endDate) : new Date()
    const rows = await sequelize.query(
      `SELECT operation, COUNT(*) as count
       FROM audit_trail
       WHERE createdAt BETWEEN :start AND :end
       GROUP BY operation
       ORDER BY count DESC`,
      { replacements: { start, end }, type: QueryTypes.SELECT }
    ) as Array<{ operation: string; count: number }>

    const total = rows.reduce((s, r) => s + Number(r.count || 0), 0)
    const top = rows.slice(0, 10)
    return {
      period: { start, end },
      total,
      byOperation: rows,
      topOperations: top,
    }
  }

  // Flujo de Caja
  static async generateCashFlow(startDate: Date, endDate: Date): Promise<CashFlowData> {
    const sales = await Sale.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    const inflows = {
      salesCash: 0,
      salesCard: 0,
      salesTransfer: 0,
      total: 0,
    };

    sales.forEach(sale => {
      switch (sale.paymentMethod) {
        case 'cash':
          inflows.salesCash += sale.total;
          break;
        case 'card':
          inflows.salesCard += sale.total;
          break;
        case 'transfer':
          inflows.salesTransfer += sale.total;
          break;
        case 'mixed':
          // Para pagos mixtos, distribuir proporcionalmente
          inflows.salesCash += sale.total * 0.5;
          inflows.salesCard += sale.total * 0.5;
          break;
      }
    });

    inflows.total = inflows.salesCash + inflows.salesCard + inflows.salesTransfer;

    // Simular egresos (en un sistema real vendrían de otra tabla)
    const outflows = {
      purchases: inflows.total * 0.6, // 60% del ingreso como costo estimado
      expenses: inflows.total * 0.1,  // 10% como gastos operativos
      total: 0,
    };
    outflows.total = outflows.purchases + outflows.expenses;

    const netCashFlow = inflows.total - outflows.total;

    // Flujo diario
    const dailyFlow = await this.generateDailyCashFlow(startDate, endDate);

    return {
      period: { start: startDate, end: endDate },
      inflows,
      outflows,
      netCashFlow,
      dailyFlow,
    };
  }

  // Reporte de Inventarios
  static async generateInventoryReport(options: {
    category?: string;
    lowStockOnly?: boolean;
  }): Promise<InventoryReportData> {
    const whereClause: any = { isActive: true };
    
    if (options.category) {
      whereClause.category = options.category;
    }

    const products = await Product.findAll({
      where: whereClause,
    });

    const filteredProducts = options.lowStockOnly 
      ? products.filter(p => p.stock <= p.minStock)
      : products;

    const summary = {
      totalJewelry: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.stock * p.salePrice), 0),
      lowStockItems: products.filter(p => p.stock <= p.minStock).length,
      categories: products.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number }),
    };

    const productsData = filteredProducts.map(product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      stock: product.stock,
      minStock: product.minStock,
      salePrice: product.salePrice,
      totalValue: product.stock * product.salePrice,
      isLowStock: product.stock <= product.minStock,
    }));

    return {
      summary,
      products: productsData,
    };
  }

  // Reporte de Movimientos
  static async generateMovementsReport(startDate: Date, endDate: Date, type?: string) {
    const sales = await Sale.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
            },
          ],
        },
        { model: Client, as: 'client' },
      ],
      order: [['createdAt', 'DESC']],
    });

    const movements = sales.map(sale => ({
      id: sale.id,
      date: sale.createdAt,
      type: 'sale',
      description: `Venta #${sale.id}`,
      customer: (sale as any).client ? `${(sale as any).client.firstName} ${(sale as any).client.lastName}` : 'Cliente General',
      paymentMethod: sale.paymentMethod,
      amount: sale.total,
      items: (sale as any).items?.map((item: any) => ({
        product: item.product?.name || 'Producto',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })) || [],
    }));

    return {
      period: { start: startDate, end: endDate },
      movements,
      summary: {
        totalMovements: movements.length,
        totalAmount: movements.reduce((sum, m) => sum + m.amount, 0),
      },
    };
  }

  // Métricas del Dashboard
  static async generateDashboardMetrics(period: string = 'month'): Promise<DashboardMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Ventas de hoy
    const todaySales = await Sale.sum('total', {
      where: {
        createdAt: {
          [Op.gte]: today,
        },
      },
    }) || 0;

    // Ventas de ayer
    const yesterdaySales = await Sale.sum('total', {
      where: {
        createdAt: {
          [Op.between]: [yesterday, today],
        },
      },
    }) || 0;

    // Ventas de este mes
    const thisMonthSales = await Sale.sum('total', {
      where: {
        createdAt: {
          [Op.gte]: thisMonthStart,
        },
      },
    }) || 0;

    // Ventas del mes pasado
    const lastMonthSales = await Sale.sum('total', {
      where: {
        createdAt: {
          [Op.between]: [lastMonthStart, lastMonthEnd],
        },
      },
    }) || 0;

    // Inventario
    const totalJewelry = await Product.count({ where: { isActive: true } });
    // Conteo de productos con stock bajo (compatible con SQLite)
    const lowStockItems = await sequelize.query(
      'SELECT COUNT(*) as count FROM products WHERE isActive = 1 AND stock <= COALESCE(minStock, 5)'
      , { type: QueryTypes.SELECT }
    ).then((result: any) => parseInt(result[0]?.count || 0));

    const inventoryValue = await sequelize.query(
      'SELECT SUM(stock * salePrice) as total FROM products WHERE isActive = 1',
      { type: QueryTypes.SELECT }
    ).then((result: any) => result[0]?.total || 0);

    // Clientes
    const totalCustomers = await Client.count({ where: { isActive: true } });
    const newCustomersThisMonth = await Client.count({
      where: {
        isActive: true,
        createdAt: {
          [Op.gte]: thisMonthStart,
        },
      },
    });

    // Top clientes
    const topCustomers = await Client.findAll({
      where: { isActive: true },
      order: [['totalPurchases', 'DESC']],
      limit: 5,
      attributes: ['id', 'firstName', 'lastName', 'totalPurchases'],
    });

    // Ventas recientes
    const recentSales = await Sale.findAll({
      include: [{ model: Client, as: 'client' }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    return {
      sales: {
        today: todaySales,
        yesterday: yesterdaySales,
        thisMonth: thisMonthSales,
        lastMonth: lastMonthSales,
        growth: {
          daily: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
          monthly: lastMonthSales > 0 ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0,
        },
      },
      inventory: {
        totalJewelry,
        lowStockItems,
        totalValue: inventoryValue,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
        topCustomers: topCustomers.map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          totalPurchases: c.totalPurchases,
        })),
      },
      recentSales: recentSales.map(sale => ({
        id: sale.id,
        date: sale.createdAt,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        customerName: (sale as any).client ? `${(sale as any).client.firstName} ${(sale as any).client.lastName}` : undefined,
      })),
      // Datos para gráficos - datos reales
      salesData: await this.generateWeeklySalesData(),
      revenueData: await this.generateMonthlyRevenueData(),
      hourlyData: await this.generateHourlySalesData(),
      paymentMethodData: await this.generatePaymentMethodData(),
      topProducts: await this.generateTopProductsData(),
    };
  }

  // Generar datos de ventas semanales
  static async generateWeeklySalesData() {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const salesData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      const dailySales = await Sale.findAll({
        where: {
          createdAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });
      
      const totalVentas = dailySales.length;
      const totalIngresos = dailySales.reduce((sum, sale) => sum + sale.total, 0);
      
      salesData.push({
        name: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
        ventas: totalVentas,
        ingresos: totalIngresos,
        transacciones: totalVentas,
        fecha: date.toISOString(),
      });
    }
    
    return salesData;
  }

  // Generar datos de ingresos mensuales
  static async generateMonthlyRevenueData() {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const revenueData = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthlyRevenue = await Sale.sum('total', {
        where: {
          createdAt: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
        },
      }) || 0;
      
      revenueData.push({
        name: months[date.getMonth()],
        ingresos: monthlyRevenue,
        meta: 45000, // Meta fija por ahora
        fecha: startOfMonth.toISOString(),
      });
    }
    
    return revenueData;
  }

  // Generar datos de ventas por hora
  static async generateHourlySalesData() {
    const hourlyData = [];
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    for (let hour = 8; hour <= 19; hour++) {
      const startHour = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
      const endHour = new Date(startOfDay.getTime() + (hour + 1) * 60 * 60 * 1000);
      
      const hourlySales = await Sale.findAll({
        where: {
          createdAt: {
            [Op.between]: [startHour, endHour],
          },
        },
      });
      
      const totalVentas = hourlySales.length;
      const totalIngresos = hourlySales.reduce((sum, sale) => sum + sale.total, 0);
      
      hourlyData.push({
        hour: `${hour}:00`,
        ventas: totalVentas,
        transacciones: totalVentas,
        promedio: totalVentas > 0 ? totalIngresos / totalVentas : 0,
      });
    }
    
    return hourlyData;
  }

  // Generar datos de métodos de pago
  static async generatePaymentMethodData() {
    const paymentMethods = await Sale.findAll({
      attributes: [
        'paymentMethod',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('total')), 'total'],
      ],
      group: ['paymentMethod'],
      raw: true,
    });

    const totalSales = paymentMethods.reduce((sum: number, method: any) => sum + parseInt(method.count), 0);
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
    
    return paymentMethods.map((method: any, index: number) => ({
      name: method.paymentMethod === 'CASH' ? 'Efectivo' : 
            method.paymentMethod === 'CARD' ? 'Tarjeta' : 
            method.paymentMethod === 'TRANSFER' ? 'Transferencia' : method.paymentMethod,
      value: parseInt(method.count),
      percentage: totalSales > 0 ? Math.round((parseInt(method.count) / totalSales) * 100) : 0,
      color: colors[index % colors.length],
    }));
  }

  // Generar datos de productos top
  static async generateTopProductsData() {
    const topProducts = await sequelize.query(`
      SELECT 
        p.id,
        p.name,
        p.category,
        COUNT(si.id) as sales,
        SUM(si.quantity * si.unitPrice) as revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.productId
      LEFT JOIN sales s ON si.saleId = s.id
      WHERE p.isActive = 1 AND s.createdAt >= date('now', '-30 days')
      GROUP BY p.id, p.name, p.category
      ORDER BY revenue DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    return (topProducts as any[]).map(product => ({
      id: product.id,
      name: product.name,
      sales: parseInt(product.sales) || 0,
      revenue: parseFloat(product.revenue) || 0,
      category: product.category || 'Sin categoría',
    }));
  }

  // Reporte de Ventas
  static async generateSalesReport(options: {
    startDate: Date;
    endDate: Date;
    groupBy?: 'day' | 'week' | 'month';
    paymentMethod?: string;
    branchId?: string;
  }) {
    const whereClause: any = {
      createdAt: {
        [Op.between]: [options.startDate, options.endDate],
      },
    };

    if (options.paymentMethod) {
      whereClause.paymentMethod = options.paymentMethod;
    }

    if (options.branchId) {
      whereClause.branchId = options.branchId;
    }

    const sales = await Sale.findAll({
      where: whereClause,
      include: [{ model: Client, as: 'client' }],
      order: [['createdAt', 'ASC']],
    });

    // Agrupar por período
    const groupedSales = this.groupSalesByPeriod(sales, options.groupBy || 'day');

    return {
      period: { start: options.startDate, end: options.endDate },
      groupBy: options.groupBy || 'day',
      data: groupedSales,
      summary: {
        totalSales: sales.reduce((sum, sale) => sum + sale.total, 0),
        salesCount: sales.length,
        averageTicket: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0,
      },
    };
  }

  // Productos más vendidos
  static async generateTopProductsReport(startDate: Date, endDate: Date, limit: number = 10) {
    const topProducts = await SaleItem.findAll({
      include: [
        {
          model: Product,
          required: true,
        },
        {
          model: Sale,
          where: {
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
          },
          required: true,
        },
      ],
      attributes: [
        'productId',
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [fn('SUM', col('total')), 'totalRevenue'],
        [fn('COUNT', col('SaleItem.id')), 'salesCount'],
      ],
      group: ['productId', 'product.id'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit,
    });

    return {
      period: { start: startDate, end: endDate },
      products: topProducts.map((item: any) => ({
        productId: item.productId,
        name: item.product.name,
        code: item.product.code,
        category: item.product.category,
        totalQuantity: parseInt(item.getDataValue('totalQuantity')),
        totalRevenue: parseFloat(item.getDataValue('totalRevenue')),
        salesCount: parseInt(item.getDataValue('salesCount')),
        averagePrice: parseFloat(item.getDataValue('totalRevenue')) / parseInt(item.getDataValue('totalQuantity')),
      })),
    };
  }

  // Reporte de Clientes
  static async generateCustomersReport(startDate: Date, endDate: Date, minPurchases: number = 1) {
    const customers = await Client.findAll({
      where: {
        isActive: true,
        totalPurchases: {
          [Op.gte]: minPurchases,
        },
      },
      include: [
        {
          model: Sale,
          as: 'sales',
          where: {
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
          },
          required: false,
        },
      ],
      order: [['totalPurchases', 'DESC']],
    });

    return {
      period: { start: startDate, end: endDate },
      customers: customers.map(customer => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone,
        totalPurchases: customer.totalPurchases,
        lastPurchaseDate: customer.lastPurchaseDate,
        salesInPeriod: (customer as any).sales?.length || 0,
        revenueInPeriod: (customer as any).sales?.reduce((sum: number, sale: any) => sum + sale.total, 0) || 0,
      })),
    };
  }

  // Exportar a CSV
  static async exportReportToCSV(reportType: string, params: any): Promise<string> {
    let csv = '';
    switch (reportType) {
      case 'sales': {
        const startDate = params.startDate ? new Date(params.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
        const endDate = params.endDate ? new Date(params.endDate as string) : new Date();
        const groupBy = (params.groupBy as 'day'|'week'|'month') || 'day';
        const dataset = (params.dataset as string)?.toLowerCase() || 'byperiod';

        const report = await this.generateSalesReport({ startDate, endDate, groupBy, paymentMethod: params.paymentMethod, branchId: params.branchId });

        if (dataset === 'summary') {
          csv += 'metric,value\n';
          const rows = [
            ['totalSales', report.summary.totalSales],
            ['salesCount', report.summary.salesCount],
            ['averageTicket', report.summary.averageTicket],
          ];
          for (const [k, v] of rows) {
            csv += `${k},${v}\n`;
          }
        } else if (dataset === 'byperiod') {
          csv += 'period,sales,count,total\n';
          for (const d of report.data) {
            const row = [d.period, d.sales, d.count, d.total]
              .map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
        } else if (dataset === 'bypaymentmethod') {
          const where: any = { createdAt: { [Op.between]: [startDate, endDate] } };
          if (params.paymentMethod) where.paymentMethod = params.paymentMethod;
          if (params.branchId) where.branchId = params.branchId;
          const aggregates = await Sale.findAll({
            where,
            attributes: [
              'paymentMethod',
              [fn('COUNT', col('Sale.id')), 'salesCount'],
              [fn('SUM', col('total')), 'totalRevenue'],
            ],
            group: ['paymentMethod'],
            order: [[fn('SUM', col('total')), 'DESC']],
          });
          csv += 'paymentMethod,salesCount,totalRevenue\n';
          for (const a of aggregates as any[]) {
            const row = [a.paymentMethod || 'UNKNOWN', a.get?.('salesCount') ?? a.getDataValue?.('salesCount') ?? a.salesCount, a.get?.('totalRevenue') ?? a.getDataValue?.('totalRevenue') ?? a.totalRevenue]
              .map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
        } else if (dataset === 'byclient') {
          const where: any = { createdAt: { [Op.between]: [startDate, endDate] } };
          if (params.branchId) where.branchId = params.branchId;
          const rows = await Sale.findAll({
            where,
            include: [{ model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }],
            attributes: [
              'clientId',
              [fn('COUNT', col('Sale.id')), 'salesCount'],
              [fn('SUM', col('total')), 'totalRevenue'],
            ],
            group: ['clientId', 'client.id'],
            order: [[fn('SUM', col('total')), 'DESC']],
          });
          csv += 'clientId,clientName,email,phone,salesCount,totalRevenue\n';
          for (const r of rows as any[]) {
            const client = r.client;
            const clientName = client ? `${client.firstName} ${client.lastName}`.trim() : 'Sin cliente';
            const row = [
              r.clientId || '',
              clientName,
              client?.email || '',
              client?.phone || '',
              r.get?.('salesCount') ?? r.getDataValue?.('salesCount') ?? r.salesCount,
              r.get?.('totalRevenue') ?? r.getDataValue?.('totalRevenue') ?? r.totalRevenue,
            ].map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)).join(',');
            csv += row + '\n';
          }
        } else if (dataset === 'byproduct') {
          const top = await this.generateTopProductsReport(startDate, endDate, params.limit ? parseInt(params.limit, 10) || 10 : 10);
          csv += 'productId,productCode,productName,category,totalQuantity,totalRevenue,salesCount,averagePrice\n';
          for (const p of top.products) {
            const row = [p.productId, p.code, p.name, p.category, p.totalQuantity, p.totalRevenue, p.salesCount, p.averagePrice]
              .map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v))
              .join(',');
            csv += row + '\n';
          }
        } else if (dataset === 'byuser') {
          const where: any = { createdAt: { [Op.between]: [startDate, endDate] } };
          if (params.branchId) where.branchId = params.branchId;
          const rows = await Sale.findAll({
            where,
            include: [{ model: User, as: 'user', attributes: ['id', 'username'], required: false }],
            attributes: [
              'userId',
              [fn('COUNT', col('Sale.id')), 'salesCount'],
              [fn('SUM', col('total')), 'totalRevenue'],
            ],
            group: ['userId', 'user.id'],
            order: [[fn('SUM', col('total')), 'DESC']],
          });
          csv += 'userId,username,salesCount,totalRevenue\n';
          for (const r of rows as any[]) {
            const row = [
              r.userId || '',
              r.user?.username || 'Usuario',
              r.get?.('salesCount') ?? r.getDataValue?.('salesCount') ?? r.salesCount,
              r.get?.('totalRevenue') ?? r.getDataValue?.('totalRevenue') ?? r.totalRevenue,
            ].map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)).join(',');
            csv += row + '\n';
          }
        } else {
          throw new Error('Dataset inválido para reporte de ventas. Use byPeriod, summary, byPaymentMethod, byClient, byProduct o byUser');
        }
        break;
      }
      case 'inventory': {
        // Mantener exportación básica en JSON para inventario (CSV específico está en inventoryController)
        const data = await this.generateInventoryReport(params);
        csv = JSON.stringify(data);
        break;
      }
      default:
        throw new Error('Tipo de reporte no soportado');
    }

    return csv;
  }

  // Generar gráfica PNG
  static async generateChartPNG(chartType: string, params: any): Promise<Buffer> {
    try {
      const { default: chartCaptureService } = await import('./chartCaptureService');
      const { ExportsIntegrityService } = await import('./ExportsIntegrityService');

      // Capturar la gráfica y obtener el nombre del archivo
      const filename = await chartCaptureService.captureChart({
        chartType: (chartType as any),
        options: {
          width: Number(params?.width ?? 1400),
          height: Number(params?.height ?? 900),
          delay: Number(params?.delay ?? 3000),
        },
        frontendUrl: (params?.frontendUrl as string) || process.env.FRONTEND_URL,
      });

      // Leer el archivo desde exports/charts
      const base = ExportsIntegrityService.getExportsBasePath();
      const filepath = path.join(base, 'charts', filename);
      const buffer = await fs.readFile(filepath);
      return buffer;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Error generando PNG de la gráfica');
    }
  }

  // Métodos auxiliares
  private static async generateDailyCashFlow(startDate: Date, endDate: Date) {
    const dailyData = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const dailySales = await Sale.sum('total', {
        where: {
          createdAt: {
            [Op.between]: [currentDate, nextDay],
          },
        },
      }) || 0;

      dailyData.push({
        date: currentDate.toISOString().split('T')[0],
        inflow: dailySales,
        outflow: dailySales * 0.7, // Estimación de egresos
        net: dailySales * 0.3,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyData;
  }

  private static groupSalesByPeriod(sales: Sale[], groupBy: 'day' | 'week' | 'month') {
    const grouped: { [key: string]: { sales: number; count: number; total: number } } = {};

    sales.forEach(sale => {
      let key: string;
      const date = new Date(sale.createdAt);

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = { sales: 0, count: 0, total: 0 };
      }

      grouped[key].sales += sale.total;
      grouped[key].count += 1;
      grouped[key].total += sale.total;
    });

    return Object.entries(grouped).map(([period, data]) => ({
      period,
      ...data,
    }));
  }

  /**
   * Genera un PDF del reporte usando Puppeteer sobre la vista del frontend.
   * Devuelve el Buffer del archivo PDF sin escribir a disco.
   */
  static async exportReportToPDF(
    reportType: string,
    options: {
      dateRange?: { startDate?: string; endDate?: string };
      groupBy?: string;
      branchId?: string;
      paymentMethod?: string;
      landscape?: boolean;
      frontendUrl?: string;
    } = {}
  ): Promise<Buffer> {
    const frontendBase = options?.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5174';
    const params = new URLSearchParams();
    if (options?.dateRange?.startDate) params.append('startDate', options.dateRange.startDate);
    if (options?.dateRange?.endDate) params.append('endDate', options.dateRange.endDate);
    if (options?.groupBy) params.append('groupBy', options.groupBy);
    if (options?.branchId) params.append('branchId', options.branchId);
    if (options?.paymentMethod) params.append('paymentMethod', options.paymentMethod);

    const reportsUrl = `${frontendBase}/#/reports?tab=${encodeURIComponent(reportType)}&${params.toString()}`;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
    const page = await browser.newPage();
    try {
      await page.goto(reportsUrl, { waitUntil: 'networkidle0' });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        landscape: Boolean(options?.landscape),
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      const pdfBuffer = Buffer.from(pdfUint8);
      return pdfBuffer;
    } finally {
      try { await page.close(); } catch {}
      try { await browser.close(); } catch {}
    }
  }
}
