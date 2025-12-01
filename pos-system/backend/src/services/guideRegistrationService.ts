import { Op, fn, col } from 'sequelize';
import { sequelize } from '../db/config';
import { GuideRegistration, GuideRegistrationCreationAttributes } from '../models/GuideRegistration';
import Guide from '../models/Guide';
import Employee from '../models/Employee';
import Branch from '../models/Branch';
import Sale from '../models/Sale';

export class GuideRegistrationService {
  static async createRegistration(data: GuideRegistrationCreationAttributes) {
    const {
      guideId,
      employeeId,
      branchId,
      registrationDate,
      peopleCount,
      notes,
    } = data;

    // Validar que el guía existe y está activo
    const guide = await Guide.findByPk(guideId);
    if (!guide || !guide.isActive) {
      throw new Error('Guía no encontrado o inactivo');
    }

    // Validar empleado si se especifica
    if (employeeId) {
      const employee = await Employee.findByPk(employeeId);
      if (!employee || !employee.isActive) {
        throw new Error('Empleado no encontrado o inactivo');
      }

      // Si se especifica sucursal, validar que el empleado pertenezca a ella
      if (branchId && employee.branchId !== branchId) {
        throw new Error('El empleado no pertenece a la sucursal especificada');
      }
    }

    // Validar sucursal si se especifica
    if (branchId) {
      const branch = await Branch.findByPk(branchId);
      if (!branch || !branch.isActive) {
        throw new Error('Sucursal no encontrada o inactiva');
      }
    }

    // Crear el registro
    const registration = await GuideRegistration.create({
      guideId,
      employeeId,
      branchId,
      registrationDate: registrationDate || new Date(),
      peopleCount,
      notes,
    });

    // Retornar con datos relacionados
    return await GuideRegistration.findByPk(registration.id, {
      include: [
        {
          model: Guide,
          as: 'guide',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });
  }

  static async getRegistrations(query: any) {
    const {
      page = 1,
      limit = 10,
      guideId,
      employeeId,
      branchId,
      startDate,
      endDate,
      isActive = true,
    } = query;

    const offset = (page - 1) * limit;
    const where: any = { isActive };

    // Filtros
    if (guideId) where.guideId = guideId;
    if (employeeId) where.employeeId = employeeId;
    if (branchId) where.branchId = branchId;

    if (startDate || endDate) {
      where.registrationDate = {};
      if (startDate) where.registrationDate[Op.gte] = new Date(startDate);
      if (endDate) where.registrationDate[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await GuideRegistration.findAndCountAll({
      where,
      include: [
        {
          model: Guide,
          as: 'guide',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'code', 'name'],
        },
      ],
      order: [['registrationDate', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return {
      registrations: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async getRegistrationById(id: string) {
    return await GuideRegistration.findByPk(id, {
      include: [
        {
          model: Guide,
          as: 'guide',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });
  }

  static async updateRegistration(id: string, data: Partial<GuideRegistrationCreationAttributes>) {
    const registration = await GuideRegistration.findByPk(id);
    if (!registration) {
      return null;
    }

    // Validaciones similares a createRegistration si se actualizan campos relacionados
    if (data.guideId && data.guideId !== registration.guideId) {
      const guide = await Guide.findByPk(data.guideId);
      if (!guide || !guide.isActive) {
        throw new Error('Guía no encontrado o inactivo');
      }
    }

    if (data.employeeId && data.employeeId !== registration.employeeId) {
      const employee = await Employee.findByPk(data.employeeId);
      if (!employee || !employee.isActive) {
        throw new Error('Empleado no encontrado o inactivo');
      }
    }

    if (data.branchId && data.branchId !== registration.branchId) {
      const branch = await Branch.findByPk(data.branchId);
      if (!branch || !branch.isActive) {
        throw new Error('Sucursal no encontrada o inactiva');
      }
    }

    await registration.update(data);

    return await GuideRegistration.findByPk(id, {
      include: [
        {
          model: Guide,
          as: 'guide',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });
  }

  static async deleteRegistration(id: string) {
    const registration = await GuideRegistration.findByPk(id);
    if (!registration) {
      return false;
    }

    await registration.update({ isActive: false });
    return true;
  }

  static async getGuideStats(guideId: string, query: any) {
    const { startDate, endDate } = query;
    const where: any = { guideId, isActive: true };

    if (startDate || endDate) {
      where.registrationDate = {};
      if (startDate) where.registrationDate[Op.gte] = new Date(startDate);
      if (endDate) where.registrationDate[Op.lte] = new Date(endDate);
    }

    // Estadísticas de registros
    const registrationStats = await GuideRegistration.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalRegistrations'],
        [sequelize.fn('SUM', sequelize.col('peopleCount')), 'totalPeople'],
        [sequelize.fn('AVG', sequelize.col('peopleCount')), 'averagePeoplePerRegistration'],
        [sequelize.fn('MAX', sequelize.col('peopleCount')), 'maxPeopleInRegistration'],
        [sequelize.fn('MIN', sequelize.col('peopleCount')), 'minPeopleInRegistration'],
      ],
      raw: true,
    });

    return {
      registrations: registrationStats[0],
    };
  }

  static async getClosurePercentage(guideId: string, query: any) {
    const { startDate, endDate } = query;
    const dateWhere: any = {};

    if (startDate || endDate) {
      if (startDate) dateWhere[Op.gte] = new Date(startDate);
      if (endDate) dateWhere[Op.lte] = new Date(endDate);
    }

    // Obtener total de personas registradas
    const registrationWhere: any = { guideId, isActive: true };
    if (Object.keys(dateWhere).length > 0) {
      registrationWhere.registrationDate = dateWhere;
    }

    const totalPeopleRegistered = await GuideRegistration.sum('peopleCount', {
      where: registrationWhere,
    }) || 0;

    // Obtener total de ventas realizadas por el guía
    const salesWhere: any = { guideId, saleType: 'GUIDE', status: 'completed' };
    if (Object.keys(dateWhere).length > 0) {
      salesWhere.saleDate = dateWhere;
    }

    const salesStats = await Sale.findAll({
      where: salesWhere,
      attributes: [
        [fn('COUNT', col('id')), 'totalSales'],
        [fn('SUM', col('total')), 'totalRevenue'],
        [fn('AVG', col('total')), 'averageTicket'],
      ],
      raw: true,
    });

    const totalSales = parseInt((salesStats[0] as any)?.totalSales as string) || 0;
    const totalRevenue = parseFloat((salesStats[0] as any)?.totalRevenue as string) || 0;
    const averageTicket = parseFloat((salesStats[0] as any)?.averageTicket as string) || 0;

    // Calcular porcentaje de cierre
    const closurePercentage = totalPeopleRegistered > 0 
      ? (totalSales / totalPeopleRegistered) * 100 
      : 0;

    return {
      totalPeopleRegistered,
      totalSales,
      totalRevenue,
      averageTicket,
      closurePercentage: Math.round(closurePercentage * 100) / 100, // Redondear a 2 decimales
    };
  }
}
