import { z } from 'zod';

// Esquema para items del checkout
export const checkoutItemSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity: z.number().int().positive('La cantidad debe ser un número positivo'),
  unitPrice: z.number().positive('El precio unitario debe ser positivo'),
  discountAmount: z.number().min(0, 'El descuento no puede ser negativo').optional().default(0),
  notes: z.string().optional(),
});

// Esquema para información de pago
export const paymentInfoSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'mixed']),
  amount: z.number().positive('El monto debe ser positivo'),
  reference: z.string().optional(),
  cardType: z.enum(['credit', 'debit']).optional(),
  cardLast4: z.string().length(4, 'Los últimos 4 dígitos deben tener exactamente 4 caracteres').optional(),
  authCode: z.string().optional(),
});

// Esquema para pagos múltiples (mixed)
export const multiplePaymentsSchema = z.array(paymentInfoSchema).min(1, 'Debe haber al menos un método de pago');

// Esquema principal del checkout
export const checkoutSchema = z.object({
  // Información básica
  clientId: z.string().uuid('ID de cliente inválido').optional(),
  items: z.array(checkoutItemSchema).min(1, 'Debe haber al menos un item'),
  
  // Información de descuentos y impuestos
  discountAmount: z.number().min(0, 'El descuento no puede ser negativo').default(0),
  discountPercentage: z.number().min(0).max(100, 'El porcentaje de descuento debe estar entre 0 y 100').optional(),
  taxRate: z.number().min(0).max(1, 'La tasa de impuesto debe estar entre 0 y 1').default(0.19),
  
  // Información de pago
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mixed']),
  payments: z.union([paymentInfoSchema, multiplePaymentsSchema]).optional(),
  
  // Información adicional
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  
  // Configuraciones especiales
  applyLoyaltyDiscount: z.boolean().default(false),
  generateInvoice: z.boolean().default(false),
  sendEmailReceipt: z.boolean().default(false),
  
  // Metadatos para idempotencia
  idempotencyKey: z.string().min(1, 'La clave de idempotencia es requerida'),
  sessionId: z.string().optional(),
}).refine((data) => {
  // Validación: si el método es 'mixed', debe tener múltiples pagos
  if (data.paymentMethod === 'mixed') {
    return Array.isArray(data.payments) && data.payments.length > 1;
  }
  return true;
}, {
  message: 'Para pagos mixtos debe proporcionar múltiples métodos de pago',
  path: ['payments']
}).refine((data) => {
  // Validación: no puede tener descuento por monto Y porcentaje al mismo tiempo
  return !(data.discountAmount > 0 && data.discountPercentage && data.discountPercentage > 0);
}, {
  message: 'No puede aplicar descuento por monto y porcentaje simultáneamente',
  path: ['discountAmount', 'discountPercentage']
});

// Esquema para validar stock antes del checkout
export const stockValidationSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })),
});

// Esquema para respuesta del checkout
export const checkoutResponseSchema = z.object({
  saleId: z.string().uuid(),
  saleNumber: z.string(),
  subtotal: z.number(),
  taxAmount: z.number(),
  discountAmount: z.number(),
  total: z.number(),
  paymentMethod: z.string(),
  status: z.enum(['completed', 'pending', 'failed']),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  client: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
  }).optional(),
  createdAt: z.date(),
  qrCode: z.string().optional(),
  ticketUrl: z.string().optional(),
});

// Tipos TypeScript
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type PaymentInfo = z.infer<typeof paymentInfoSchema>;
export type StockValidationInput = z.infer<typeof stockValidationSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

// Validaciones de negocio específicas
export const validateCheckoutBusinessRules = (data: CheckoutInput) => {
  const errors: string[] = [];
  
  // Validar que el total de pagos coincida con el total de la venta (para pagos mixtos)
  if (data.paymentMethod === 'mixed' && Array.isArray(data.payments)) {
    const totalPayments = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice - (item.discountAmount || 0)), 0);
    const discount = data.discountPercentage ? subtotal * (data.discountPercentage / 100) : data.discountAmount;
    const total = subtotal + (subtotal * data.taxRate) - discount;
    
    if (Math.abs(totalPayments - total) > 0.01) { // Tolerancia de 1 centavo
      errors.push(`El total de pagos (${totalPayments}) no coincide con el total de la venta (${total.toFixed(2)})`);
    }
  }
  
  // Validar cantidades mínimas
  for (const item of data.items) {
    if (item.quantity > 1000) {
      errors.push(`La cantidad para el producto ${item.productId} excede el límite máximo (1000)`);
    }
  }
  
  // Validar descuentos razonables
  if (data.discountPercentage && data.discountPercentage > 50) {
    errors.push('El descuento por porcentaje no puede exceder el 50%');
  }
  
  const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  if (data.discountAmount > subtotal) {
    errors.push('El descuento por monto no puede exceder el subtotal');
  }
  
  return errors;
};

// Función para generar clave de idempotencia
export const generateIdempotencyKey = (userId: string, timestamp?: number): string => {
  const ts = timestamp || Date.now();
  return `checkout_${userId}_${ts}_${Math.random().toString(36).substr(2, 9)}`;
};