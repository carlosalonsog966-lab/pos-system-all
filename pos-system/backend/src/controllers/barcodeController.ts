import { Request, Response } from 'express';
import Barcode from '../models/Barcode';
import Guide from '../models/Guide';
import Employee from '../models/Employee';
import Agency from '../models/Agency';
import Branch from '../models/Branch';

export class BarcodeController {
  
  // Escanear código de barras y obtener información
  static async scanBarcode(req: Request, res: Response) {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Código de barras requerido'
        });
      }

      // Buscar el código de barras
      const barcode = await Barcode.findOne({
        where: { 
          code: code.toUpperCase(),
          isActive: true 
        }
      });

      if (!barcode) {
        return res.status(404).json({
          success: false,
          message: 'Código de barras no encontrado o inactivo'
        });
      }

      let entityData = null;

      if (barcode.type === 'GUIDE') {
        // Obtener información del guía
        entityData = await Guide.findByPk(barcode.entityId, {
          include: [
            {
              model: Agency,
              as: 'agency',
              attributes: ['id', 'code', 'name', 'commissionRate']
            }
          ],
          attributes: ['id', 'code', 'name', 'commissionFormula', 'discountPercentage', 'commissionRate', 'isActive']
        });
      } else if (barcode.type === 'EMPLOYEE') {
        // Obtener información del empleado
        entityData = await Employee.findByPk(barcode.entityId, {
          include: [
            {
              model: Branch,
              as: 'branch',
              attributes: ['id', 'code', 'name']
            }
          ],
          attributes: ['id', 'code', 'name', 'commissionFormula', 'discountPercentage', 'commissionRate', 'streetSaleCardRate', 'streetSaleCashRate', 'position', 'isActive']
        });
      }

      if (!entityData || !entityData.isActive) {
        return res.status(404).json({
          success: false,
          message: `${barcode.type === 'GUIDE' ? 'Guía' : 'Empleado'} no encontrado o inactivo`
        });
      }

      res.json({
        success: true,
        data: {
          barcode: {
            code: barcode.code,
            type: barcode.type
          },
          entity: entityData
        }
      });

    } catch (error) {
      console.error('Error al escanear código de barras:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los códigos de barras
  static async getAllBarcodes(req: Request, res: Response) {
    try {
      const { type, isActive } = req.query;

      const whereClause: any = {};
      
      if (type) {
        whereClause.type = type;
      }
      
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      const barcodes = await Barcode.findAll({
        where: whereClause,
        include: [
          {
            model: Guide,
            as: 'guide',
            required: false,
            include: [
              {
                model: Agency,
                as: 'agency',
                attributes: ['code', 'name']
              }
            ]
          },
          {
            model: Employee,
            as: 'employee',
            required: false,
            include: [
              {
                model: Branch,
                as: 'branch',
                attributes: ['code', 'name']
              }
            ]
          }
        ],
        order: [['type', 'ASC'], ['code', 'ASC']]
      });

      res.json({
        success: true,
        data: barcodes
      });

    } catch (error) {
      console.error('Error al obtener códigos de barras:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Generar nuevo código de barras
  static async generateBarcode(req: Request, res: Response) {
    try {
      const { type, entityId } = req.body;

      if (!type || !entityId) {
        return res.status(400).json({
          success: false,
          message: 'Tipo y ID de entidad requeridos'
        });
      }

      // Verificar si ya existe un código para esta entidad
      const existingBarcode = await Barcode.findOne({
        where: {
          type,
          entityId
        }
      });

      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un código de barras para esta entidad'
        });
      }

      let code = '';
      let entity = null;

      if (type === 'GUIDE') {
        entity = await Guide.findByPk(entityId, {
          include: [
            {
              model: Agency,
              as: 'agency',
              attributes: ['code']
            }
          ]
        });

        if (!entity) {
          return res.status(404).json({
            success: false,
            message: 'Guía no encontrado'
          });
        }

        // Obtener el siguiente número de secuencia para guías de esta agencia
        const lastGuideBarcode = await Barcode.findOne({
          where: { type: 'GUIDE' },
          include: [
            {
              model: Guide,
              as: 'guide',
              where: { agencyId: entity.agencyId },
              required: true
            }
          ],
          order: [['createdAt', 'DESC']]
        });

        let sequence = 1;
        if (lastGuideBarcode) {
          const lastCode = lastGuideBarcode.code;
          const lastSequence = parseInt(lastCode.split('-').pop() || '0');
          sequence = lastSequence + 1;
        }

        code = Barcode.generateGuideBarcode(entity.Agency.code, sequence);

      } else if (type === 'EMPLOYEE') {
        entity = await Employee.findByPk(entityId, {
          include: [
            {
              model: Branch,
              as: 'branch',
              attributes: ['code']
            }
          ]
        });

        if (!entity) {
          return res.status(404).json({
            success: false,
            message: 'Empleado no encontrado'
          });
        }

        // Obtener el siguiente número de secuencia para empleados de esta sucursal
        const lastEmployeeBarcode = await Barcode.findOne({
          where: { type: 'EMPLOYEE' },
          include: [
            {
              model: Employee,
              as: 'employee',
              where: { branchId: entity.branchId },
              required: true
            }
          ],
          order: [['createdAt', 'DESC']]
        });

        let sequence = 1;
        if (lastEmployeeBarcode) {
          const lastCode = lastEmployeeBarcode.code;
          const lastSequence = parseInt(lastCode.split('-').pop() || '0');
          sequence = lastSequence + 1;
        }

        code = Barcode.generateEmployeeBarcode(entity.Branch.code, sequence);
      }

      // Crear el código de barras
      const barcode = await Barcode.create({
        code,
        type,
        entityId,
        isActive: true
      });

      res.status(201).json({
        success: true,
        data: barcode,
        message: 'Código de barras generado exitosamente'
      });

    } catch (error) {
      console.error('Error al generar código de barras:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Activar/desactivar código de barras
  static async toggleBarcodeStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const barcode = await Barcode.findByPk(id);

      if (!barcode) {
        return res.status(404).json({
          success: false,
          message: 'Código de barras no encontrado'
        });
      }

      barcode.isActive = isActive;
      await barcode.save();

      res.json({
        success: true,
        data: barcode,
        message: `Código de barras ${isActive ? 'activado' : 'desactivado'} exitosamente`
      });

    } catch (error) {
      console.error('Error al cambiar estado del código de barras:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener información para impresión de códigos
  static async getPrintableBarcodes(req: Request, res: Response) {
    try {
      const { type, entityIds } = req.query;

      const whereClause: any = {
        isActive: true
      };

      if (type) {
        whereClause.type = type;
      }

      if (entityIds) {
        const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
        whereClause.entityId = ids;
      }

      const barcodes = await Barcode.findAll({
        where: whereClause,
        include: [
          {
            model: Guide,
            as: 'guide',
            required: false,
            include: [
              {
                model: Agency,
                as: 'agency',
                attributes: ['code', 'name']
              }
            ]
          },
          {
            model: Employee,
            as: 'employee',
            required: false,
            include: [
              {
                model: Branch,
                as: 'branch',
                attributes: ['code', 'name']
              }
            ]
          }
        ],
        order: [['type', 'ASC'], ['code', 'ASC']]
      });

      // Formatear datos para impresión
      const printableData = barcodes.map(barcode => {
        const entity = barcode.type === 'GUIDE' ? barcode.Guide : barcode.Employee;
        const organization = barcode.type === 'GUIDE' ? entity?.Agency : entity?.Branch;

        return {
          code: barcode.code,
          type: barcode.type,
          entityName: entity?.name || 'N/A',
          organizationName: organization?.name || 'N/A',
          organizationCode: organization?.code || 'N/A'
        };
      });

      res.json({
        success: true,
        data: printableData
      });

    } catch (error) {
      console.error('Error al obtener códigos para impresión:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}