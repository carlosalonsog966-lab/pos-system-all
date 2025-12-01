// Constantes para filtros y taxonomía de joyería
// NOTA: Este archivo importa la taxonomía unificada desde shared/constants

// Re-exportar desde la taxonomía unificada
export {
  JEWELRY_CATEGORIES,
  JEWELRY_MATERIALS,
  JEWELRY_METALS,
  METAL_PURITIES,
  STONE_TYPES,
  STONE_COLORS,
  STONE_CUTS,
  JEWELRY_FINISHES,
  JEWELRY_PLATINGS,
  JEWELRY_GENDERS,
  JEWELRY_COLLECTIONS,
  RING_SIZES,
  CHAIN_LENGTHS,
  CARAT_RANGES,
  STOCK_FILTERS,
  ACTIVE_FILTERS,
  getJewelryDisplayName,
  getMaterialDisplayName,
  getMetalPurityLabel,
  getCaratRangeLabel,
  isValidCategory,
  isValidMaterial,
  isValidMetal,
  isValidStoneType,
  isValidGender,
  CATEGORY_CONFIG
} from '../../../shared/constants/jewelry-taxonomy';

// Tipos específicos del frontend
export type {
  JewelryCategory,
  JewelryMaterial,
  JewelryMetal,
  MetalPurity,
  StoneType,
  StoneColor,
  StoneCut,
  JewelryFinish,
  JewelryPlating,
  JewelryGender,
  JewelryCollection,
  RingSize,
  ChainLength,
  CaratRange
} from '../../../shared/constants/jewelry-taxonomy';

// Constantes específicas del frontend para filtros de UI
export const PRICE_RANGES = [
  { id: 'all', label: 'Todos los precios', min: 0, max: Infinity },
  { id: 'under-5k', label: 'Menos de $5,000', min: 0, max: 5000 },
  { id: '5k-15k', label: '$5,000 - $15,000', min: 5000, max: 15000 },
  { id: '15k-30k', label: '$15,000 - $30,000', min: 15000, max: 30000 },
  { id: '30k-50k', label: '$30,000 - $50,000', min: 30000, max: 50000 },
  { id: 'over-50k', label: 'Más de $50,000', min: 50000, max: Infinity }
] as const;

export const WEIGHT_RANGES = [
  { id: 'all', label: 'Todos los pesos', min: 0, max: Infinity },
  { id: 'light', label: 'Ligero (0-5g)', min: 0, max: 5 },
  { id: 'medium', label: 'Medio (5-15g)', min: 5, max: 15 },
  { id: 'heavy', label: 'Pesado (15-30g)', min: 15, max: 30 },
  { id: 'very-heavy', label: 'Muy pesado (30g+)', min: 30, max: Infinity }
] as const;

// Configuración de ordenamiento
export const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Nombre A-Z', field: 'name', direction: 'asc' },
  { id: 'name-desc', label: 'Nombre Z-A', field: 'name', direction: 'desc' },
  { id: 'price-asc', label: 'Costo menor a mayor', field: 'costPrice', direction: 'asc' },
  { id: 'price-desc', label: 'Costo mayor a menor', field: 'costPrice', direction: 'desc' },
  { id: 'stock-asc', label: 'Stock menor a mayor', field: 'stock', direction: 'asc' },
  { id: 'stock-desc', label: 'Stock mayor a menor', field: 'stock', direction: 'desc' },
  { id: 'created-desc', label: 'Más recientes', field: 'createdAt', direction: 'desc' },
  { id: 'created-asc', label: 'Más antiguos', field: 'createdAt', direction: 'asc' }
] as const;

// Configuración de vista de productos
export const VIEW_MODES = [
  { id: 'grid', label: 'Cuadrícula', icon: 'grid' },
  { id: 'list', label: 'Lista', icon: 'list' }
] as const;

// Configuración de paginación
export const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96] as const;

// Tipos para el frontend
export type PriceRange = typeof PRICE_RANGES[number];
export type WeightRange = typeof WEIGHT_RANGES[number];
export type SortOption = typeof SORT_OPTIONS[number];
export type ViewMode = typeof VIEW_MODES[number];
export type ItemsPerPage = typeof ITEMS_PER_PAGE_OPTIONS[number];
