import { z } from 'zod';

// Tipos de documento soportados para metadatos
export const documentTypes = ['certificate', 'appraisal', 'warranty', 'photo'] as const;

const certificateMetadataSchema = z.object({
  documentType: z.literal('certificate'),
  certNumber: z.string().min(1, 'Número de certificado requerido'),
  issuer: z.string().min(1, 'Emisor requerido'),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
}).strict();

const appraisalMetadataSchema = z.object({
  documentType: z.literal('appraisal'),
  appraiser: z.string().min(1, 'Tasador requerido'),
  value: z.number().positive('Valor de tasación debe ser positivo'),
  currency: z.string().regex(/^[A-Z]{3}$/i, 'Moneda debe ser ISO de 3 letras').optional(),
  appraisalDate: z.string().datetime().optional(),
}).strict();

const warrantyMetadataSchema = z.object({
  documentType: z.literal('warranty'),
  provider: z.string().min(1, 'Proveedor requerido'),
  warrantyMonths: z.number().int().min(0, 'Garantía debe ser >= 0'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).strict();

const photoMetadataSchema = z.object({
  documentType: z.literal('photo'),
  caption: z.string().max(200).optional(),
  takenAt: z.string().datetime().optional(),
  tags: z.array(z.string()).max(20).optional(),
}).strict();

export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'filename es requerido'),
  mimeType: z.string().min(1, 'mimeType es requerido'),
  dataBase64: z.string().min(1, 'dataBase64 es requerido'),
  entityType: z.enum(['product', 'sale', 'client', 'productAsset']).optional(),
  entityId: z.string().uuid('entityId debe ser UUID válido').optional(),
  metadata: z
    .union([certificateMetadataSchema, appraisalMetadataSchema, warrantyMetadataSchema, photoMetadataSchema])
    .optional(),
}).refine(
  (data) => {
    // Si hay entityId, debe haber entityType
    if (data.entityId && !data.entityType) return false;
    return true;
  },
  {
    message: 'entityType es requerido cuando se proporciona entityId',
    path: ['entityType'],
  }
);

export type FileUploadInput = z.infer<typeof fileUploadSchema>;


// ==== Validaciones adicionales para otras rutas de archivos ====

// Params con ID de archivo
export const fileIdParamsSchema = z.object({
  id: z.string().uuid('ID de archivo inv�lido'),
});

// Query para listado y verificaci�n de integridad
export const fileQuerySchema = z.object({
  entityType: z.enum(['product', 'sale', 'client', 'productAsset']).optional(),
  entityId: z.string().uuid('entityId debe ser UUID v�lido').optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
    .optional()
    .refine((v) => (v === undefined ? true : v > 0 && v <= 10000), {
      message: 'limit debe ser un n�mero entre 1 y 10000',
    }),
}).refine(
  (data) => {
    // Si hay entityId, debe haber entityType
    if (data.entityId && !data.entityType) return false;
    return true;
  },
  {
    message: 'entityType es requerido cuando se proporciona entityId',
    path: ['entityType'],
  }
);

export type FileQueryInput = z.infer<typeof fileQuerySchema>;
export type FileIdParamsInput = z.infer<typeof fileIdParamsSchema>;
