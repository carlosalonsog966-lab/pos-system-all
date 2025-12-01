import { Request, Response } from 'express';
import Employee from '../models/Employee';
import Branch from '../models/Branch';
import Barcode from '../models/Barcode';
import { Op } from 'sequelize';

export class EmployeeController {
  
  // Obtener todos los empleados
  static async getAllEmployees(req: Request, res: Response) {
    try {
      const { isActive, branchId } = req.query;

      const whereClause: any = {};
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }
      if (branchId) {
        whereClause.branchId = branchId;
      }

      const employees = await Employee.findAll({
        where: whereClause,
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'code', 'name']
          }
        ],
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: employees
      });

    } catch (error) {
      console.error('Error al obtener empleados:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener empleado por ID
  static async getEmployeeById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await Employee.findByPk(id, {
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      res.json({
        success: true,
        data: employee
      });

    } catch (error) {
      console.error('Error al obtener empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear nuevo empleado
  static async createEmployee(req: Request, res: Response) {
    try {
      const { 
        code, 
        name, 
        branchId, 
        commissionFormula, 
        discountPercentage, 
        commissionRate, 
        streetSaleCardRate,
        streetSaleCashRate,
        phone, 
        email 
      } = req.body;

      if (!code || !name || !branchId) {
        return res.status(400).json({
          success: false,
          message: 'Código, nombre y sucursal son requeridos'
        });
      }

      // Verificar si la sucursal existe
      const branch = await Branch.findByPk(branchId);
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'La sucursal especificada no existe'
        });
      }

      // Verificar si el código ya existe
      const existingEmployee = await Employee.findOne({ where: { code } });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un empleado con este código'
        });
      }

      const employee = await Employee.create({
        code,
        name,
        branchId,
        commissionFormula: commissionFormula || 'DISCOUNT_PERCENTAGE',
        discountPercentage: discountPercentage || 5,
        commissionRate: commissionRate || 9,
        streetSaleCardRate: streetSaleCardRate || 12,
        streetSaleCashRate: streetSaleCashRate || 14,
        phone,
        email,
        isActive: true
      });

      // Obtener la sucursal para generar el código de barras
      const branchForBarcode = await Branch.findByPk(branchId);
      if (branchForBarcode) {
        // Contar empleados existentes para generar secuencia
        const employeeCount = await Employee.count({ where: { branchId } });
        const barcodeValue = Barcode.generateEmployeeBarcode(branchForBarcode.code, employeeCount + 1);
        
        // Crear el código de barras
        await Barcode.create({
          code: barcodeValue,
          type: 'EMPLOYEE',
          entityId: employee.id,
          isActive: true
        });
      }

      // Incluir la sucursal en la respuesta
      const employeeWithBranch = await Employee.findByPk(employee.id, {
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      res.status(201).json({
        success: true,
        data: employeeWithBranch,
        message: 'Empleado creado exitosamente'
      });

    } catch (error) {
      console.error('Error al crear empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar empleado
  static async updateEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        code, 
        name, 
        branchId, 
        commissionFormula, 
        discountPercentage, 
        commissionRate, 
        streetSaleCardRate,
        streetSaleCashRate,
        phone, 
        email, 
        isActive 
      } = req.body;

      const employee = await Employee.findByPk(id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      // Verificar si el código ya existe en otro empleado
      if (code && code !== employee.code) {
        const existingEmployee = await Employee.findOne({ 
          where: { 
            code,
            id: { [Op.ne]: id }
          } 
        });
        if (existingEmployee) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otro empleado con este código'
          });
        }
      }

      // Verificar si la sucursal existe
      if (branchId && branchId !== employee.branchId) {
        const branch = await Branch.findByPk(branchId);
        if (!branch) {
          return res.status(400).json({
            success: false,
            message: 'La sucursal especificada no existe'
          });
        }
      }

      // Actualizar campos
      if (code !== undefined) employee.code = code;
      if (name !== undefined) employee.name = name;
      if (branchId !== undefined) employee.branchId = branchId;
      if (commissionFormula !== undefined) employee.commissionFormula = commissionFormula;
      if (discountPercentage !== undefined) employee.discountPercentage = discountPercentage;
      if (commissionRate !== undefined) employee.commissionRate = commissionRate;
      if (streetSaleCardRate !== undefined) employee.streetSaleCardRate = streetSaleCardRate;
      if (streetSaleCashRate !== undefined) employee.streetSaleCashRate = streetSaleCashRate;
      if (phone !== undefined) employee.phone = phone;
      if (email !== undefined) employee.email = email;
      if (isActive !== undefined) employee.isActive = isActive;

      await employee.save();

      // Incluir la sucursal en la respuesta
      const employeeWithBranch = await Employee.findByPk(employee.id, {
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      res.json({
        success: true,
        data: employeeWithBranch,
        message: 'Empleado actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error al actualizar empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Eliminar empleado (soft delete)
  static async deleteEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await Employee.findByPk(id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      employee.isActive = false;
      await employee.save();

      // Desactivar también su código de barras
      await Barcode.update(
        { isActive: false },
        { 
          where: { 
            type: 'EMPLOYEE',
            entityId: id
          }
        }
      );

      res.json({
        success: true,
        message: 'Empleado desactivado exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Calcular comisión para un empleado
  static async calculateCommission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { saleAmount, saleType, paymentMethod } = req.body;

      if (!saleAmount || !saleType) {
        return res.status(400).json({
          success: false,
          message: 'Monto de venta y tipo de venta son requeridos'
        });
      }

      const employee = await Employee.findByPk(id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const commission = employee.calculateCommission(saleAmount, saleType);

      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            code: employee.code,
            name: employee.name
          },
          calculation: {
            saleAmount,
            saleType,
            paymentMethod,
            commission,
            commissionRate: saleType === 'WITH_GUIDE' 
              ? employee.commissionRate 
              : (saleType === 'STREET_CARD' ? employee.streetSaleCardRate : employee.streetSaleCashRate)
          }
        }
      });

    } catch (error) {
      console.error('Error al calcular comisión:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas del empleado
  static async getEmployeeStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const employee = await Employee.findByPk(id, {
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'code', 'name']
          }
        ]
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      // Aquí se pueden agregar consultas para obtener estadísticas de ventas
      // Por ahora, retornamos información básica
      res.json({
        success: true,
        data: {
          employee,
          stats: {
            // Aquí se pueden agregar estadísticas como:
            // totalSales, totalCommissions, averageTicket, etc.
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas del empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Generar códigos de barras en masa para empleados activos
  static async bulkGenerateEmployeeBarcodes(req: Request, res: Response) {
    try {
      const employees = await Employee.findAll({
        where: { isActive: true }
      });

      let created = 0;
      let skippedExisting = 0;
      let skippedNoBranch = 0;

      const branchSequences: Record<string, number> = {};

      for (const emp of employees) {
        // Saltar si ya tiene un código de barras activo
        const existing = await Barcode.findOne({
          where: { type: 'EMPLOYEE', entityId: emp.id, isActive: true }
        });

        if (existing) {
          skippedExisting++;
          continue;
        }

        if (!emp.branchId) {
          skippedNoBranch++;
          continue;
        }

        const branch = await Branch.findByPk(emp.branchId);
        if (!branch || !branch.code) {
          skippedNoBranch++;
          continue;
        }

        // Calcular siguiente secuencia por sucursal, cacheada en memoria
        const branchKey = String(branch.id);
        if (branchSequences[branchKey] === undefined) {
          const lastForBranch = await Barcode.findOne({
            where: { type: 'EMPLOYEE' },
            include: [
              {
                model: Employee,
                as: 'employee',
                where: { branchId: branch.id },
                required: true
              }
            ],
            order: [['createdAt', 'DESC']]
          });

          if (lastForBranch) {
            const last = parseInt((lastForBranch.code.split('-').pop() || '0'), 10);
            branchSequences[branchKey] = isNaN(last) ? 1 : last + 1;
          } else {
            branchSequences[branchKey] = 1;
          }
        }

        const seq = branchSequences[branchKey];
        const barcodeValue = Barcode.generateEmployeeBarcode(branch.code, seq);

        await Barcode.create({
          code: barcodeValue,
          type: 'EMPLOYEE',
          entityId: emp.id,
          isActive: true
        });

        // Incrementar para siguiente empleado en la misma sucursal
        branchSequences[branchKey] = seq + 1;
        created++;
      }

      return res.json({
        success: true,
        data: {
          totalEmployees: employees.length,
          created,
          skippedExisting,
          skippedNoBranch
        },
        message: 'Generación masiva de códigos de vendedores completada'
      });
    } catch (error) {
      console.error('Error en generación masiva de códigos de empleados:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}
