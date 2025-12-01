import { z } from 'zod'

export const createProductAssetSchema = z.object({
  productId: z.string().uuid(),
  serial: z.string().min(1),
  status: z.enum(['available', 'reserved', 'sold', 'service']).optional(),
  hallmark: z.string().max(50).optional(),
  condition: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  qrPayload: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const updateProductAssetSchema = z.object({
  status: z.enum(['available', 'reserved', 'sold', 'service']).optional(),
  hallmark: z.string().max(50).optional(),
  condition: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  qrPayload: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const productAssetQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  status: z.enum(['available', 'reserved', 'sold', 'service']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export type CreateProductAssetInput = z.infer<typeof createProductAssetSchema>
export type UpdateProductAssetInput = z.infer<typeof updateProductAssetSchema>
export type ProductAssetQueryInput = z.infer<typeof productAssetQuerySchema>
