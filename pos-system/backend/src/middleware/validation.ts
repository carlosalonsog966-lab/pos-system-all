import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Extender el tipo Request para incluir propiedades personalizadas
declare global {
  namespace Express {
    interface Request {
      resource?: any;
      models?: any;
    }
  }
}

// Validaciones para productos usando Zod
export const productValidation = [
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const productSchema = z.object({
        name: z.string()
          .min(3, 'El nombre debe tener entre 3 y 255 caracteres')
          .max(255, 'El nombre debe tener entre 3 y 255 caracteres')
          .regex(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-]+$/, 'El nombre contiene caracteres inválidos'),
        
        barcode: z.string()
          .min(5, 'El código de barras debe tener entre 5 y 50 caracteres')
          .max(50, 'El código de barras debe tener entre 5 y 50 caracteres')
          .regex(/^[A-Z0-9\-]+$/, 'El código de barras debe ser alfanumérico')
          .optional(),
        
        category: z.enum(['Anillos', 'Cadenas', 'Aretes', 'Pulseras', 'Colgantes', 'Otros']),
        
        cost: z.number()
          .min(0.01, 'El costo debe ser un número positivo')
          .max(999999.99, 'El costo debe ser un número positivo'),
        
        salePrice: z.number()
          .min(0.01, 'El precio de venta debe ser un número positivo')
          .max(999999.99, 'El precio de venta debe ser un número positivo'),
        
        stock: z.number()
          .int('El stock debe ser un número entero')
          .min(0, 'El stock debe ser un número entero no negativo')
          .max(999999, 'El stock debe ser un número entero no negativo'),
        
        minStock: z.number()
          .int('El stock mínimo debe ser un número entero')
          .min(0, 'El stock mínimo debe ser un número entero no negativo')
          .max(999999, 'El stock mínimo debe ser un número entero no negativo')
      }).refine((data) => data.salePrice > data.cost, {
        message: 'El precio de venta debe ser mayor al costo',
        path: ['salePrice']
      });

      productSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación de producto',
        errors: error.errors || [{ message: error.message }]
      });
    }
  }
];

// Validaciones para ventas usando Zod
export const saleValidation = [
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleSchema = z.object({
        items: z.array(
          z.object({
            productId: z.number().int().min(1, 'ID de producto inválido'),
            quantity: z.number().int().min(1, 'La cantidad debe ser entre 1 y 999').max(999, 'La cantidad debe ser entre 1 y 999'),
            price: z.number().min(0.01, 'El precio debe ser positivo')
          })
        ).min(1, 'La venta debe tener al menos un item'),
        
        total: z.number()
          .min(0.01, 'El total debe ser positivo')
      }).refine((data) => {
        const calculatedTotal = data.items.reduce((sum: number, item: any) => 
          sum + (item.quantity * item.price), 0);
        return Math.abs(data.total - calculatedTotal) <= 0.01;
      }, {
        message: 'El total no coincide con la suma de items',
        path: ['total']
      });

      saleSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación de venta',
        errors: error.errors || [{ message: error.message }]
      });
    }
  }
];

// Validaciones para clientes usando Zod
export const clientValidation = [
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientSchema = z.object({
        name: z.string()
          .min(2, 'El nombre debe tener entre 2 y 100 caracteres')
          .max(100, 'El nombre debe tener entre 2 y 100 caracteres'),
        
        email: z.string()
          .email('Email inválido')
          .optional()
          .transform(val => val?.toLowerCase().trim()),
        
        phone: z.string()
          .regex(/^\+?[\d\s\-\(\)]+$/, 'Teléfono inválido')
          .optional(),
        
        dni: z.string()
          .min(7, 'DNI inválido')
          .max(15, 'DNI inválido')
          .regex(/^[A-Z0-9]+$/, 'DNI debe ser alfanumérico')
          .optional()
      });

      clientSchema.parse(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación de cliente',
        errors: error.errors || [{ message: error.message }]
      });
    }
  }
];

// Validador de resultados (placeholder para compatibilidad)
export const validateResults = (req: Request, res: Response, next: NextFunction) => {
  // Ya no es necesario ya que las validaciones Zod manejan los errores directamente
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
      
      req.resource = resource;
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
    const stockErrors = [];
    
    for (const item of items) {
      const product = await req.models.Product.findByPk(item.productId);
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

// Validador de body para esquemas Zod
export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: error.errors || [{ message: error.message }]
      });
    }
  };
};

// Validador de query para esquemas Zod
export const validateQuery = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      // Evitar reasignar req.query (propiedad getter-only en algunos entornos).
      // Copiar claves validadas dentro del objeto existente.
      if (validated && typeof validated === 'object') {
        for (const k of Object.keys(validated)) {
          (req.query as any)[k] = (validated as any)[k];
        }
      }
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación de query',
        errors: error.errors || [{ message: error.message }]
      });
    }
  };
};

// Validador de parámetros para esquemas Zod
export const validateParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación de parámetros',
        errors: error.errors || [{ message: error.message }]
      });
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
  
  next();
};
