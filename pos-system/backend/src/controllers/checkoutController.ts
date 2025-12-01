import { Request, Response } from 'express';
import { CheckoutService } from '../services/checkoutService';
import { InventoryService } from '../services/inventoryService';
import { AuthRequest } from '../middleware/auth';
import { 
  CheckoutInput, 
  StockValidationInput,
  checkoutSchema,
  stockValidationSchema 
} from '../schemas/checkout';
import { validateData } from '../middleware/zodValidation';

export class CheckoutController {
  /**
   * Procesa un checkout completo
   */
  static async processCheckout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      // Validar datos de entrada
      const validationResult = await validateData(req.body, checkoutSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const checkoutData = validationResult.data;

      // Procesar checkout
      const result = await CheckoutService.processCheckout(userId, checkoutData);

      return res.status(201).json({
        success: true,
        message: 'Checkout procesado exitosamente',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error en checkout:', error);

      // Manejar errores específicos
      if (error instanceof Error) {
        if (error.message.includes('Stock insuficiente')) {
          return res.status(409).json({
            success: false,
            message: 'Stock insuficiente',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }

        if (error.message.includes('Errores de validación')) {
          return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }

        if (error.message.includes('no encontrado')) {
          return res.status(404).json({
            success: false,
            message: 'Recurso no encontrado',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Valida disponibilidad de stock antes del checkout
   */
  static async validateStock(req: AuthRequest, res: Response) {
    try {
      // Validar datos de entrada
      const validationResult = await validateData(req.body, stockValidationSchema);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const stockData = validationResult.data;

      // Validar stock
      const result = await CheckoutService.validateStockAvailability(stockData);

      return res.status(200).json({
        success: true,
        message: 'Validación de stock completada',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error en validación de stock:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Reserva stock para una venta pendiente
   */
  static async reserveStock(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      const { items, reservationId, expirationMinutes = 30 } = req.body;

      // Validaciones básicas
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items requeridos',
          timestamp: new Date().toISOString(),
        });
      }

      if (!reservationId || typeof reservationId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'ID de reservación requerido',
          timestamp: new Date().toISOString(),
        });
      }

      // Reservar stock
      const result = await InventoryService.reserveStock(
        items,
        reservationId,
        userId,
        expirationMinutes
      );

      return res.status(201).json({
        success: true,
        message: 'Stock reservado exitosamente',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error en reserva de stock:', error);

      if (error instanceof Error && error.message.includes('Stock insuficiente')) {
        return res.status(409).json({
          success: false,
          message: 'Stock insuficiente para reserva',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene estadísticas de checkout
   */
  static async getCheckoutStats(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate && typeof startDate === 'string') {
        start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Fecha de inicio inválida',
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (endDate && typeof endDate === 'string') {
        end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Fecha de fin inválida',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Validar rango de fechas
      if (start && end && start > end) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de inicio debe ser anterior a la fecha de fin',
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await CheckoutService.getCheckoutStats(start, end);

      return res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Calcula el total de un checkout sin procesarlo
   */
  static async calculateTotal(req: Request, res: Response) {
    try {
      const { items, discountAmount = 0, discountPercentage = 0, taxRate = 0.19 } = req.body;

      // Validaciones básicas
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items requeridos',
          timestamp: new Date().toISOString(),
        });
      }

      if (discountAmount < 0 || discountPercentage < 0 || discountPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Descuentos inválidos',
          timestamp: new Date().toISOString(),
        });
      }

      if (taxRate < 0 || taxRate > 1) {
        return res.status(400).json({
          success: false,
          message: 'Tasa de impuesto inválida (debe estar entre 0 y 1)',
          timestamp: new Date().toISOString(),
        });
      }

      // Calcular subtotal
      let subtotal = 0;
      for (const item of items) {
        if (!item.quantity || !item.unitPrice || item.quantity <= 0 || item.unitPrice <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cantidad y precio unitario deben ser mayores a 0',
            timestamp: new Date().toISOString(),
          });
        }

        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscount = item.discountAmount || 0;
        subtotal += itemSubtotal - itemDiscount;
      }

      // Calcular descuento total
      let totalDiscountAmount = discountAmount;
      if (discountPercentage > 0) {
        totalDiscountAmount = subtotal * (discountPercentage / 100);
      }

      // Aplicar descuento al subtotal
      const discountedSubtotal = subtotal - totalDiscountAmount;
      
      // Calcular impuestos
      const taxAmount = discountedSubtotal * taxRate;
      
      // Total final
      const total = discountedSubtotal + taxAmount;

      return res.status(200).json({
        success: true,
        message: 'Total calculado exitosamente',
        data: {
          subtotal,
          discountAmount: totalDiscountAmount,
          taxAmount,
          total,
          breakdown: {
            itemsSubtotal: subtotal,
            discountApplied: totalDiscountAmount,
            taxableAmount: discountedSubtotal,
            taxRate,
            finalTotal: total,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error calculando total:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtiene el historial de checkouts de un usuario
   */
  static async getCheckoutHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString(),
        });
      }

      const { page = 1, limit = 20, startDate, endDate } = req.query;

      // Validar paginación
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: 'Número de página inválido',
          timestamp: new Date().toISOString(),
        });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          message: 'Límite inválido (debe estar entre 1 y 100)',
          timestamp: new Date().toISOString(),
        });
      }

      // Aquí se implementaría la lógica para obtener el historial
      // Por ahora retornamos una respuesta de ejemplo
      return res.status(200).json({
        success: true,
        message: 'Historial obtenido exitosamente',
        data: {
          checkouts: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error obteniendo historial:', error);

      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Error desconocido') : 'Error interno',
        timestamp: new Date().toISOString(),
      });
    }
  }
}