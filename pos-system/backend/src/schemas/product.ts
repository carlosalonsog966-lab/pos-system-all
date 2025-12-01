import { z } from 'zod';

// Importar constantes de la taxonomía unificada
const JEWELRY_CATEGORIES = ['Anillos', 'Alianzas', 'Cadenas', 'Collares', 'Pulseras', 'Aretes', 'Pendientes', 'Broches', 'Relojes', 'Gemelos', 'Dijes', 'Charms', 'Otros'] as const;
const JEWELRY_MATERIALS = ['Oro', 'Plata', 'Platino', 'Paladio', 'Acero', 'Titanio', 'Diamante', 'Esmeralda', 'Rubí', 'Zafiro', 'Perla', 'Otros'] as const;
const JEWELRY_METALS = ['Oro Amarillo', 'Oro Blanco', 'Oro Rosa', 'Plata 925', 'Plata 950', 'Plata 999', 'Platino', 'Paladio', 'Acero Inoxidable', 'Titanio', 'Cobre', 'Bronce', 'Aleación'] as const;
const METAL_PURITIES = ['10k', '14k', '18k', '22k', '24k', '925', '950', '999', 'PT950', 'PT999'] as const;
const STONE_TYPES = ['Diamante', 'Esmeralda', 'Rubí', 'Zafiro', 'Perla', 'Amatista', 'Topacio', 'Granate', 'Turquesa', 'Ópalo', 'Jade', 'Coral', 'Ámbar', 'Cuarzo', 'Circonita', 'Aguamarina', 'Tanzanita', 'Peridoto', 'Sin Piedra'] as const;
const STONE_COLORS = ['Incoloro', 'Blanco', 'Amarillo', 'Rosa', 'Azul', 'Verde', 'Rojo', 'Violeta', 'Negro', 'Marrón', 'Naranja', 'Gris', 'Multicolor'] as const;
const STONE_CUTS = ['Brillante', 'Princesa', 'Esmeralda', 'Oval', 'Marquesa', 'Pera', 'Corazón', 'Radiante', 'Cojín', 'Asscher', 'Baguette', 'Cabujón', 'Redondo', 'Cuadrado', 'Sin Corte'] as const;
const STONE_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3', 'Sin Claridad'] as const;
const JEWELRY_FINISHES = ['Pulido', 'Mate', 'Satinado', 'Texturizado', 'Martillado', 'Grabado', 'Diamantado', 'Florentino', 'Cepillado', 'Combinado'] as const;
const JEWELRY_PLATINGS = ['Sin Baño', 'Rodio', 'Oro Amarillo', 'Oro Rosa', 'Oro Blanco', 'Platino', 'Paladio', 'Rutenio', 'Negro'] as const;
const JEWELRY_GENDERS = ['hombre', 'mujer', 'unisex', 'niño', 'niña'] as const;
const JEWELRY_COLLECTIONS = ['Clásica', 'Moderna', 'Vintage', 'Elegance', 'Luxury', 'Casual', 'Formal', 'Nupcial', 'Juvenil', 'Ejecutiva'] as const;

export const createProductSchema = z.object({
  // Campos básicos
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  category: z.enum(JEWELRY_CATEGORIES),
  material: z.enum(JEWELRY_MATERIALS),
  weight: z.number().positive('El peso debe ser positivo').optional(),
  purity: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  purchasePrice: z.number().positive('El precio de compra debe ser positivo'),
  salePrice: z.number().positive('El precio de venta debe ser positivo'),
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
  minStock: z.number().int().min(0, 'El stock mínimo no puede ser negativo'),
  imageUrl: z.string().url().optional(),
  barcode: z.string().optional(),
  supplier: z.string().optional(),
  
  // Campos específicos de joyería
  brand: z.string().min(1).max(100).optional(),
  metal: z.enum(JEWELRY_METALS).optional(),
  metalPurity: z.enum(METAL_PURITIES).optional(),
  grams: z.number().positive('Los gramos deben ser positivos').optional(),
  ringSize: z.string().optional(),
  chainLengthCm: z.number().positive('La longitud debe ser positiva').optional(),
  stoneType: z.enum(STONE_TYPES).optional(),
  stoneColor: z.enum(STONE_COLORS).optional(),
  stoneCut: z.enum(STONE_CUTS).optional(),
  stoneClarity: z.enum(STONE_CLARITIES).optional(),
  stoneCarat: z.number().positive('Los quilates deben ser positivos').optional(),
  finish: z.enum(JEWELRY_FINISHES).optional(),
  plating: z.enum(JEWELRY_PLATINGS).optional(),
  hallmark: z.string().optional(),
  collection: z.enum(JEWELRY_COLLECTIONS).optional(),
  gender: z.enum(JEWELRY_GENDERS).optional(),
  isUniquePiece: z.boolean().default(false),
  warrantyMonths: z.number().int().min(0, 'La garantía no puede ser negativa').default(12),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    // Campos de auditoría para cambios de precio
    priceUpdateReason: z
      .string()
      .min(3, 'La razón del cambio de precio debe tener al menos 3 caracteres')
      .max(500, 'La razón del cambio de precio es demasiado larga')
      .optional(),
    priceUpdateCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/i, 'La moneda debe ser un código ISO de 3 letras')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const salePriceChanged = typeof data.salePrice === 'number';
    const purchasePriceChanged = typeof data.purchasePrice === 'number';

    if ((salePriceChanged || purchasePriceChanged) && !data.priceUpdateReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe proporcionar la razón del cambio de precio cuando se actualiza el precio de venta o compra',
        path: ['priceUpdateReason'],
      });
    }
  });

