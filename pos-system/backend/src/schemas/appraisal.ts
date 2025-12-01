import { z } from 'zod'

export const createAppraisalSchema = z.object({
  productAssetId: z.string().uuid(),
  appraiser: z.string().min(2).max(120),
  appraisalDate: z.coerce.date(),
  value: z.coerce.number().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/i, 'La moneda debe ser un código ISO de 3 letras'),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const updateAppraisalSchema = z.object({
  appraiser: z.string().min(2).max(120).optional(),
  appraisalDate: z.coerce.date().optional(),
  value: z.coerce.number().min(0).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/i).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const appraisalQuerySchema = z.object({
  productAssetId: z.string().uuid().optional(),
  minDate: z.coerce.date().optional(),
  maxDate: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export type CreateAppraisalInput = z.infer<typeof createAppraisalSchema>
export type UpdateAppraisalInput = z.infer<typeof updateAppraisalSchema>
export type AppraisalQueryInput = z.infer<typeof appraisalQuerySchema>
