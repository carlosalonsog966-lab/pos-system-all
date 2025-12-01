import { z } from 'zod';

export const createClientSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Debe ser un email válido').optional(),
  // Teléfono debe ser opcional en el backend para alinear con el modelo
  phone: z.string().min(1, 'El teléfono es requerido').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  birthDate: z.string().transform(str => new Date(str)).optional(),
  documentType: z.enum(['CC', 'CE', 'TI', 'PP', 'NIT']).optional(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// Helpers para aceptar múltiples tipos en queries (string/boolean/number)
const numberish = z.union([z.string(), z.number()]).transform((val) => {
  if (typeof val === 'number') return val;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
});

const booleanish = z
  .union([z.string(), z.boolean()])
  .transform((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' : !!val));

export const clientQuerySchema = z.object({
  page: numberish.pipe(z.number().int().positive()).optional(),
  limit: numberish.pipe(z.number().int().positive().max(100)).optional(),
  search: z.string().optional(),
  isActive: booleanish.optional(),
  vip: booleanish.optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientQueryInput = z.infer<typeof clientQuerySchema>;
