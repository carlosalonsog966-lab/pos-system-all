import { Request, Response } from 'express';
import Agency from '../models/Agency';
import Guide from '../models/Guide';
import { sequelize } from '../db/config';

export class AgencyController {
  
  // Obtener todas las agencias
  static async getAllAgencies(req: Request, res: Response) {
    try {
      const tables = await sequelize.getQueryInterface().showAllTables();
      if (!tables.includes('agencies')) {
        return res.json({ success: true, data: [] });
      }
      const { isActive } = req.query;

      const whereClause: any = {};
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      const agencies = await Agency.findAll({
        where: whereClause,
        include: tables.includes('guides') ? [
          {
            model: Guide,
            as: 'guides',
            attributes: ['id', 'code', 'name', 'isActive'],
            where: { isActive: true },
            required: false
          }
        ] : [],
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: agencies
      });

    } catch (error) {
      res.json({ success: true, data: [] });
    }
  }

  // Obtener agencia por ID
  static async getAgencyById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const agency = await Agency.findByPk(id, {
        include: [
          {
            model: Guide,
            as: 'guides',
            attributes: ['id', 'code', 'name', 'commissionFormula', 'discountPercentage', 'commissionRate', 'isActive']
          }
        ]
      });

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agencia no encontrada'
        });
      }

      res.json({
        success: true,
        data: agency
      });

    } catch (error) {
      console.error('Error al obtener agencia:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear nueva agencia
  static async createAgency(req: Request, res: Response) {
    try {
      const { code, name, commissionRate, contactPerson, phone, email, address } = req.body;

      if (!code || !name || commissionRate === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Código, nombre y tasa de comisión son requeridos'
        });
      }

      // Verificar si el código ya existe
      const existingAgency = await Agency.findOne({ where: { code } });
      if (existingAgency) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una agencia con este código'
        });
      }

      const agency = await Agency.create({
        code,
        name,
        commissionRate,
        contactPerson,
        phone,
        email,
        address,
        isActive: true
      });

      res.status(201).json({
        success: true,
        data: agency,
        message: 'Agencia creada exitosamente'
      });

    } catch (error) {
      console.error('Error al crear agencia:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar agencia
  static async updateAgency(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code, name, commissionRate, contactPerson, phone, email, address, isActive } = req.body;

      const agency = await Agency.findByPk(id);

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agencia no encontrada'
        });
      }

      // Verificar si el código ya existe en otra agencia
      if (code && code !== agency.code) {
        const existingAgency = await Agency.findOne({ 
          where: { 
            code,
            id: { $ne: id }
          } 
        });
        if (existingAgency) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otra agencia con este código'
          });
        }
      }

      // Actualizar campos
      if (code !== undefined) agency.code = code;
      if (name !== undefined) agency.name = name;
      if (commissionRate !== undefined) agency.commissionRate = commissionRate;
      if (contactPerson !== undefined) agency.contactPerson = contactPerson;
      if (phone !== undefined) agency.phone = phone;
      if (email !== undefined) agency.email = email;
      if (address !== undefined) agency.address = address;
      if (isActive !== undefined) agency.isActive = isActive;

      await agency.save();

      res.json({
        success: true,
        data: agency,
        message: 'Agencia actualizada exitosamente'
      });

    } catch (error) {
      console.error('Error al actualizar agencia:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Eliminar agencia (soft delete)
  static async deleteAgency(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const agency = await Agency.findByPk(id);

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agencia no encontrada'
        });
      }

      // Verificar si tiene guías activos
      const activeGuides = await Guide.count({
        where: {
          agencyId: id,
          isActive: true
        }
      });

      if (activeGuides > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar la agencia porque tiene guías activos'
        });
      }

      agency.isActive = false;
      await agency.save();

      res.json({
        success: true,
        message: 'Agencia desactivada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar agencia:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas de la agencia
  static async getAgencyStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const agency = await Agency.findByPk(id);

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agencia no encontrada'
        });
      }

      // Aquí se pueden agregar consultas para obtener estadísticas
      // Por ahora, retornamos información básica
      const totalGuides = await Guide.count({
        where: {
          agencyId: id,
          isActive: true
        }
      });

      res.json({
        success: true,
        data: {
          agency: {
            id: agency.id,
            code: agency.code,
            name: agency.name,
            commissionRate: agency.commissionRate
          },
          stats: {
            totalGuides,
            // Aquí se pueden agregar más estadísticas como:
            // totalSales, totalCommissions, etc.
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas de agencia:', error);
      res.json({
        success: true,
        data: {
          agency: { id: req.params.id, code: '', name: '', commissionRate: 0 },
          stats: { totalGuides: 0 }
        },
        message: 'Estadísticas por defecto (sin datos)'
      });
    }
  }
}
