import { Request, Response } from 'express';
import Branch from '../models/Branch';
import Employee from '../models/Employee';

export class BranchController {
  
  // Obtener todas las sucursales
  static async getAllBranches(req: Request, res: Response) {
    try {
      const { isActive } = req.query;

      const whereClause: any = {};
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      const branches = await Branch.findAll({
        where: whereClause,
        include: [
          {
            model: Employee,
            as: 'employees',
            attributes: ['id', 'code', 'name', 'isActive'],
            where: { isActive: true },
            required: false
          }
        ],
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: branches
      });

    } catch (error) {
      console.error('Error al obtener sucursales:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener sucursal por ID
  static async getBranchById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const branch = await Branch.findByPk(id, {
        include: [
          {
            model: Employee,
            as: 'employees',
            attributes: ['id', 'code', 'name', 'commissionFormula', 'discountPercentage', 'commissionRate', 'isActive']
          }
        ]
      });

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      res.json({
        success: true,
        data: branch
      });

    } catch (error) {
      console.error('Error al obtener sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear nueva sucursal
  static async createBranch(req: Request, res: Response) {
    try {
      const { code, name, address, phone, manager } = req.body;

      if (!code || !name) {
        return res.status(400).json({
          success: false,
          message: 'Código y nombre son requeridos'
        });
      }

      // Verificar si el código ya existe
      const existingBranch = await Branch.findOne({ where: { code } });
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una sucursal con este código'
        });
      }

      const branch = await Branch.create({
        code,
        name,
        address,
        phone,
        manager,
        isActive: true
      });

      res.status(201).json({
        success: true,
        data: branch,
        message: 'Sucursal creada exitosamente'
      });

    } catch (error) {
      console.error('Error al crear sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar sucursal
  static async updateBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code, name, address, phone, manager, isActive } = req.body;

      const branch = await Branch.findByPk(id);

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      // Verificar si el código ya existe en otra sucursal
      if (code && code !== branch.code) {
        const existingBranch = await Branch.findOne({ 
          where: { 
            code,
            id: { $ne: id }
          } 
        });
        if (existingBranch) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otra sucursal con este código'
          });
        }
      }

      // Actualizar campos
      if (code !== undefined) branch.code = code;
      if (name !== undefined) branch.name = name;
      if (address !== undefined) branch.address = address;
      if (phone !== undefined) branch.phone = phone;
      if (manager !== undefined) branch.manager = manager;
      if (isActive !== undefined) branch.isActive = isActive;

      await branch.save();

      res.json({
        success: true,
        data: branch,
        message: 'Sucursal actualizada exitosamente'
      });

    } catch (error) {
      console.error('Error al actualizar sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Eliminar sucursal (soft delete)
  static async deleteBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const branch = await Branch.findByPk(id);

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      // Verificar si tiene empleados activos
      const activeEmployees = await Employee.count({
        where: {
          branchId: id,
          isActive: true
        }
      });

      if (activeEmployees > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar la sucursal porque tiene empleados activos'
        });
      }

      branch.isActive = false;
      await branch.save();

      res.json({
        success: true,
        message: 'Sucursal desactivada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas de la sucursal
  static async getBranchStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const branch = await Branch.findByPk(id);

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      // Obtener estadísticas básicas
      const totalEmployees = await Employee.count({
        where: {
          branchId: id,
          isActive: true
        }
      });

      res.json({
        success: true,
        data: {
          branch: {
            id: branch.id,
            code: branch.code,
            name: branch.name,
            manager: branch.manager
          },
          stats: {
            totalEmployees,
            // Aquí se pueden agregar más estadísticas como:
            // totalSales, totalCommissions, etc.
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas de sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}