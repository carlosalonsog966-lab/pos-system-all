import { Request, Response } from 'express';
import { RankingService } from '../services/rankingService';
import { logger } from '../middleware/logger';

export class RankingController {
  static async getWeeklyRankings(req: Request, res: Response) {
    try {
      const rankings = await RankingService.getWeeklyRankings(req.query);
      res.json({
        success: true,
        data: rankings,
      });
    } catch (error: any) {
      // Instrumentación adicional para depurar errores directamente en consola
      console.error('[RankingController.getWeeklyRankings] Error:', error?.message);
      if ((error as any)?.sql) {
        console.error('[RankingController.getWeeklyRankings] SQL:', (error as any)?.sql);
      }
      logger.error('Error getting weekly rankings', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        query: req.query,
        route: '/rankings/weekly',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los rankings semanales',
        sql: (error as any)?.sql,
      });
    }
  }

  static async getMonthlyRankings(req: Request, res: Response) {
    try {
      const rankings = await RankingService.getMonthlyRankings(req.query);
      res.json({
        success: true,
        data: rankings,
      });
    } catch (error: any) {
      logger.error('Error getting monthly rankings', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        query: req.query,
        route: '/rankings/monthly',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los rankings mensuales',
      });
    }
  }

  static async getCustomRankings(req: Request, res: Response) {
    try {
      const rankings = await RankingService.getCustomRankings(req.query);
      res.json({
        success: true,
        data: rankings,
      });
    } catch (error: any) {
      logger.error('Error getting custom rankings', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        query: req.query,
        route: '/rankings/custom',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los rankings personalizados',
      });
    }
  }

  static async getGuidePerformance(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const performance = await RankingService.getGuidePerformance(id, req.query);
      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      logger.error('Error getting guide performance', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        params: req.params,
        query: req.query,
        route: '/rankings/guide/:id/performance',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el rendimiento del guía',
      });
    }
  }

  static async getEmployeePerformance(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const performance = await RankingService.getEmployeePerformance(id, req.query);
      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      logger.error('Error getting employee performance', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        params: req.params,
        query: req.query,
        route: '/rankings/employee/:id/performance',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el rendimiento del empleado',
      });
    }
  }

  static async getProductPerformance(req: Request, res: Response) {
    try {
      const performance = await RankingService.getProductPerformance(req.query);
      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      // Instrumentación adicional para depurar errores directamente en consola
      console.error('[RankingController.getProductPerformance] Error:', error?.message);
      if ((error as any)?.sql) {
        console.error('[RankingController.getProductPerformance] SQL:', (error as any)?.sql);
      }
      logger.error('Error getting product performance', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        query: req.query,
        route: '/rankings/products/performance',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener rendimiento de productos',
        sql: (error as any)?.sql,
      });
    }
  }

  static async getAgencyPerformance(req: Request, res: Response) {
    try {
      const performance = await RankingService.getAgencyPerformance(req.query);
      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      logger.error('Error getting agency performance', {
        message: error?.message,
        stack: error?.stack,
        sql: (error as any)?.sql,
        query: req.query,
        route: '/rankings/agencies/performance',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el rendimiento de agencias',
      });
    }
  }
}
