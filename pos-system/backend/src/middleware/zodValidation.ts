import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue, z } from 'zod';

export interface ValidationConfig {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path: string[];
  received: any;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  data?: {
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
  };
}

/**
 * Middleware de validación Zod centralizado
 */
export function validateRequest(config: ValidationConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = await validateRequestData(req, config);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: validationResult.errors,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        });
      }

      // Agregar datos validados al request
      if (validationResult.data) {
        if (validationResult.data.body) {
          req.body = validationResult.data.body;
        }
        if (validationResult.data.query) {
          req.query = validationResult.data.query;
        }
        if (validationResult.data.params) {
          req.params = validationResult.data.params;
        }
        if (validationResult.data.headers) {
          (req as any).validatedHeaders = validationResult.data.headers;
        }
      }

      next();
    } catch (error) {
      console.error('Error en validación Zod:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error interno en validación',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    }
  };
}

/**
 * Valida los datos de una request
 */
export async function validateRequestData(
  req: Request,
  config: ValidationConfig
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const validatedData: any = {};

  // Validar body
  if (config.body) {
    const bodyResult = await validateDataInternal(req.body, config.body, 'body');
    if (!bodyResult.success) {
      errors.push(...bodyResult.errors);
    } else {
      validatedData.body = bodyResult.data;
    }
  }

  // Validar query parameters
  if (config.query) {
    const queryResult = await validateDataInternal(req.query, config.query, 'query');
    if (!queryResult.success) {
      errors.push(...queryResult.errors);
    } else {
      validatedData.query = queryResult.data;
    }
  }

  // Validar path parameters
  if (config.params) {
    const paramsResult = await validateDataInternal(req.params, config.params, 'params');
    if (!paramsResult.success) {
      errors.push(...paramsResult.errors);
    } else {
      validatedData.params = paramsResult.data;
    }
  }

  // Validar headers
  if (config.headers) {
    const headersResult = await validateDataInternal(req.headers, config.headers, 'headers');
    if (!headersResult.success) {
      errors.push(...headersResult.errors);
    } else {
      validatedData.headers = headersResult.data;
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data: errors.length === 0 ? validatedData : undefined,
  };
}

/**
 * Valida datos contra un schema Zod
 */
async function validateDataInternal(
  data: any,
  schema: ZodSchema,
  source: string
): Promise<{ success: boolean; errors: ValidationError[]; data?: any }> {
  try {
    const validatedData = await schema.parseAsync(data);
    return {
      success: true,
      errors: [],
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = formatZodErrors(error.issues, source);
      return {
        success: false,
        errors: validationErrors,
      };
    }

    // Error no relacionado con Zod
    return {
      success: false,
      errors: [{
        field: source,
        message: 'Error de validación desconocido',
        code: 'unknown_error',
        path: [source],
        received: data,
      }],
    };
  }
}

/**
 * Formatea errores de Zod a un formato consistente
 */
function formatZodErrors(issues: ZodIssue[], source: string): ValidationError[] {
  return issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path : [source];
    const field = path.join('.');
    
    let message = issue.message;
    
    // Personalizar mensajes según el tipo de error
    switch (issue.code) {
      case 'invalid_type':
        message = `Se esperaba ${issue.expected}, pero se recibió ${(issue as any).received}`;
        break;
      case 'too_small':
        if ((issue as any).type === 'string') {
          message = `Debe tener al menos ${(issue as any).minimum} caracteres`;
        } else if ((issue as any).type === 'number') {
          message = `Debe ser mayor o igual a ${(issue as any).minimum}`;
        } else if ((issue as any).type === 'array') {
          message = `Debe tener al menos ${(issue as any).minimum} elementos`;
        }
        break;
      case 'too_big':
        if ((issue as any).type === 'string') {
          message = `Debe tener máximo ${(issue as any).maximum} caracteres`;
        } else if ((issue as any).type === 'number') {
          message = `Debe ser menor o igual a ${(issue as any).maximum}`;
        } else if ((issue as any).type === 'array') {
          message = `Debe tener máximo ${(issue as any).maximum} elementos`;
        }
        break;

      case 'custom':
        // Mantener mensaje personalizado
        break;
      default:
        // Usar mensaje por defecto de Zod
        break;
    }

    return {
      field,
      message,
      code: issue.code,
      path: path.map(String),
      received: (issue as any).received || null,
    };
  });
}

/**
 * Middleware para validar solo el body
 */
export function validateBody(schema: ZodSchema) {
  return validateRequest({ body: schema });
}

/**
 * Middleware para validar solo query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return validateRequest({ query: schema });
}

/**
 * Middleware para validar solo path parameters
 */
export function validateParams(schema: ZodSchema) {
  return validateRequest({ params: schema });
}

/**
 * Middleware para validar solo headers
 */
export function validateHeaders(schema: ZodSchema) {
  return validateRequest({ headers: schema });
}

/**
 * Función helper para crear schemas de parámetros comunes
 */
export const commonSchemas = {
  // ID de producto
  productId: {
    params: {
      id: z.string().uuid('ID de producto debe ser un UUID válido'),
    },
  },
  
  // ID de cliente
  clientId: {
    params: {
      id: z.string().uuid('ID de cliente debe ser un UUID válido'),
    },
  },
  
  // ID de venta
  saleId: {
    params: {
      id: z.string().uuid('ID de venta debe ser un UUID válido'),
    },
  },
  
  // Paginación
  pagination: {
    query: {
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    },
  },
  
  // Filtros de fecha
  dateRange: {
    query: {
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    },
  },
  
  // Headers de autenticación
  authHeaders: {
    headers: {
      authorization: z.string().regex(/^Bearer .+/, 'Token de autorización requerido'),
    },
  },
};

// Re-exportar z para conveniencia
export { z };

/**
 * Middleware de manejo de errores de validación global
 */
export function globalValidationErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof ZodError) {
    const validationErrors = formatZodErrors(error.issues, 'request');
    
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: validationErrors,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    });
  }

  // Si no es un error de Zod, pasar al siguiente middleware de error
  next(error);
}

/**
 * Función para validar datos fuera del contexto de Express
 */
export async function validateData<T>(
  data: unknown,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; errors: ValidationError[] }> {
  try {
    const validatedData = await schema.parseAsync(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = formatZodErrors(error.issues, 'data');
      return {
        success: false,
        errors: validationErrors,
      };
    }

    return {
      success: false,
      errors: [{
        field: 'data',
        message: 'Error de validación desconocido',
        code: 'unknown_error',
        path: ['data'],
        received: data,
      }],
    };
  }
}

/**
 * Decorator para validar métodos de clase
 */
export function ValidateInput(schema: ZodSchema) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [input] = args;
      
      try {
        const validatedInput = await schema.parseAsync(input);
        args[0] = validatedInput;
        return method.apply(this, args);
      } catch (error) {
        if (error instanceof ZodError) {
          const validationErrors = formatZodErrors(error.issues, 'input');
          throw new Error(`Errores de validación: ${validationErrors.map(e => e.message).join(', ')}`);
        }
        throw error;
      }
    };

    return descriptor;
  };
}