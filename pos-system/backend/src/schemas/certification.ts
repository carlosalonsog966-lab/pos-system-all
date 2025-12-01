import { z } from 'zod'

export const certificationTypes = ['GIA','IGI','HRD','Other'] as const

export const createCertificationSchema = z.object({
  productAssetId: z.string().uuid(),
  type: z.enum(certificationTypes),
  authority: z.string().min(2).max(100),
  certificateNumber: z.string().min(3).max(100),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const updateCertificationSchema = z.object({
  type: z.enum(certificationTypes).optional(),
  authority: z.string().min(2).max(100).optional(),
  certificateNumber: z.string().min(3).max(100).optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const certificationQuerySchema = z.object({
  productAssetId: z.string().uuid().optional(),
  type: z.enum(certificationTypes).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export type CreateCertificationInput = z.infer<typeof createCertificationSchema>
export type UpdateCertificationInput = z.infer<typeof updateCertificationSchema>
export type CertificationQueryInput = z.infer<typeof certificationQuerySchema>
