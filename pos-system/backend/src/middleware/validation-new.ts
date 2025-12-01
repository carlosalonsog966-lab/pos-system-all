import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Validador de resultados usando Zod
export const validateResults = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: error.issues ? error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          })) : [{ message: error.message }]
        });
      }
      next(error);
    }
  };
};

// Sanitizador de entrada
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/[<>]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  req.params = sanitize(req.params);
  req.query = sanitize(req.query);
  
  next();
};

// Validador de existencia de recurso
export const validateResourceExists = (model: any, field: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.params[field] || req.body[field];
      const resource = await model.findByPk(value);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${model.name} no encontrado`
        });
      }
      
      (req as any).resource = resource;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validando recurso'
      });
    }
  };
};

// Validador de stock disponible
export const validateStockAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items inválidos'
      });
    }
    
    const stockErrors = [];
    
    for (const item of items) {
      // Obtener modelo de producto dinámicamente
      const models = require('../models');
      const Product = models.Product;
      
      const product = await Product.findByPk(item.productId);
      if (!product) {
        stockErrors.push(`Producto ${item.productId} no encontrado`);
        continue;
      }
      
      if (product.stock < item.quantity) {
        stockErrors.push(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`);
      }
    }
    
    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores de stock',
        errors: stockErrors
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validando stock'
    });
  }
};

// Validaciones adicionales para productos
export const productValidation = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors = [];
    const { name, barcode, category, cost, salePrice, stock, minStock } = req.body;
    
    // Validar nombre
    if (!name || name.length < 3 || name.length > 255) {
      errors.push('El nombre debe tener entre 3 y 255 caracteres');
    }
    if (name && !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]+$/.test(name)) {
      errors.push('El nombre contiene caracteres inválidos');
    }
    
    // Validar barcode
    if (barcode && (barcode.length < 5 || barcode.length > 50)) {
      errors.push('El código de barras debe tener entre 5 y 50 caracteres');
    }
    if (barcode && !/^[A-Z0-9\-]+$/.test(barcode)) {
      errors.push('El código de barras debe ser alfanumérico');
    }
    
    // Validar categoría
    const validCategories = ['Anillos', 'Cadenas', 'Aretes', 'Pulseras', 'Colgantes', 'Otros'];
    if (category && !validCategories.includes(category)) {
      errors.push('Categoría inválida');
    }
    
    // Validar precios
    if (cost !== undefined && (cost < 0.01 || cost > 999999.99)) {
      errors.push('El costo debe ser un número positivo entre 0.01 y 999999.99');
    }
    if (salePrice !== undefined && (salePrice < 0.01 || salePrice > 999999.99)) {
      errors.push('El precio de venta debe ser un número positivo entre 0.01 y 999999.99');
    }
    if (cost !== undefined && salePrice !== undefined && salePrice <= cost) {
      errors.push('El precio de venta debe ser mayor al costo');
    }
    
    // Validar stock
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0 || stock > 999999)) {
      errors.push('El stock debe ser un número entero no negativo');
    }
    if (minStock !== undefined && (!Number.isInteger(minStock) || minStock < 0 || minStock > 999999)) {
      errors.push('El stock mínimo debe ser un número entero no negativo');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors
      });
    }
    
    next();
  }
];

// Validaciones para ventas
export const saleValidation = [
  (req: Request, res: Response, next: NextFunction) => {
    const errors = [];
    const { items, total } = req.body;
    
    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('La venta debe tener al menos un item');
    }
    
    if (items && Array.isArray(items)) {
      items.forEach((item, index) => {
        if (!item.productId || !Number.isInteger(item.productId) || item.productId < 1) {
          errors.push(`Item ${index + 1}: ID de producto inválido`);
        }
        if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
          errors.push(`Item ${index + 1}: La cantidad debe ser entre 1 y 999`);
        }
        if (!item.price || item.price < 0.01) {
          errors.push(`Item ${index + 1}: El precio debe ser positivo`);
        }
      });
    }
    
    // Validar total
    if (total !== undefined && (total < 0.01)) {
      errors.push('El total debe ser positivo');
    }
    
    if (total !== undefined && items && Array.isArray(items)) {
      const calculatedTotal = items.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.price), 0);
      if (Math.abs(total - calculatedTotal) > 0.01) {
        errors.push('El total no coincide con la suma de items');
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors
      });
    }
    
    next();
  }
];