import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../db/config';
import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import Guide from '../models/Guide';
import Employee from '../models/Employee';
import Agency from '../models/Agency';
import Branch from '../models/Branch';
import Product from '../models/Product';
import { GuideRegistration } from '../models/GuideRegistration';

export class RankingService {
  static async getWeeklyRankings(query: any) {
    const { weekOffset = 0 } = query;
    
    // Calcular fechas de la semana
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return await this.getRankingsForPeriod(startOfWeek, endOfWeek);
  }

  static async getMonthlyRankings(query: any) {
    const { monthOffset = 0 } = query;
    
    // Calcular fechas del mes
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0, 23, 59, 59, 999);

    return await this.getRankingsForPeriod(startOfMonth, endOfMonth);
  }

  static async getCustomRankings(query: any) {
    const { startDate, endDate } = query;
    
    if (!startDate || !endDate) {
      throw new Error('Se requieren fechas de inicio y fin para rankings personalizados');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return await this.getRankingsForPeriod(start, end);
  }

  private static async getRankingsForPeriod(startDate: Date, endDate: Date) {
    const dateWhere = {
      saleDate: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      status: 'completed',
    };

    // Top Guías por ventas
    let topGuides: any[] = [];
    try {
      console.log('[RankingService.getRankingsForPeriod] Fetching top guides...');
      const [rows] = await sequelize.query(
        `
        SELECT 
          s.guideId AS guideId,
          g.id AS guide_id,
          g.code AS guide_code,
          g.name AS guide_name,
          a.id AS agency_id,
          a.code AS agency_code,
          a.name AS agency_name,
          COUNT(s.id) AS totalSales,
          SUM(s.total) AS totalRevenue,
          AVG(s.total) AS averageTicket,
          SUM(s.guideCommission) AS totalCommission
        FROM sales s
        LEFT JOIN guides g ON g.id = s.guideId
        LEFT JOIN agencies a ON a.id = g.agencyId
        WHERE s.status = 'completed'
          AND s.saleType = 'GUIDE'
          AND s.saleDate >= :startDate
          AND s.saleDate <= :endDate
        GROUP BY s.guideId, g.id, g.code, g.name, a.id, a.code, a.name
        ORDER BY totalRevenue DESC
        LIMIT 10
        `,
        { replacements: { startDate, endDate }, logging: console.log }
      );
      topGuides = (rows as any[]).map(r => ({
        guideId: r.guideId,
        guide: {
          id: r.guide_id,
          code: r.guide_code,
          name: r.guide_name,
          agency: r.agency_id ? {
            id: r.agency_id,
            code: r.agency_code,
            name: r.agency_name,
          } : undefined,
        },
        totalSales: r.totalSales,
        totalRevenue: r.totalRevenue,
        averageTicket: r.averageTicket,
        totalCommission: r.totalCommission,
      }));
    } catch (err) {
      console.error('[getRankingsForPeriod:topGuides] Error:', (err as any)?.message, (err as any)?.sql);
      topGuides = [];
    }

    // Top Empleados por ventas
    let topEmployees: any[] = [];
    try {
      console.log('[RankingService.getRankingsForPeriod] Fetching top employees...');
      const [rows] = await sequelize.query(
        `
        SELECT 
          s.employeeId AS employeeId,
          e.id AS employee_id,
          e.code AS employee_code,
          e.name AS employee_name,
          b.id AS branch_id,
          b.code AS branch_code,
          b.name AS branch_name,
          COUNT(s.id) AS totalSales,
          SUM(s.total) AS totalRevenue,
          AVG(s.total) AS averageTicket,
          SUM(s.employeeCommission) AS totalCommission
        FROM sales s
        LEFT JOIN employees e ON e.id = s.employeeId
        LEFT JOIN branches b ON b.id = e.branchId
        WHERE s.status = 'completed'
          AND s.saleDate >= :startDate
          AND s.saleDate <= :endDate
        GROUP BY s.employeeId, e.id, e.code, e.name, b.id, b.code, b.name
        ORDER BY totalRevenue DESC
        LIMIT 10
        `,
        { replacements: { startDate, endDate }, logging: console.log }
      );
      topEmployees = (rows as any[]).map(r => ({
        employeeId: r.employeeId,
        employee: {
          id: r.employee_id,
          code: r.employee_code,
          name: r.employee_name,
          branch: r.branch_id ? {
            id: r.branch_id,
            code: r.branch_code,
            name: r.branch_name,
          } : undefined,
        },
        totalSales: r.totalSales,
        totalRevenue: r.totalRevenue,
        averageTicket: r.averageTicket,
        totalCommission: r.totalCommission,
      }));
    } catch (err) {
      console.error('[getRankingsForPeriod:topEmployees] Error:', (err as any)?.message, (err as any)?.sql);
      topEmployees = [];
    }

    // Top Productos por ventas
    let topProducts: any[] = [];
    try {
      console.log('[RankingService.getRankingsForPeriod] Fetching top products...');
      const [rows] = await sequelize.query(
        `
        SELECT 
          si.productId AS productId,
          p.id AS product_id,
          p.name AS product_name,
          p.code AS product_code,
          p.salePrice AS product_price,
          SUM(si.quantity) AS totalQuantity,
          SUM(si.quantity * si.unitPrice) AS totalRevenue,
          COUNT(si.id) AS totalTransactions
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.saleId
        INNER JOIN products p ON p.id = si.productId
        WHERE s.status = 'completed'
          AND s.saleDate >= :startDate
          AND s.saleDate <= :endDate
        GROUP BY si.productId, p.id, p.name, p.code, p.salePrice
        ORDER BY totalRevenue DESC
        LIMIT 10
        `,
        {
          replacements: { startDate, endDate },
          logging: console.log,
        }
      );

      topProducts = (rows as any[]).map(r => ({
        productId: r.productId,
        product: {
          id: r.product_id,
          name: r.product_name,
          code: r.product_code,
          price: r.product_price,
        },
        totalQuantity: r.totalQuantity,
        totalRevenue: r.totalRevenue,
        totalTransactions: r.totalTransactions,
      }));
    } catch (err) {
      console.error('[getRankingsForPeriod:topProducts] Error:', (err as any)?.message, (err as any)?.sql);
      topProducts = [];
    }

    // Top Agencias por ventas
    let topAgencies: any[] = [];
    try {
      console.log('[RankingService.getRankingsForPeriod] Fetching top agencies...');
      const [rows] = await sequelize.query(
        `
        SELECT 
          s.agencyId AS agencyId,
          a.id AS agency_id,
          a.code AS agency_code,
          a.name AS agency_name,
          COUNT(s.id) AS totalSales,
          SUM(s.total) AS totalRevenue,
          AVG(s.total) AS averageTicket,
          SUM(s.agencyCommission) AS totalCommission
        FROM sales s
        LEFT JOIN agencies a ON a.id = s.agencyId
        WHERE s.status = 'completed'
          AND s.saleType = 'GUIDE'
          AND s.saleDate >= :startDate
          AND s.saleDate <= :endDate
        GROUP BY s.agencyId, a.id, a.code, a.name
        ORDER BY totalRevenue DESC
        LIMIT 10
        `,
        { replacements: { startDate, endDate }, logging: console.log }
      );
      topAgencies = (rows as any[]).map(r => ({
        agencyId: r.agencyId,
        agency: {
          id: r.agency_id,
          code: r.agency_code,
          name: r.agency_name,
        },
        totalSales: r.totalSales,
        totalRevenue: r.totalRevenue,
        averageTicket: r.averageTicket,
        totalCommission: r.totalCommission,
      }));
    } catch (err) {
      console.error('[getRankingsForPeriod:topAgencies] Error:', (err as any)?.message, (err as any)?.sql);
      topAgencies = [];
    }

    // Calcular porcentajes de cierre para guías
    const guidesWithClosure = await Promise.all(
      topGuides.map(async (guideData: any) => {
        const guideId = guideData.guideId;
        let totalPeopleRegistered = 0;
        try {
          // Obtener registros de personas para el período
          totalPeopleRegistered = await GuideRegistration.sum('peopleCount', {
            where: {
              guideId,
              registrationDate: {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
              },
              isActive: true,
            },
          }) || 0;
        } catch (err) {
          totalPeopleRegistered = 0;
        }

        const totalSales = parseInt((guideData.totalSales as any) ?? '0') || 0;
        const closurePercentage = totalPeopleRegistered > 0
          ? (totalSales / totalPeopleRegistered) * 100
          : 0;

        return {
          ...guideData,
          totalPeopleRegistered,
          closurePercentage: Math.round(closurePercentage * 100) / 100,
        };
      })
    );

    return {
      period: {
        startDate,
        endDate,
      },
      rankings: {
        guides: guidesWithClosure,
        employees: topEmployees,
        products: topProducts,
        agencies: topAgencies,
      },
    };
  }

  static async getGuidePerformance(guideId: string, query: any) {
    const { startDate, endDate } = query;
    const dateWhere: any = { status: 'completed', guideId, saleType: 'GUIDE' };

    if (startDate || endDate) {
      dateWhere.saleDate = {};
      if (startDate) dateWhere.saleDate[Op.gte] = new Date(startDate);
      if (endDate) dateWhere.saleDate[Op.lte] = new Date(endDate);
    }

    // Estadísticas de ventas
    const salesStats = await Sale.findAll({
      where: dateWhere,
      attributes: [
        [fn('COUNT', col('id')), 'totalSales'],
        [fn('SUM', col('total')), 'totalRevenue'],
        [fn('AVG', col('total')), 'averageTicket'],
        [fn('SUM', col('guideCommission')), 'totalCommission'],
      ],
      raw: true,
    });

    // Estadísticas de registros
    const registrationWhere: any = { guideId, isActive: true };
    if (startDate || endDate) {
      registrationWhere.registrationDate = {};
      if (startDate) registrationWhere.registrationDate[Op.gte] = new Date(startDate);
      if (endDate) registrationWhere.registrationDate[Op.lte] = new Date(endDate);
    }

    const registrationStats = await GuideRegistration.findAll({
      where: registrationWhere,
      attributes: [
        [fn('COUNT', col('id')), 'totalRegistrations'],
        [fn('SUM', col('peopleCount')), 'totalPeople'],
        [fn('AVG', col('peopleCount')), 'averagePeoplePerRegistration'],
      ],
      raw: true,
    });

    // Ventas por día
    const dailySales = await Sale.findAll({
      where: dateWhere,
      attributes: [
        [fn('DATE', col('saleDate')), 'date'],
        [fn('COUNT', col('id')), 'sales'],
        [fn('SUM', col('total')), 'revenue'],
      ],
      group: [fn('DATE', col('saleDate'))],
      order: [[fn('DATE', col('saleDate')), 'ASC']],
      raw: true,
    });

    const totalSales = parseInt((salesStats[0] as any)?.totalSales as string) || 0;
    const totalPeople = parseInt((registrationStats[0] as any)?.totalPeople as string) || 0;
    const closurePercentage = totalPeople > 0 ? (totalSales / totalPeople) * 100 : 0;

    return {
      sales: salesStats[0],
      registrations: registrationStats[0],
      closurePercentage: Math.round(closurePercentage * 100) / 100,
      dailyPerformance: dailySales,
    };
  }

  static async getEmployeePerformance(employeeId: string, query: any) {
    const { startDate, endDate } = query;
    const dateWhere: any = { status: 'completed', employeeId };

    if (startDate || endDate) {
      dateWhere.saleDate = {};
      if (startDate) dateWhere.saleDate[Op.gte] = new Date(startDate);
      if (endDate) dateWhere.saleDate[Op.lte] = new Date(endDate);
    }

    // Estadísticas de ventas
    const salesStats = await Sale.findAll({
      where: dateWhere,
      attributes: [
        [fn('COUNT', col('id')), 'totalSales'],
        [fn('SUM', col('total')), 'totalRevenue'],
        [fn('AVG', col('total')), 'averageTicket'],
        [fn('SUM', col('employeeCommission')), 'totalCommission'],
      ],
      raw: true,
    });

    // Ventas por tipo
    const salesByType = await Sale.findAll({
      where: dateWhere,
      attributes: [
        'saleType',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('total')), 'revenue'],
      ],
      group: ['saleType'],
      raw: true,
    });

    // Ventas por día
    const dailySales = await Sale.findAll({
      where: dateWhere,
      attributes: [
        [fn('DATE', col('saleDate')), 'date'],
        [fn('COUNT', col('id')), 'sales'],
        [fn('SUM', col('total')), 'revenue'],
      ],
      group: [fn('DATE', col('saleDate'))],
      order: [[fn('DATE', col('saleDate')), 'ASC']],
      raw: true,
    });

    return {
      sales: salesStats[0],
      salesByType,
      dailyPerformance: dailySales,
    };
  }

  static async getProductPerformance(query: any) {
    console.log('[getProductPerformance] query:', query);
    const { startDate, endDate, limit = 20 } = query || {};
    const dateWhere: any = { status: 'completed' };

    if (startDate || endDate) {
      dateWhere.saleDate = {};
      if (startDate) dateWhere.saleDate[Op.gte] = new Date(startDate);
      if (endDate) dateWhere.saleDate[Op.lte] = new Date(endDate);
    }

    const whereDatesSQL = startDate || endDate
      ? `AND ${startDate ? 's.saleDate >= :startDate' : ''} ${endDate ? 'AND s.saleDate <= :endDate' : ''}`
      : '';

    console.log('[getProductPerformance] whereDatesSQL:', whereDatesSQL);
    try {
      console.log('[RankingService.getProductPerformance] Executing product performance query...');
      const [rows] = await sequelize.query(
        `
        SELECT 
          si.productId AS productId,
          p.id AS product_id,
          p.name AS product_name,
          p.code AS product_code,
          p.salePrice AS product_price,
          p.category AS product_category,
          SUM(si.quantity) AS totalQuantity,
          SUM(si.quantity * si.unitPrice) AS totalRevenue,
          COUNT(si.id) AS totalTransactions,
          AVG(si.unitPrice) AS averagePrice
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.saleId
        INNER JOIN products p ON p.id = si.productId
        WHERE s.status = 'completed'
          ${whereDatesSQL}
        GROUP BY si.productId, p.id, p.name, p.code, p.salePrice, p.category
        ORDER BY totalRevenue DESC
        LIMIT :limit
        `,
        {
          replacements: { startDate, endDate, limit: parseInt(limit) },
          logging: console.log,
        }
      );

      console.log('[getProductPerformance] rows length:', Array.isArray(rows) ? rows.length : 'not-array');
      return (rows as any[]).map(r => ({
        productId: r.productId,
        product: {
          id: r.product_id,
          name: r.product_name,
          code: r.product_code,
          price: r.product_price,
          category: r.product_category,
        },
        totalQuantity: r.totalQuantity,
        totalRevenue: r.totalRevenue,
        totalTransactions: r.totalTransactions,
        averagePrice: r.averagePrice,
      }));
    } catch (err: any) {
      console.error('[getProductPerformance] Error:', err?.message, err?.sql);
      return [];
    }
  }

  static async getAgencyPerformance(query: any) {
    const { startDate, endDate } = query;
    const dateWhere: any = { status: 'completed', saleType: 'GUIDE' };

    if (startDate || endDate) {
      dateWhere.saleDate = {};
      if (startDate) dateWhere.saleDate[Op.gte] = new Date(startDate);
      if (endDate) dateWhere.saleDate[Op.lte] = new Date(endDate);
    }

    const agencyStats = await Sale.findAll({
      where: dateWhere,
      attributes: [
        'agencyId',
        [fn('COUNT', col('Sale.id')), 'totalSales'],
        [fn('SUM', col('total')), 'totalRevenue'],
        [fn('AVG', col('total')), 'averageTicket'],
        [fn('SUM', col('agencyCommission')), 'totalCommission'],
        [fn('COUNT', fn('DISTINCT', col('guideId'))), 'activeGuides'],
      ],
      include: [
        {
          model: Agency,
          as: 'agency',
          attributes: ['id', 'code', 'name'],
        },
      ],
      group: ['agencyId', 'agency.id'],
      order: [[fn('SUM', col('total')), 'DESC']],
      raw: false,
    });

    return agencyStats;
  }
}


