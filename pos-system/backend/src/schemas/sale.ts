import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity: z.number().int().positive('La cantidad debe ser positiva'),
  unitPrice: z.number().positive('El precio unitario debe ser positivo'),
  discountAmount: z.number().min(0, 'El descuento no puede ser negativo').optional().default(0),
});

export const createSaleSchema = z.object({
  clientId: z.string().uuid('ID de cliente inválido').optional(),
  items: z.array(saleItemSchema).min(1, 'Debe incluir al menos un producto'),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mixed']),
  discountAmount: z.number().min(0, 'El descuento no puede ser negativo').optional().default(0),
  taxRate: z.number().min(0).max(1, 'La tasa de impuesto debe estar entre 0 y 1').optional().default(0.19),
  notes: z.string().optional(),
  // Referencias de pago
  cardReference: z.string().max(100, 'Referencia de tarjeta demasiado larga').optional(),
  transferReference: z.string().max(100, 'Referencia de transferencia demasiado larga').optional(),
  // Campos del sistema de turismo
  saleType: z.enum(['GUIDE', 'STREET']).optional().default('STREET'),
  agencyId: z.string().uuid('ID de agencia inválido').optional(),
  guideId: z.string().uuid('ID de guía inválido').optional(),
  employeeId: z.string().uuid('ID de empleado inválido').optional(),
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
});

export const updateSaleSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']),
  notes: z.string().optional(),
});

export const saleQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  clientId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mixed']).optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  minTotal: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxTotal: z.string().transform(Number).pipe(z.number().positive()).optional(),
  // Filtros del sistema de turismo
  saleType: z.enum(['GUIDE', 'STREET']).optional(),
  agencyId: z.string().uuid().optional(),
  guideId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type SaleQueryInput = z.infer<typeof saleQuerySchema>;
