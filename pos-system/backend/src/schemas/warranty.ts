import { z } from 'zod'

export const warrantyStatuses = ['active','expired','void','service'] as const

export const createWarrantySchema = z.object({
  productAssetId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  months: z.coerce.number().int().min(0).default(12),
  status: z.enum(warrantyStatuses).default('active'),
  terms: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const updateWarrantySchema = z.object({
  saleId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  months: z.coerce.number().int().min(0).optional(),
  status: z.enum(warrantyStatuses).optional(),
  terms: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const warrantyQuerySchema = z.object({
  productAssetId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  status: z.enum(warrantyStatuses).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>
export type UpdateWarrantyInput = z.infer<typeof updateWarrantySchema>
export type WarrantyQueryInput = z.infer<typeof warrantyQuerySchema>
