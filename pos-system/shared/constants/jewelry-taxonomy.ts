// Taxonomía definitiva para sistema POS de joyería
// Este archivo define todas las constantes y tipos para la clasificación de productos de joyería

// ===== CATEGORÍAS PRINCIPALES =====
export const JEWELRY_CATEGORIES = [
  'Anillos',
  'Alianzas',
  'Cadenas',
  'Collares',
  'Pulseras',
  'Aretes',
  'Pendientes',
  'Broches',
  'Relojes',
  'Gemelos',
  'Dijes',
  'Charms',
  'Otros'
] as const;

// ===== MATERIALES BASE =====
export const JEWELRY_MATERIALS = [
  'Oro',
  'Plata',
  'Platino',
  'Paladio',
  'Acero',
  'Titanio',
  'Diamante',
  'Esmeralda',
  'Rubí',
  'Zafiro',
  'Perla',
  'Otros'
] as const;

// ===== METALES ESPECÍFICOS =====
export const JEWELRY_METALS = [
  'Oro Amarillo',
  'Oro Blanco',
  'Oro Rosa',
  'Plata 925',
  'Plata 950',
  'Plata 999',
  'Platino',
  'Paladio',
  'Acero Inoxidable',
  'Titanio',
  'Cobre',
  'Bronce',
  'Aleación'
] as const;

// ===== PUREZAS DE METALES =====
export const METAL_PURITIES = [
  '10k',
  '14k',
  '18k',
  '22k',
  '24k',
  '925',
  '950',
  '999',
  'PT950',
  'PT999'
] as const;

// ===== TIPOS DE PIEDRAS =====
export const STONE_TYPES = [
  'Diamante',
  'Esmeralda',
  'Rubí',
  'Zafiro',
  'Perla',
  'Amatista',
  'Topacio',
  'Granate',
  'Turquesa',
  'Ópalo',
  'Jade',
  'Coral',
  'Ámbar',
  'Cuarzo',
  'Circonita',
  'Aguamarina',
  'Tanzanita',
  'Peridoto',
  'Sin Piedra'
] as const;

// ===== COLORES DE PIEDRAS =====
export const STONE_COLORS = [
  'Incoloro',
  'Blanco',
  'Amarillo',
  'Rosa',
  'Azul',
  'Verde',
  'Rojo',
  'Violeta',
  'Negro',
  'Marrón',
  'Naranja',
  'Gris',
  'Multicolor'
] as const;

// ===== CORTES DE PIEDRAS =====
export const STONE_CUTS = [
  'Brillante',
  'Princesa',
  'Esmeralda',
  'Oval',
  'Marquesa',
  'Pera',
  'Corazón',
  'Radiante',
  'Cojín',
  'Asscher',
  'Baguette',
  'Cabujón',
  'Redondo',
  'Cuadrado',
  'Sin Corte'
] as const;

// ===== ACABADOS =====
export const JEWELRY_FINISHES = [
  'Pulido',
  'Mate',
  'Satinado',
  'Texturizado',
  'Martillado',
  'Grabado',
  'Diamantado',
  'Florentino',
  'Cepillado',
  'Combinado'
] as const;

// ===== BAÑOS Y RECUBRIMIENTOS =====
export const JEWELRY_PLATINGS = [
  'Sin Baño',
  'Rodio',
  'Oro Amarillo',
  'Oro Rosa',
  'Oro Blanco',
  'Platino',
  'Paladio',
  'Rutenio',
  'Negro'
] as const;

// ===== GÉNEROS =====
export const JEWELRY_GENDERS = [
  'hombre',
  'mujer',
  'unisex',
  'niño',
  'niña'
] as const;

// ===== COLECCIONES =====
export const JEWELRY_COLLECTIONS = [
  'Clásica',
  'Moderna',
  'Vintage',
  'Elegance',
  'Luxury',
  'Casual',
  'Formal',
  'Nupcial',
  'Juvenil',
  'Ejecutiva'
] as const;

// ===== TALLAS DE ANILLOS =====
export const RING_SIZES = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', 
  '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'
] as const;

// ===== LONGITUDES DE CADENAS (cm) =====
export const CHAIN_LENGTHS = [
  '35', '40', '42', '45', '50', '55', '60', '65', '70', '75', '80'
] as const;

// ===== RANGOS DE QUILATES =====
export const CARAT_RANGES = [
  '0.01-0.25',
  '0.26-0.50',
  '0.51-0.75',
  '0.76-1.00',
  '1.01-1.50',
  '1.51-2.00',
  '2.01-3.00',
  '3.01+'
] as const;

// ===== FILTROS DE STOCK =====
export const STOCK_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'available', label: 'Disponible' },
  { id: 'low', label: 'Stock Bajo' },
  { id: 'out', label: 'Agotado' }
] as const;

// ===== FILTROS DE ESTADO =====
export const ACTIVE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' }
] as const;

// ===== TIPOS TYPESCRIPT =====
export type JewelryCategory = typeof JEWELRY_CATEGORIES[number];
export type JewelryMaterial = typeof JEWELRY_MATERIALS[number];
export type JewelryMetal = typeof JEWELRY_METALS[number];
export type MetalPurity = typeof METAL_PURITIES[number];
export type StoneType = typeof STONE_TYPES[number];
export type StoneColor = typeof STONE_COLORS[number];
export type StoneCut = typeof STONE_CUTS[number];
export type JewelryFinish = typeof JEWELRY_FINISHES[number];
export type JewelryPlating = typeof JEWELRY_PLATINGS[number];
export type JewelryGender = typeof JEWELRY_GENDERS[number];
export type JewelryCollection = typeof JEWELRY_COLLECTIONS[number];
export type RingSize = typeof RING_SIZES[number];
export type ChainLength = typeof CHAIN_LENGTHS[number];
export type CaratRange = typeof CARAT_RANGES[number];