export const productQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  search: z.string().optional(),
  category: z.enum(JEWELRY_CATEGORIES).optional(),
  material: z.enum(JEWELRY_MATERIALS).optional(),
  metal: z.enum(JEWELRY_METALS).optional(),
  stoneType: z.enum(STONE_TYPES).optional(),
  collection: z.enum(JEWELRY_COLLECTIONS).optional(),
  gender: z.enum(JEWELRY_GENDERS).optional(),
  minPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  minWeight: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxWeight: z.string().transform(Number).pipe(z.number().positive()).optional(),
  minCarat: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxCarat: z.string().transform(Number).pipe(z.number().positive()).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  lowStock: z.string().transform(val => val === 'true').optional(),
  isUniquePiece: z.string().transform(val => val === 'true').optional(),
  sortBy: z.enum(['name', 'price', 'stock', 'createdAt', 'weight', 'carat']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;

// Esquema para importación masiva de productos vía JSON
export const bulkImportProductsSchema = z.object({
  items: z.array(createProductSchema).min(1, 'Debe enviar al menos 1 producto').max(1000, 'Máximo 1000 productos por importación'),
  upsert: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});
export type BulkImportProductsInput = z.infer<typeof bulkImportProductsSchema>;

// Validaciones específicas por categoría
export const validateProductByCategory = (product: CreateProductInput | UpdateProductInput) => {
  const errors: string[] = [];
  
  // Validaciones específicas para anillos y alianzas
  if (['Anillos', 'Alianzas'].includes(product.category as string)) {
    if (!product.ringSize) {
      errors.push('La talla del anillo es requerida para anillos y alianzas');
    }
  }
  
  // Validaciones para cadenas y collares
  if (['Cadenas', 'Collares'].includes(product.category as string)) {
    if (!product.chainLengthCm) {
      errors.push('La longitud es requerida para cadenas y collares');
    }
  }
  
  // Validaciones para productos con piedras
  if (product.stoneType && product.stoneType !== 'Sin Piedra') {
    if (!product.stoneCarat) {
      errors.push('Los quilates son requeridos cuando se especifica un tipo de piedra');
    }
    if (!product.stoneColor) {
      errors.push('El color de la piedra es requerido cuando se especifica un tipo de piedra');
    }
    if (product.stoneType === 'Diamante' && !product.stoneClarity) {
      errors.push('La claridad es requerida para diamantes');
    }
  }
  
  // Validaciones de coherencia de materiales
  if (product.material === 'Oro' && product.metal && !product.metal.includes('Oro')) {
    errors.push('El metal debe ser de oro cuando el material es oro');
  }
  
  if (product.material === 'Plata' && product.metal && !product.metal.includes('Plata')) {
    errors.push('El metal debe ser de plata cuando el material es plata');
  }
  
  return errors;
};

// Función para obtener la garantía por defecto según la categoría
export const getDefaultWarrantyByCategory = (category: string): number => {
  const warranties: Record<string, number> = {
    'Anillos': 12,
    'Alianzas': 24,
    'Cadenas': 12,
    'Collares': 12,
    'Pulseras': 12,
    'Aretes': 12,
    'Pendientes': 12,
    'Broches': 12,
    'Relojes': 24,
    'Gemelos': 12,
    'Dijes': 12,
    'Charms': 12,
    'Otros': 12
  };
  
  return warranties[category] || 12;
};
