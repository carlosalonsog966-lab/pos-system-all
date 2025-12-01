import { z } from 'zod';

// Crea un esquema Zod para respuestas estándar de la API
export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
    error: z.string().optional(),
  });
}

// Crea un esquema Zod para respuestas paginadas de la API
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.boolean(),
    data: z.object({
      items: z.array(itemSchema),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
      }),
    }),
    message: z.string().optional(),
    error: z.string().optional(),
  });
}