// ===== FUNCIONES DE UTILIDAD =====
export const getJewelryDisplayName = (category: string): string => {
  const displayNames: Record<string, string> = {
    'Anillos': 'Anillos',
    'Alianzas': 'Alianzas',
    'Cadenas': 'Cadenas',
    'Collares': 'Collares',
    'Pulseras': 'Pulseras',
    'Aretes': 'Aretes',
    'Pendientes': 'Pendientes',
    'Broches': 'Broches',
    'Relojes': 'Relojes',
    'Gemelos': 'Gemelos',
    'Dijes': 'Dijes',
    'Charms': 'Charms',
    'Otros': 'Otros'
  };
  return displayNames[category] || category;
};

export const getMaterialDisplayName = (material: string): string => {
  const displayNames: Record<string, string> = {
    'Oro': 'Oro',
    'Plata': 'Plata',
    'Platino': 'Platino',
    'Paladio': 'Paladio',
    'Acero': 'Acero',
    'Titanio': 'Titanio',
    'Diamante': 'Diamante',
    'Esmeralda': 'Esmeralda',
    'Rubí': 'Rubí',
    'Zafiro': 'Zafiro',
    'Perla': 'Perla',
    'Otros': 'Otros'
  };
  return displayNames[material] || material;
};

export const getMetalPurityLabel = (purity: string): string => {
  const labels: Record<string, string> = {
    '10k': '10 Kilates',
    '14k': '14 Kilates',
    '18k': '18 Kilates',
    '22k': '22 Kilates',
    '24k': '24 Kilates',
    '925': 'Plata 925',
    '950': 'Plata 950',
    '999': 'Plata 999',
    'PT950': 'Platino 950',
    'PT999': 'Platino 999'
  };
  return labels[purity] || purity;
};

export const getCaratRangeLabel = (range: string): string => {
  const labels: Record<string, string> = {
    '0.01-0.25': 'Hasta 0.25ct',
    '0.26-0.50': '0.26 - 0.50ct',
    '0.51-0.75': '0.51 - 0.75ct',
    '0.76-1.00': '0.76 - 1.00ct',
    '1.01-1.50': '1.01 - 1.50ct',
    '1.51-2.00': '1.51 - 2.00ct',
    '2.01-3.00': '2.01 - 3.00ct',
    '3.01+': 'Más de 3.00ct'
  };
  return labels[range] || range;
};

// ===== VALIDACIONES =====
export const isValidCategory = (category: string): category is JewelryCategory => {
  return JEWELRY_CATEGORIES.includes(category as JewelryCategory);
};

export const isValidMaterial = (material: string): material is JewelryMaterial => {
  return JEWELRY_MATERIALS.includes(material as JewelryMaterial);
};

export const isValidMetal = (metal: string): metal is JewelryMetal => {
  return JEWELRY_METALS.includes(metal as JewelryMetal);
};

export const isValidStoneType = (stone: string): stone is StoneType => {
  return STONE_TYPES.includes(stone as StoneType);
};

export const isValidGender = (gender: string): gender is JewelryGender => {
  return JEWELRY_GENDERS.includes(gender as JewelryGender);
};

// ===== CONFIGURACIÓN DE CATEGORÍAS =====
export const CATEGORY_CONFIG = {
  'Anillos': {
    requiredFields: ['ringSize'],
    optionalFields: ['stoneType', 'stoneCarat', 'stoneColor', 'stoneCut'],
    defaultWarranty: 12
  },
  'Alianzas': {
    requiredFields: ['ringSize'],
    optionalFields: ['finish', 'plating'],
    defaultWarranty: 24
  },
  'Cadenas': {
    requiredFields: ['chainLengthCm'],
    optionalFields: ['finish', 'plating'],
    defaultWarranty: 12
  },
  'Collares': {
    requiredFields: ['chainLengthCm'],
    optionalFields: ['stoneType', 'stoneCarat', 'finish'],
    defaultWarranty: 12
  },
  'Pulseras': {
    requiredFields: [],
    optionalFields: ['chainLengthCm', 'stoneType', 'finish'],
    defaultWarranty: 12
  },
  'Aretes': {
    requiredFields: [],
    optionalFields: ['stoneType', 'stoneCarat', 'stoneColor', 'stoneCut'],
    defaultWarranty: 12
  },
  'Pendientes': {
    requiredFields: [],
    optionalFields: ['stoneType', 'stoneCarat', 'stoneColor', 'stoneCut'],
    defaultWarranty: 12
  },
  'Broches': {
    requiredFields: [],
    optionalFields: ['stoneType', 'finish'],
    defaultWarranty: 12
  },
  'Relojes': {
    requiredFields: [],
    optionalFields: ['finish', 'collection'],
    defaultWarranty: 24
  },
  'Gemelos': {
    requiredFields: [],
    optionalFields: ['stoneType', 'finish'],
    defaultWarranty: 12
  },
  'Dijes': {
    requiredFields: [],
    optionalFields: ['stoneType', 'finish'],
    defaultWarranty: 12
  },
  'Charms': {
    requiredFields: [],
    optionalFields: ['finish'],
    defaultWarranty: 12
  },
  'Otros': {
    requiredFields: [],
    optionalFields: [],
    defaultWarranty: 12
  }
} as const;