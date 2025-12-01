import { Request, Response } from 'express';
import Guide from '../models/Guide';
import Agency from '../models/Agency';
import { sequelize } from '../db/config';
import DailyGuideReport from '../models/DailyGuideReport';
import Barcode from '../models/Barcode';
import { Op } from 'sequelize';

export class GuideController {
  
  // Obtener todos los guías
  static async getAllGuides(req: Request, res: Response) {
    try {
      const tables = await sequelize.getQueryInterface().showAllTables();
      if (!tables.includes('guides')) {
        return res.json({ success: true, data: [] });
      }
      const { isActive, agencyId } = req.query;

      const whereClause: any = {};
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }
      if (agencyId) {
        whereClause.agencyId = agencyId;
      }

      const guides = await Guide.findAll({
        where: whereClause,
        include: tables.includes('agencies') ? [
          {
            model: Agency,
            as: 'agency',
            attributes: ['id', 'code', 'name']
          }
        ] : [],
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: guides
      });

    } catch (error) {
      res.json({ success: true, data: [] });
    }
  }

  // Obtener guía por ID
  static async getGuideById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const guide = await Guide.findByPk(id, {
        include: [
          {
            model: Agency,
            as: 'agency',
            attributes: ['id', 'code', 'name', 'commissionRate']
          }
        ]
      });

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      res.json({
        success: true,
        data: guide
      });

    } catch (error) {
      console.error('Error al obtener guía:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear nuevo guía
  static async createGuide(req: Request, res: Response) {
    try {
      const { 
        code, 
        name, 
        agencyId, 
        commissionFormula, 
        discountPercentage, 
        commissionRate, 
        phone, 
        email 
      } = req.body;

      if (!code || !name || !agencyId) {
        return res.status(400).json({
          success: false,
          message: 'Código, nombre y agencia son requeridos'
        });
      }

      // Verificar si la agencia existe
      const agency = await Agency.findByPk(agencyId);
      if (!agency) {
        return res.status(400).json({
          success: false,
          message: 'La agencia especificada no existe'
        });
      }

      // Verificar si el código ya existe
      const existingGuide = await Guide.findOne({ where: { code } });
      if (existingGuide) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un guía con este código'
        });
      }

      const guide = await Guide.create({
        code,
        name,
        agencyId,
        commissionFormula: commissionFormula || 'DISCOUNT_PERCENTAGE',
        discountPercentage: discountPercentage || 18,
        commissionRate: commissionRate || 10,
        phone,
        email,
        isActive: true
      });

      // Obtener la agencia para generar el código de barras
      const agencyForBarcode = await Agency.findByPk(agencyId);
      if (agencyForBarcode) {
        // Contar guías existentes para generar secuencia
        const guideCount = await Guide.count({ where: { agencyId } });
        const barcodeValue = Barcode.generateGuideBarcode(agencyForBarcode.code, guideCount);
        
        // Crear el código de barras
        await Barcode.create({
          code: barcodeValue,
          type: 'GUIDE',
          entityId: guide.id,
          isActive: true
        });
      }

      // Incluir la agencia en la respuesta
      const guideWithAgency = await Guide.findByPk(guide.id, {
        include: [
          {
            model: Agency,
            as: 'agency',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      res.status(201).json({
        success: true,
        data: guideWithAgency,
        message: 'Guía creado exitosamente'
      });

    } catch (error) {
      console.error('Error al crear guía:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar guía
  static async updateGuide(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        code, 
        name, 
        agencyId, 
        commissionFormula, 
        discountPercentage, 
        commissionRate, 
        phone, 
        email, 
        isActive 
      } = req.body;

      const guide = await Guide.findByPk(id);

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      // Verificar si el código ya existe en otro guía
      if (code && code !== guide.code) {
        const existingGuide = await Guide.findOne({ 
          where: { 
            code,
            id: { [Op.ne]: id }
          } 
        });
        if (existingGuide) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otro guía con este código'
          });
        }
      }

      // Verificar si la agencia existe
      if (agencyId && agencyId !== guide.agencyId) {
        const agency = await Agency.findByPk(agencyId);
        if (!agency) {
          return res.status(400).json({
            success: false,
            message: 'La agencia especificada no existe'
          });
        }
      }

      // Actualizar campos
      if (code !== undefined) guide.code = code;
      if (name !== undefined) guide.name = name;
      if (agencyId !== undefined) guide.agencyId = agencyId;
      if (commissionFormula !== undefined) guide.commissionFormula = commissionFormula;
      if (discountPercentage !== undefined) guide.discountPercentage = discountPercentage;
      if (commissionRate !== undefined) guide.commissionRate = commissionRate;
      if (phone !== undefined) guide.phone = phone;
      if (email !== undefined) guide.email = email;
      if (isActive !== undefined) guide.isActive = isActive;

      await guide.save();

      // Incluir la agencia en la respuesta
      const guideWithAgency = await Guide.findByPk(guide.id, {
        include: [
          {
            model: Agency,
            as: 'agency',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      res.json({
        success: true,
        data: guideWithAgency,
        message: 'Guía actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error al actualizar guía:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Eliminar guía (soft delete)
  static async deleteGuide(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const guide = await Guide.findByPk(id);

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      guide.isActive = false;
      await guide.save();

      // Desactivar también su código de barras
      await Barcode.update(
        { isActive: false },
        { 
          where: { 
            type: 'GUIDE',
            entityId: id
          }
        }
      );

      res.json({
        success: true,
        message: 'Guía desactivado exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar guía:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Registrar personas del día para un guía
  static async registerDailyPeople(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { date, totalPeople } = req.body;

      if (!date || totalPeople === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Fecha y total de personas son requeridos'
        });
      }

      const guide = await Guide.findByPk(id);

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      // Buscar o crear el reporte diario
      const [dailyReport, created] = await DailyGuideReport.findOrCreate({
        where: {
          guideId: id,
          date: new Date(date)
        },
        defaults: {
          guideId: id,
          date: new Date(date),
          totalPeople: totalPeople
        }
      });

      if (!created) {
        dailyReport.totalPeople = totalPeople;
        await dailyReport.save();
      }

      res.json({
        success: true,
        data: dailyReport,
        message: created ? 'Registro creado exitosamente' : 'Registro actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error al registrar personas del día:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener reportes diarios de un guía
  static async getDailyReports(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const guide = await Guide.findByPk(id);

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      const whereClause: any = { guideId: id };

      if (startDate && endDate) {
        whereClause.date = {
          [Op.between]: [new Date(startDate as string), new Date(endDate as string)]
        };
      } else if (startDate) {
        whereClause.date = {
          [Op.gte]: new Date(startDate as string)
        };
      } else if (endDate) {
        whereClause.date = {
          [Op.lte]: new Date(endDate as string)
        };
      }

      const reports = await DailyGuideReport.findAll({
        where: whereClause,
        order: [['date', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          guide: {
            id: guide.id,
            code: guide.code,
            name: guide.name
          },
          reports
        }
      });

    } catch (error) {
      console.error('Error al obtener reportes diarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas del guía
  static async getGuideStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const guide = await Guide.findByPk(id, {
        include: [
          {
            model: Agency,
            as: 'agency',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      if (!guide) {
        return res.status(404).json({
          success: false,
          message: 'Guía no encontrado'
        });
      }

      // Obtener estadísticas de reportes diarios
      const whereClause: any = { guideId: id };

      if (startDate && endDate) {
        whereClause.date = {
          [Op.between]: [new Date(startDate as string), new Date(endDate as string)]
        };
      }

      const reports = await DailyGuideReport.findAll({
        where: whereClause,
        order: [['date', 'DESC']]
      });

      const totalPeople = reports.reduce((sum, report) => sum + report.totalPeople, 0);
      const totalSales = reports.reduce((sum, report) => sum + report.totalSales, 0);
      const totalSalesCount = reports.reduce((sum, report) => sum + report.totalSalesCount, 0);
      const averageClosingPercentage = reports.length > 0 
        ? reports.reduce((sum, report) => sum + (report.closingPercentage || 0), 0) / reports.length 
        : 0;
      const averageTicket = totalSalesCount > 0 ? totalSales / totalSalesCount : 0;

      res.json({
        success: true,
        data: {
          guide,
          stats: {
            totalPeople,
            totalSales,
            totalSalesCount,
            averageClosingPercentage: Math.round(averageClosingPercentage * 100) / 100,
            averageTicket: Math.round(averageTicket * 100) / 100,
            totalDays: reports.length
          },
          recentReports: reports.slice(0, 10) // Últimos 10 reportes
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas del guía:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}