import { Request, Response } from 'express';
import { GuideRegistrationService } from '../services/guideRegistrationService';
import { z } from 'zod';

export class GuideRegistrationController {
  static async createRegistration(req: Request, res: Response) {
    try {
      const registration = await GuideRegistrationService.createRegistration(req.body);
      res.status(201).json({
        success: true,
        data: registration,
        message: 'Registro de guía creado exitosamente',
      });
    } catch (error: any) {
      console.error('Error creating guide registration:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al crear el registro de guía',
      });
    }
  }

  static async getRegistrations(req: Request, res: Response) {
    try {
      const registrations = await GuideRegistrationService.getRegistrations(req.query);
      res.json({
        success: true,
        data: registrations,
      });
    } catch (error: any) {
      console.error('Error getting guide registrations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los registros de guías',
      });
    }
  }

  static async getRegistrationById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const registration = await GuideRegistrationService.getRegistrationById(id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registro de guía no encontrado',
        });
      }

      res.json({
        success: true,
        data: registration,
      });
    } catch (error: any) {
      console.error('Error getting guide registration:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el registro de guía',
      });
    }
  }

  static async updateRegistration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const registration = await GuideRegistrationService.updateRegistration(id, req.body);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registro de guía no encontrado',
        });
      }

      res.json({
        success: true,
        data: registration,
        message: 'Registro de guía actualizado exitosamente',
      });
    } catch (error: any) {
      console.error('Error updating guide registration:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al actualizar el registro de guía',
      });
    }
  }

  static async deleteRegistration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await GuideRegistrationService.deleteRegistration(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Registro de guía no encontrado',
        });
      }

      res.json({
        success: true,
        message: 'Registro de guía eliminado exitosamente',
      });
    } catch (error: any) {
      console.error('Error deleting guide registration:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar el registro de guía',
      });
    }
  }

  static async getGuideStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const stats = await GuideRegistrationService.getGuideStats(id, req.query);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting guide stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener las estadísticas del guía',
      });
    }
  }

  static async getClosurePercentage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const closureData = await GuideRegistrationService.getClosurePercentage(id, req.query);
      
      res.json({
        success: true,
        data: closureData,
      });
    } catch (error: any) {
      console.error('Error getting closure percentage:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el porcentaje de cierre',
      });
    }
  }
}