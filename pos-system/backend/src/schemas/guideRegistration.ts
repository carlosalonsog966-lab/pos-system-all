import { z } from 'zod';

export const createGuideRegistrationSchema = z.object({
  guideId: z.string().uuid('ID de guía inválido'),
  employeeId: z.string().uuid('ID de empleado inválido').optional(),
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
  registrationDate: z.string().transform(str => new Date(str)).optional(),
  peopleCount: z.number()
    .int('La cantidad de personas debe ser un número entero')
    .min(1, 'La cantidad de personas debe ser al menos 1')
    .max(1000, 'La cantidad de personas no puede exceder 1000'),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
});

export const updateGuideRegistrationSchema = z.object({
  guideId: z.string().uuid('ID de guía inválido').optional(),
  employeeId: z.string().uuid('ID de empleado inválido').optional(),
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
  registrationDate: z.string().transform(str => new Date(str)).optional(),
  peopleCount: z.number()
    .int('La cantidad de personas debe ser un número entero')
    .min(1, 'La cantidad de personas debe ser al menos 1')
    .max(1000, 'La cantidad de personas no puede exceder 1000')
    .optional(),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
  isActive: z.boolean().optional(),
});

export const guideRegistrationQuerySchema = z.object({
  page: z.string().transform(str => parseInt(str)).optional(),
  limit: z.string().transform(str => parseInt(str)).optional(),
  guideId: z.string().uuid('ID de guía inválido').optional(),
  employeeId: z.string().uuid('ID de empleado inválido').optional(),
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  isActive: z.string().transform(str => str === 'true').optional(),
});

export const guideStatsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
});