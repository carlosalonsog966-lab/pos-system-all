import { z } from 'zod';

// Esquema de producto crudo tal como viene del backend
export const productRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),

  purchasePrice: z.coerce.number().optional(),
  salePrice: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),
  minStock: z.coerce.number().optional(),
  reservedStock: z.coerce.number().optional(),

  category: z
    .union([
      z.string(),
      z
        .object({ id: z.string().optional(), name: z.string().optional() })
        .passthrough(),
    ])
    .optional(),
  supplier: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  metal: z.string().optional().nullable(),
  metalPurity: z.string().optional().nullable(),
  grams: z.coerce.number().optional().nullable(),
  ringSize: z.string().optional().nullable(),
  chainLengthCm: z.coerce.number().optional().nullable(),
  stoneType: z.string().optional().nullable(),
  stoneColor: z.string().optional().nullable(),
  stoneCut: z.string().optional().nullable(),
  stoneClarity: z.string().optional().nullable(),
  stoneCarat: z.coerce.number().optional().nullable(),
  warrantyMonths: z.coerce.number().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  primaryImage: z.string().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  keywords: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export type ProductRaw = z.infer<typeof productRawSchema>;
