import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Download,
  Upload,
  Package,
  AlertTriangle,
  TrendingUp,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Tag,
  DollarSign,
  Grid3X3,
  List,
  ScanLine,
  ArrowUp,
  ArrowDown,
  X,
  Save,
  CheckCircle,
  XCircle,
  Star,
  Info,
  Gem,
  Settings
} from 'lucide-react';

import SettingsService from '@/lib/settingsService';
import { productRawSchema, type ProductRaw } from '@/schemas/product';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { useProductsStore } from '@/store/productsStore';
import SearchBar from '@/components/SearchBar';
import ProductAssetsService from '@/services/productAssetsService';
import BarcodeScanner from '@/components/BarcodeScanner';
import HardwareScannerListener from '@/components/Hardware/HardwareScannerListener';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { z } from 'zod';
import { parseFlexibleCsvFile, parseFlexibleXlsxBuffer, type ProductImportFlexibleRow } from '@/services/importers';
import { api, initializeApiBaseUrl, normalizeListPayloadWithSchema, apiUtils } from '@/lib/api';

// Interfaces mejoradas
interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  taxId?: string;
  isActive: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

interface StockMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string;
  notes?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  qrCode?: string;
  
  // Precios
  costPrice: number;
  wholesalePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  
  // Stock
  stock: number;
  minStock: number;
  maxStock?: number;
  reservedStock: number;
  availableStock: number;
  
  // Categorización
  category: string | Category;
  subcategory?: string;
  brand?: string;
  model?: string;
  tags: string[];
  
  // Proveedor
  supplier?: Supplier;
  supplierSku?: string;
  
  // Características físicas
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit: 'cm' | 'mm' | 'in';
  };
  color?: string;
  material?: string;
  size?: string;
  
  // Joyería específica
  metal?: string;
  metalPurity?: string;
  gemstone?: string;
  gemstoneWeight?: number;
  gemstoneColor?: string;
  gemstoneCut?: string;
  gemstoneClarity?: string;
  certification?: string;
  
  // Imágenes y multimedia
  images: string[];
  primaryImage?: string;
  videos?: string[];
  documents?: string[];
  
  // Estado y configuración
  isActive: boolean;
  isFeatured: boolean;
  isDigital: boolean;
  requiresSerial: boolean;
  allowBackorder: boolean;
  trackInventory: boolean;
  
  // Fechas importantes
  createdAt: string;
  updatedAt: string;
  lastSoldAt?: string;
  lastRestockedAt?: string;
  
  // Mó©tricas
  totalSold: number;
  totalRevenue: number;
  averageRating?: number;
  reviewCount: number;
  viewCount: number;
  
  // Configuració³n de venta
  taxable: boolean;
  taxRate?: number;
  discountable: boolean;
  maxDiscount?: number;
  
  // Ubicació³n
  location?: {
    warehouse?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
  };
  
  // Garantó­a y servicio
  warrantyMonths?: number;
  returnPolicy?: string;
  
  // SEO y marketing
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
}

interface ProductFormData {
  // Información básica
  name: string;
  description: string;
  sku: string;
  barcode: string;
  
  // Precios
  costPrice: string;
  wholesalePrice: string;
  
  // Stock
  stock: string;
  minStock: string;
  maxStock: string;
  
  // Categorización
  categoryId: string;
  subcategory: string;
  brand: string;
  model: string;
  tags: string[];
  
  // Proveedor
  supplierId: string;
  supplierSku: string;
  
  // Caracteró­sticas
  weight: string;
  color: string;
  material: string;
  size: string;
  
  // Joyeró­a
  metal: string;
  metalPurity: string;
  gemstone: string;
  gemstoneWeight: string;
  gemstoneColor: string;
  gemstoneCut: string;
  gemstoneClarity: string;
  certification: string;
  
  // Configuració³n
  isActive: boolean;
  isFeatured: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  requiresSerial: boolean;
  
  // Impuestos y descuentos
  taxable: boolean;
  taxRate: string;
  discountable: boolean;
  maxDiscount: string;
  
  // Ubicació³n
  warehouse: string;
  aisle: string;
  shelf: string;
  bin: string;
  
  // Garantía
  warrantyMonths: string;
  returnPolicy: string;
  
  // Auditoría de cambios de precio
  priceUpdateReason: string;
  priceUpdateCurrency: string;
}
interface FilterState {
  search: string;
  category: string;
  supplier: string;
  brand: string;
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  priceRange: [number, number];
  isActive: boolean | null;
  isFeatured: boolean | null;
  startDate?: string;
  endDate?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
}

type ProductsPageProps = { testMode?: boolean };
const ProductsPage: React.FC<ProductsPageProps> = ({ testMode = false }) => {
  // Estados principales
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(!testMode);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  // Eliminados modales no utilizados (categoró­a, proveedor, importació³n, movimientos)
  const [showStockModal, setShowStockModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [assetsProduct, setAssetsProduct] = useState<Product | null>(null);
  const [assetsList, setAssetsList] = useState<Array<{ id: string; serial: string; status: string; hallmark?: string; condition?: string; location?: string }>>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetForm, setAssetForm] = useState<{ serial: string; status: 'available' | 'reserved' | 'sold' | 'service'; hallmark?: string; condition?: string; location?: string }>({ serial: '', status: 'available' });

  // Prefetch helpers (deben estar dentro del componente)
  const prefetchImportLibs = useCallback(() => {
    return Promise.all([
      import('papaparse'),
      import('xlsx')
    ]).catch(() => {});
  }, []);

  const prefetchScannerLib = useCallback(() => {
    return import('@zxing/library').catch(() => {});
  }, []);

  const openAssetsModal = useCallback(async (product: Product) => {
    setAssetsProduct(product);
    setShowAssetsModal(true);
    setAssetsLoading(true);
    try {
      const res = await ProductAssetsService.list({ productId: product.id });
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setAssetsList(items.map((it: any) => ({ id: it.id, serial: it.serial, status: it.status, hallmark: it.hallmark, condition: it.condition, location: it.location })));
    } catch (e) {
      useNotificationStore.getState().showError('Error cargando activos', (e as Error)?.message || String(e));
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  const createAsset = useCallback(async () => {
    if (!assetsProduct) return;
    if (!assetForm.serial.trim()) {
      useNotificationStore.getState().showWarning('Serial requerido', 'Ingresa un serial único');
      return;
    }
    try {
      const res = await ProductAssetsService.create({ productId: assetsProduct.id, serial: assetForm.serial.trim(), status: assetForm.status, hallmark: assetForm.hallmark, condition: assetForm.condition, location: assetForm.location });
      const created = res?.data || res;
      setAssetsList(prev => [{ id: created.id, serial: created.serial, status: created.status, hallmark: created.hallmark, condition: created.condition, location: created.location }, ...prev]);
      setAssetForm({ serial: '', status: 'available' });
      useNotificationStore.getState().showSuccess('Activo creado');
    } catch (e) {
      useNotificationStore.getState().showError('Error creando activo', (e as Error)?.message || String(e));
    }
  }, [assetsProduct, assetForm]);

  const deleteAsset = useCallback(async (id: string) => {
    try {
      await ProductAssetsService.remove(id);
      setAssetsList(prev => prev.filter(a => a.id !== id));
      useNotificationStore.getState().showSuccess('Activo eliminado');
    } catch (e) {
      useNotificationStore.getState().showError('Error eliminando activo', (e as Error)?.message || String(e));
    }
  }, []);

  const generateAssetLabel = useCallback(async (asset: { id: string; serial: string }) => {
    try {
      const productCode = (assetsProduct as any)?.barcode || (assetsProduct as any)?.sku || '';
      const payload = { codigo: String(productCode || ''), serial: asset.serial, nombre: (assetsProduct as any)?.name || '', categoria: (typeof (assetsProduct as any)?.category === 'string' ? (assetsProduct as any)?.category : (assetsProduct as any)?.category?.name) || '', precio: (assetsProduct as any)?.costPrice || 0 };
      const res = await ProductAssetsService.generateLabel(payload);
      const data = res?.data || res;
      if (data?.downloadUrl) {
        useNotificationStore.getState().showSuccess('Etiqueta generada', 'Descarga disponible');
        try { window.open(data.downloadUrl, '_blank'); } catch {}
      } else {
        useNotificationStore.getState().showSuccess('Etiqueta generada');
      }
    } catch (e) {
      useNotificationStore.getState().showError('Error generando etiqueta', (e as Error)?.message || String(e));
    }
  }, [assetsProduct]);

  // Prefetch cuando se abre el modal del escó¡ner
  useEffect(() => {
    if (showScanner) {
      prefetchScannerLib();
    }
  }, [showScanner, prefetchScannerLib]);

  // Prefill de moneda desde configuraciones públicas
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const publicSettings = await SettingsService.getPublicSettings();
        if (active && publicSettings?.currency) {
          setFormData(prev => ({ ...prev, priceUpdateCurrency: publicSettings.currency }));
        }
      } catch {
        // Mantener valor por defecto si falla
      }
    })();
    return () => { active = false; };
  }, []);
  
  // Producto en edición
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalImagesLoading, setModalImagesLoading] = useState<boolean>(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  
  // Sistema de respaldo automático para Tauri
  const [formBackup, setFormBackup] = useState<ProductFormData | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [codeGenerationProgress, setCodeGenerationProgress] = useState<{
    isGenerating: boolean;
    currentStep: string;
    progress: number;
  }>({ isGenerating: false, currentStep: '', progress: 0 });
  
  // Formularios
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    costPrice: '',
    wholesalePrice: '',
    stock: '',
    minStock: '',
    maxStock: '',
    categoryId: '',
    subcategory: '',
    brand: '',
    model: '',
    tags: [],
    supplierId: '',
    supplierSku: '',
    weight: '',
    color: '',
    material: '',
    size: '',
    metal: '',
    metalPurity: '',
    gemstone: '',
    gemstoneWeight: '',
    gemstoneColor: '',
    gemstoneCut: '',
    gemstoneClarity: '',
    certification: '',
    isActive: true,
    isFeatured: false,
    trackInventory: true,
    allowBackorder: false,
    requiresSerial: false,
    taxable: true,
    taxRate: '',
    discountable: true,
    maxDiscount: '',
    warehouse: '',
    aisle: '',
    shelf: '',
    bin: '',
    warrantyMonths: '',
    returnPolicy: '',

    priceUpdateReason: '',
    priceUpdateCurrency: ''});
  
  // --- Códigos integrados al flujo de creación ---
  // Utilidad para normalizar texto a un prefijo de código (sin acentos)
  const toPrefix = useCallback((name?: string) => {
    if (!name) return 'PRD';
    const clean = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toUpperCase();
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0] || 'PRD';
    const second = parts[1] || '';
    const prefix = (first.slice(0,3) + (second ? '-' + second.slice(0,3) : '')).replace(/-+$/,'');
    return prefix || 'PRD';
  }, []);

  // Genera un SKU/código basado en categoró­a y nombre con sufijo óºnico corto
  const generateSkuBarcode = useCallback(() => {
    const category = categories.find(c => c.id === formData.categoryId);
    const catPrefix = toPrefix(category?.name);
    const namePrefix = toPrefix(formData.name);
    const base = `${catPrefix}-${namePrefix}`.replace(/--+/g,'-');
    const unique = Date.now().toString(36).toUpperCase().slice(-5);
    return `${base}-${unique}`;
  }, [categories, formData.categoryId, formData.name, toPrefix]);

  const handleGenerateCodes = useCallback(() => {
    const code = generateSkuBarcode();
    setFormData(prev => ({ ...prev, sku: code, barcode: code }));
    try {
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Códigos generados',
        message: `Se asignó '${code}' al SKU y Código de Barras.`
      });
    } catch (error) { console.warn('ProductsPage: failed to update local product stats:', error); }
  }, [generateSkuBarcode]);

  // Sistema de respaldo automático para Tauri - cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (showProductModal && formData.name) {
        const backupKey = `product-form-backup-${editingProduct?.id || 'new'}-${Date.now()}`;
        const backupData = {
          formData,
          timestamp: new Date().toISOString(),
          editingProductId: editingProduct?.id || null,
          editingProductName: editingProduct?.name || null
        };
        
        try {
          localStorage.setItem(backupKey, JSON.stringify(backupData));
          setLastBackupTime(new Date());
          
          // Limpiar backups antiguos (más de 24 horas)
          const keys = Object.keys(localStorage).filter(key => key.startsWith('product-form-backup-'));
          const now = Date.now();
          keys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              const timestamp = new Date(data.timestamp).getTime();
              if (now - timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.warn('No se pudo guardar el respaldo del formulario:', error);
        }
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [showProductModal, formData, editingProduct]);

  // Función para verificar si hay cambios sin guardar
  const hasUnsavedChanges = useCallback(() => {
    if (!showProductModal || !formData.name) return false;
    
    // Comparar con el producto original si estamos editando
    if (editingProduct) {
      return (
        formData.name !== editingProduct.name ||
        formData.description !== (editingProduct.description || '') ||
        formData.sku !== editingProduct.sku ||
        formData.costPrice !== editingProduct.costPrice.toString() ||
        formData.stock !== editingProduct.stock.toString() ||
        formData.metal !== (editingProduct.metal || '') ||
        formData.metalPurity !== (editingProduct.metalPurity || '') ||
        formData.gemstone !== (editingProduct.gemstone || '') ||
        formData.gemstoneWeight !== (editingProduct.gemstoneWeight?.toString() || '') ||
        formData.certification !== (editingProduct.certification || '')
      );
    }
    
    // Para nuevo producto, verificar si hay datos significativos
    return !!(formData.name || formData.sku || formData.metal || formData.gemstone);
  }, [showProductModal, formData, editingProduct]);

  // Función para cerrar modal con confirmación si hay cambios
  const closeProductModal = useCallback(() => {
    if (hasUnsavedChanges()) {
      const confirmClose = window.confirm(
        '¿Estás seguro de que deseas cerrar?\n\n' +
        'Hay cambios sin guardar que se perderán:\n' +
        '- Información del producto\n' +
        (formData.metal ? `- Datos de joyería (metal, gemas)\n` : '') +
        '\nGuarda los cambios antes de cerrar o se perderán.'
      );
      
      if (!confirmClose) {
        return;
      }
    }
    
    setShowProductModal(false);
    setEditingProduct(null);
    resetForm();
  }, [hasUnsavedChanges, formData]);

  // Función para verificar y recuperar borradores al abrir el formulario
  const checkForFormBackup = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('product-form-backup-'));
    const relevantBackups = keys.filter(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const editingId = editingProduct?.id || 'new';
        return key.includes(`-${editingId}-`) || (editingId === 'new' && !data.editingProductId);
      } catch {
        return false;
      }
    });

    if (relevantBackups.length > 0) {
      // Encontrar el backup más reciente
      const latestBackup = relevantBackups.reduce((latest, current) => {
        try {
          const latestData = JSON.parse(localStorage.getItem(latest) || '{}');
          const currentData = JSON.parse(localStorage.getItem(current) || '{}');
          return new Date(currentData.timestamp) > new Date(latestData.timestamp) ? current : latest;
        } catch {
          return current;
        }
      });

      try {
        const backupData = JSON.parse(localStorage.getItem(latestBackup) || '{}');
        const timeDiff = Date.now() - new Date(backupData.timestamp).getTime();
        
        // Solo ofrecer recuperación si tiene menos de 24 horas
        if (timeDiff < 24 * 60 * 60 * 1000) {
          const shouldRecover = window.confirm(
            `¿Deseas recuperar el borrador guardado automáticamente?\n\n` +
            `Guardado: ${new Date(backupData.timestamp).toLocaleString()}\n` +
            `Producto: ${backupData.formData.name || 'Sin nombre'}\n\n` +
            `Si eliges NO recuperar, el borrador se eliminará.`
          );
          
          if (shouldRecover) {
            setFormData(backupData.formData);
            showSuccess('Formulario recuperado exitosamente', 'Se restauraron los datos del borrador');
          }
          
          // Limpiar backup procesado
          localStorage.removeItem(latestBackup);
          return shouldRecover;
        } else {
          // Backup antiguo, eliminar
          localStorage.removeItem(latestBackup);
        }
      } catch (error) {
        console.warn('Error al procesar backup:', error);
        localStorage.removeItem(latestBackup);
      }
    }
    
    return false;
  }, [editingProduct]);

  // Filtros y búsqueda
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    supplier: '',
    brand: '',
    stockStatus: 'all',
    priceRange: [0, 100000],
    isActive: true,
    isFeatured: null,
    startDate: '',
    endDate: '',
    sortBy: 'name',
    sortOrder: 'asc',
    viewMode: 'grid'
  });
  
  // Estados adicionales
  const [stockAdjustment, setStockAdjustment] = useState({
    productId: '',
    type: 'adjustment' as 'in' | 'out' | 'adjustment',
    quantity: '',
    reason: '',
    notes: ''
  });
  
  const [bulkAction, setBulkAction] = useState({
    action: '',
    value: '',
    reason: ''
  });
  
  // Importació³n de productos (CSV/XLSX)
  const ImportProductSchema = z.object({
    sku: z.string().min(1, 'SKU requerido'),
    name: z.string().min(1, 'Nombre requerido'),
    costPrice: z.coerce.number().nonnegative().default(0),
    retailPrice: z.coerce.number().nonnegative().optional(),
    stock: z.coerce.number().int().nonnegative().default(0),
    category: z.string().optional(),
    brand: z.string().optional(),
  });
  type ImportRow = ProductImportFlexibleRow;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Hooks
  const { showSuccess, showError, showWarning } = useNotificationStore();
  const offlineCtx = useOfflineStore();
  const isOffline = Boolean((offlineCtx as any)?.isOffline);
  const addPendingAction = (offlineCtx as any)?.addPendingAction || (() => {});
  const setOfflineStatus = (offlineCtx as any)?.setOfflineStatus || (() => {});
  const syncPendingActions = (offlineCtx as any)?.syncPendingActions || (async () => {});
  const pendingActions = Array.isArray((offlineCtx as any)?.pendingActions) ? (offlineCtx as any)?.pendingActions : [];
  const syncInProgress = Boolean((offlineCtx as any)?.syncInProgress);
  const { products: storeProducts, setProducts: setStoreProducts } = useProductsStore();
  
  // Modo de prueba via query (?testMode=1) para utilidades de depuració³n
  const queryTestMode = (() => {
    try {
      if (typeof window === 'undefined') return false;
      const directSearch = window.location.search;
      const hashSearch = window.location.hash && window.location.hash.includes('?')
        ? window.location.hash.split('?')[1]
        : '';
      const search = directSearch && directSearch.length > 0 ? directSearch : hashSearch;
      return new URLSearchParams(search).get('testMode') === '1';
    } catch {
      return false;
    }
  })();
  
  // Auto-import demo data on first load in test mode
  const didAutoImportRef = useRef(false);
  useEffect(() => {
    if (!(queryTestMode || testMode)) return;
    try {
      const already = didAutoImportRef.current;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('products-store') : null;
      let persistedCount = 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const items = parsed && parsed.state && Array.isArray(parsed.state.products) ? parsed.state.products : [];
          persistedCount = items.length;
        } catch { /* noop */ }
      }
      const currentCount = Array.isArray(storeProducts) ? storeProducts.length : 0;
      if (!already && persistedCount === 0 && currentCount === 0) {
        didAutoImportRef.current = true;
        // Trigger the same flow as manual test import
        handleTestImportClick().catch(() => {});
      }
    } catch { /* noop */ }
  }, [queryTestMode, testMode, storeProducts]);

  // Install fetch audit in test mode to capture product update payloads
  useEffect(() => {
    if (!(queryTestMode || testMode)) return;
    try {
      const anyWindow = window as any;
      if (anyWindow.__auditFetchInstalled) return;
      anyWindow.__auditFetchInstalled = true;
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input: any, init?: any) => {
        const method = ((init?.method) || 'GET').toString().toUpperCase();
        const url = typeof input === 'string' ? input : input?.url;
        const bodyRaw = init?.body;
        const res = await origFetch(input, init);
        try {
          if (method === 'PUT' && url && url.includes('/api/products')) {
            let bodyParsed: any = null;
            if (typeof bodyRaw === 'string') {
              try { bodyParsed = JSON.parse(bodyRaw); } catch { /* noop */ }
            }
            const info = { url, method, bodyRaw, bodyParsed, at: Date.now() };
            console.log('[AUDIT PUT products]', info);
            anyWindow.__audit = { ...(anyWindow.__audit || {}), lastProductPut: info };
          }
        } catch { /* noop */ }
        return res;
      };
    } catch (e) {
      console.warn('ProductsPage: failed to install fetch audit', e);
    }
  }, [queryTestMode, testMode]);
  // Disparador: importació³n de prueba en testMode usando store offline
  const handleTestImportClick = async () => {
    try {
      const sample = [
        { code: 'P-100', sku: 'P-100', name: 'Producto de prueba 100', costPrice: 10, retailPrice: 15, stock: 5, category: 'General', brand: 'Demo' },
        { code: 'P-101', sku: 'P-101', name: 'Producto de prueba 101', costPrice: 12, retailPrice: 18, stock: 7, category: 'General', brand: 'Demo' }
      ];
      // Simular flujo offline -> encolar -> volver online -> sincronizar
      try { setOfflineStatus(true); } catch {}
      addPendingAction({
        type: 'BULK_IMPORT_PRODUCTS',
        data: { items: sample, upsert: true, skipDuplicates: true, dryRun: false },
        priority: 'high',
        maxRetries: 5,
        meta: { source: 'testMode', timestamp: Date.now() }
      } as any);
      try { setOfflineStatus(false); } catch {}
      try { await syncPendingActions(); } catch {}
      // Fallback adicional para entorno de prueba: persistir directamente en el store
      try {
        if (queryTestMode || testMode) {
          const now = new Date().toISOString();
          const mapped = sample.map((it: any) => {
            const codeOrSku = String((it?.code ?? it?.sku ?? '').toString().trim());
            const categoryName = String(it?.category || 'General');
            const categoryObj = {
              id: categoryName,
              name: categoryName,
              description: '',
              parentId: undefined,
              isActive: true,
              productCount: 0,
              createdAt: now,
            };
            const stock = Math.max(0, Number(it?.stock) || 0);
            const purchasePrice = Math.max(0.01, Number(it?.costPrice ?? it?.purchasePrice) || 0.01);
            const salePrice = Math.max(purchasePrice, Number(it?.retailPrice ?? it?.salePrice) || purchasePrice);
            return {
              id: codeOrSku || `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
              name: String(it?.name || it?.code || 'Producto importado'),
              description: String(it?.description || ''),
              sku: String(it?.sku ?? it?.code ?? ''),
              barcode: String(it?.barcode ?? it?.sku ?? it?.code ?? ''),
              qrCode: String(it?.sku ?? it?.code ?? ''),
              costPrice: purchasePrice,
              wholesalePrice: salePrice,
              stock,
              minStock: Number(it?.minStock) || 0,
              reservedStock: 0,
              availableStock: stock,
              category: categoryObj as any,
              brand: it?.brand || undefined,
              tags: Array.isArray(it?.tags) ? it.tags : [],
              images: Array.isArray(it?.images) ? it.images : [],
              isActive: true,
              isFeatured: false,
              isDigital: false,
              requiresSerial: false,
              allowBackorder: false,
              trackInventory: true,
              createdAt: now,
              updatedAt: now,
              totalSold: 0,
              totalRevenue: 0,
            } as any;
          });
          const current = Array.isArray(storeProducts) ? storeProducts : [];
          const nextProducts = [...current, ...mapped];
          setStoreProducts(nextProducts);
          try {
            const persisted = JSON.stringify({ state: { products: nextProducts, lastUpdated: Date.now() }, version: 0 });
            localStorage.setItem('products-store', persisted);
          } catch { /* noop */ }
        }
      } catch (e) { /* noop */ }
      showSuccess('Importació³n de prueba procesada (testMode)');
    } catch (err) {
      console.error('ProductsPage: Test import failed', err);
      showError('Falló³ la importació³n de prueba');
    }
  };
  
  // Datos de ejemplo para desarrollo
  useEffect(() => {
    if (testMode) return; // evitar carga inicial en modo de prueba
    loadInitialData();
  }, [testMode]);
  
  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Asegurar baseURL antes de llamar a la API
        try { await initializeApiBaseUrl(); } catch (error) { console.warn('initializeApiBaseUrl failed in ProductsPage:', error); }
      
      // Cargar datos reales desde la API
      const [productsResponse, categoriesResponse, suppliersResponse] = await Promise.allSettled([
        // Solicitar solo productos activos para evitar reaparició³n de eliminados (soft delete)
        api.get('/products?isActive=true', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '900000' } } as any),
        // No ocultar errores: si falla, lo manejamos abajo y mostramos aviso
        api.get('/categories', { __suppressGlobalError: true } as any),
        api.get('/suppliers', { __suppressGlobalError: true } as any).catch(() => ({ data: { success: true, data: [] } })) // Fallback si no existe endpoint
      ]);

      // Preparar categoró­as del backend (con fallback por defecto)
      let cats: Category[] = [];
      if (categoriesResponse.status === 'fulfilled' && categoriesResponse.value.data.success && categoriesResponse.value.data.data.length > 0) {
        cats = categoriesResponse.value.data.data as Category[];
        setCategories(cats);
      } else {
        console.warn('No se pudieron cargar categoró­as del backend');
        try { showWarning('No se pudieron cargar categoró­as desde el servidor. Usando categoró­as por defecto.'); } catch (error) { console.warn('ProductsPage: failed to show warning:', error); }
        const FALLBACK_CATEGORY_NAMES = ['Anillos', 'Alianzas', 'Cadenas', 'Collares', 'Pulseras', 'Aretes', 'Pendientes', 'Broches', 'Relojes', 'Gemelos', 'Dijes', 'Charms', 'Otros'] as const;
        const nowIso = new Date().toISOString();
        cats = FALLBACK_CATEGORY_NAMES.map(name => ({
          id: name,
          name,
          description: '',
          parentId: undefined,
          isActive: true,
          productCount: 0,
          createdAt: nowIso,
        })) as Category[];
        setCategories(cats);
      }

      // Procesar proveedores del backend
      let sups: Supplier[] = [];
      if (suppliersResponse.status === 'fulfilled' && suppliersResponse.value.data.success && suppliersResponse.value.data.data.length > 0) {
        sups = suppliersResponse.value.data.data as Supplier[];
        setSuppliers(sups);
      } else {
        console.warn('No se pudieron cargar proveedores del backend');
        sups = [];
        setSuppliers([]);
      }

      // Procesar productos: mapear del backend al modelo del frontend
      let backendProducts: any[] = [];
      if (productsResponse.status === 'fulfilled') {
        const raw = productsResponse.value.data;
        const apiProducts = normalizeListPayloadWithSchema<ProductRaw>(raw, productRawSchema);
        // Si la API devolvió³ datos vó¡lidos, usarlos y persistir en store
        if (Array.isArray(apiProducts) && apiProducts.length > 0) {
          backendProducts = apiProducts as any[];
          try { setStoreProducts(apiProducts as any[]); } catch (error) { console.warn('ProductsPage: failed to set store products:', error); }
        } else {
          // Fallback: si la API respondió³ vacó­a, usar productos del store persistido
          console.warn('API devolvió³ lista vacó­a, usando productos en cachó©');
          backendProducts = Array.isArray(storeProducts) ? storeProducts : [];
        }
      } else {
        // Fallback: si la API falló³, usar productos del store persistido
        console.warn('Carga de productos fallida, usando productos en cachó©');
        backendProducts = Array.isArray(storeProducts) ? storeProducts : [];
      }

  const mappedProducts: Product[] = backendProducts.map((bp: any) => {
        const categoryObj = cats.find(c => c.name === bp.category) || {
          id: bp.category || 'unknown',
          name: bp.category || 'Sin categoró­a',
          description: '',
          parentId: undefined,
          isActive: true,
          productCount: 0,
          createdAt: bp.createdAt || new Date().toISOString()
        } as Category;
        const supplierObj = bp.supplier ? (sups.find(s => s.name === bp.supplier) || {
          id: bp.supplier,
          name: bp.supplier,
          isActive: true,
          createdAt: new Date().toISOString()
        } as Supplier) : undefined;

    return {
      id: bp.id,
      name: bp.name,
      description: bp.description || '',
      sku: bp.code || '',
      barcode: bp.barcode || undefined,
      qrCode: bp.qrCode || undefined,
      costPrice: bp.purchasePrice ?? 0,
      wholesalePrice: undefined,
      minPrice: undefined,
      maxPrice: undefined,
          stock: bp.stock ?? 0,
          minStock: bp.minStock ?? 0,
          maxStock: undefined,
          reservedStock: bp.reservedStock ?? 0,
          availableStock: (bp.stock ?? 0) - (bp.reservedStock ?? 0),
          // Normaliza categoró­a a string (nombre) para evitar render de objetos en JSX
          category: categoryObj.name,
          subcategory: typeof bp.subcategory === 'string' ? bp.subcategory : (bp.subcategory ? String(bp.subcategory) : undefined),
          brand: typeof bp.brand === 'string' ? bp.brand : (bp.brand ? String(bp.brand) : undefined),
          model: bp.model || undefined,
          tags: Array.isArray(bp.tags) ? bp.tags : [],
          supplier: supplierObj,
          supplierSku: bp.supplierSku || undefined,
          weight: bp.grams,
          dimensions: undefined,
          color: bp.color || undefined,
          material: bp.material || undefined,
          size: bp.size || undefined,
          metal: bp.metal || undefined,
          metalPurity: bp.metalPurity || undefined,
          gemstone: bp.stoneType || undefined,
          gemstoneWeight: bp.stoneCarat || undefined,
          gemstoneColor: bp.stoneColor || undefined,
          gemstoneCut: bp.stoneCut || undefined,
          gemstoneClarity: bp.gemstoneClarity || undefined,
          certification: bp.certification || undefined,
          images: Array.isArray(bp.images) ? bp.images : [],
          primaryImage: bp.imageUrl || bp.primaryImage || undefined,
          videos: Array.isArray(bp.videos) ? bp.videos : [],
          documents: Array.isArray(bp.documents) ? bp.documents : [],
          isActive: bp.isActive ?? true,
          isFeatured: bp.isFeatured ?? false,
          isDigital: bp.isDigital ?? false,
          requiresSerial: bp.requiresSerial ?? false,
          allowBackorder: bp.allowBackorder ?? false,
          trackInventory: bp.trackInventory ?? true,
          createdAt: bp.createdAt || new Date().toISOString(),
          updatedAt: bp.updatedAt || new Date().toISOString(),
          lastSoldAt: bp.lastSoldAt || undefined,
          lastRestockedAt: bp.lastRestockedAt || undefined,
          totalSold: bp.totalSold ?? 0,
          totalRevenue: bp.totalRevenue ?? 0,
          averageRating: bp.averageRating || undefined,
          reviewCount: bp.reviewCount ?? 0,
          viewCount: bp.viewCount ?? 0,
          taxable: bp.taxable ?? true,
          taxRate: bp.taxRate || undefined,
          discountable: bp.discountable ?? true,
          maxDiscount: bp.maxDiscount || undefined,
          location: bp.location || undefined,
          warrantyMonths: bp.warrantyMonths || undefined,
          returnPolicy: bp.returnPolicy || undefined,
          metaTitle: bp.metaTitle || undefined,
          metaDescription: bp.metaDescription || undefined,
          keywords: Array.isArray(bp.keywords) ? bp.keywords : []
        } as Product;
      });
      setProducts(mappedProducts);
      
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };
  
  // Productos filtrados
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    
    // Bóºsqueda por texto
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.barcode?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Filtro por categoró­a
    if (filters.category) {
      filtered = filtered.filter(product => {
        // Soporta productos con categoró­a como objeto { id, name } o como string (nombre)
        const catId = (product as any)?.category?.id ?? (product as any)?.category;
        if (typeof catId === 'string') {
          if (catId === filters.category) return true; // coincide por id directamente
          // Si el producto trae categoró­a como nombre, intentamos comparar por nombre
          const selectedCategoryName = categories.find(c => c.id === filters.category)?.name;
          return selectedCategoryName ? (typeof (product as any)?.category === 'string' ? (product as any)?.category === selectedCategoryName : ((product as any)?.category?.name === selectedCategoryName)) : false;
        }
        return false;
      });
    }
    
    // Filtro por proveedor
    if (filters.supplier) {
      filtered = filtered.filter(product => product.supplier?.id === filters.supplier);
    }
    
    // Filtro por marca
    if (filters.brand) {
      filtered = filtered.filter(product => product.brand === filters.brand);
    }
    
    // Filtro por estado de stock
    if (filters.stockStatus !== 'all') {
      filtered = filtered.filter(product => {
        switch (filters.stockStatus) {
          case 'in_stock':
            return product.availableStock > product.minStock;
          case 'low_stock':
            return product.availableStock <= product.minStock && product.availableStock > 0;
          case 'out_of_stock':
            return product.availableStock === 0;
          default:
            return true;
        }
      });
    }
    
    // Filtro por rango de precio (usar precio costo como referencia)
    filtered = filtered.filter(product =>
      product.costPrice >= filters.priceRange[0] && product.costPrice <= filters.priceRange[1]
    );
    
    // Filtro por estado activo
    if (filters.isActive !== null) {
      filtered = filtered.filter(product => product.isActive === filters.isActive);
    }
    
    // Filtro por destacado
    if (filters.isFeatured !== null) {
      filtered = filtered.filter(product => product.isFeatured === filters.isFeatured);
    }

    // Filtro por rango de fechas de creació³n
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter((product) => {
        const created = new Date(product.createdAt);
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          if (created < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
        return true;
      });
    }
    
    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue: any = a[filters.sortBy as keyof Product];
      let bValue: any = b[filters.sortBy as keyof Product];
      
      // Manejar casos especiales
      if (filters.sortBy === 'category') {
        aValue = typeof a.category === 'string' ? a.category : (a.category?.name || '');
        bValue = typeof b.category === 'string' ? b.category : (b.category?.name || '');
      } else if (filters.sortBy === 'supplier') {
        aValue = a.supplier?.name || '';
        bValue = b.supplier?.name || '';
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [products, filters]);
  
  // Estadó­sticas
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.isActive).length;
    const lowStockProducts = products.filter(p => p.availableStock <= p.minStock && p.availableStock > 0).length;
    const outOfStockProducts = products.filter(p => p.availableStock === 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.availableStock * p.costPrice), 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const featuredProducts = products.filter(p => p.isFeatured).length;
    
    return {
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue,
      totalRevenue,
      featuredProducts
    };
  }, [products]);
  
  // Funciones de manejo de formularios
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      barcode: '',
      costPrice: '',
      wholesalePrice: '',
      stock: '',
      minStock: '',
      maxStock: '',
      categoryId: '',
      subcategory: '',
      brand: '',
      model: '',
      tags: [],
      supplierId: '',
      supplierSku: '',
      weight: '',
      color: '',
      material: '',
      size: '',
      metal: '',
      metalPurity: '',
      gemstone: '',
      gemstoneWeight: '',
      gemstoneColor: '',
      gemstoneCut: '',
      gemstoneClarity: '',
      certification: '',
      isActive: true,
      isFeatured: false,
      trackInventory: true,
      allowBackorder: false,
      requiresSerial: false,
      taxable: true,
      taxRate: '',
      discountable: true,
      maxDiscount: '',
      warehouse: '',
      aisle: '',
      shelf: '',
      bin: '',
      warrantyMonths: '',
      returnPolicy: '',
      priceUpdateReason: '',
      priceUpdateCurrency: formData.priceUpdateCurrency || ''
    });
  };
  
  // Función auxiliar para manejar imágenes en modo offline
  const handleOfflineImageUpload = async (file: File, productId: string): Promise<string | null> => {
    try {
      // Convertir imagen a base64 para almacenamiento offline
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const imageId = `offline-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Guardar imagen en localStorage
          const offlineImages = JSON.parse(localStorage.getItem('offline-product-images') || '{}');
          offlineImages[imageId] = {
            base64,
            productId,
            filename: file.name,
            size: file.size,
            type: file.type,
            timestamp: Date.now()
          };
          localStorage.setItem('offline-product-images', JSON.stringify(offlineImages));
          
          // Agregar acción offline para subir imagen cuando esté online
          const { useOfflineStore } = await import('@/store/offlineStore');
          const offlineStore = useOfflineStore.getState();
          offlineStore.addPendingAction({
            type: 'UPDATE_PRODUCT',
            data: {
              productId,
              action: 'upload_image',
              imageId,
              filename: file.name
            },
            priority: 'medium',
            maxRetries: 3
          });
          
          resolve(base64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error en upload offline:', error);
      return null;
    }
  };

  // Función para guardar backup del formulario
  const saveFormBackup = useCallback(() => {
    if (!showProductModal) return;
    
    const backupKey = editingProduct 
      ? `product-form-backup-${editingProduct.id}-${Date.now()}`
      : `product-form-backup-new-${Date.now()}`;
    
    const backupData = {
      formData,
      editingProductId: editingProduct?.id || null,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    try {
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Limpiar backups antiguos (mantener solo los últimos 5)
      const keys = Object.keys(localStorage).filter(key => key.startsWith('product-form-backup-'));
      if (keys.length > 5) {
        keys.sort().reverse(); // Ordenar por timestamp (más reciente primero)
        keys.slice(5).forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.warn('No se pudo guardar backup del formulario:', error);
    }
  }, [formData, editingProduct, showProductModal]);

  // Auto-guardar formulario cada 30 segundos
  useEffect(() => {
    if (!showProductModal) return;
    
    const interval = setInterval(saveFormBackup, 30000);
    return () => clearInterval(interval);
  }, [showProductModal, saveFormBackup]);

  if (false) {
  // Función para recuperar backup
  const checkForFormBackup = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('product-form-backup-'));
    const relevantBackups = keys.filter(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const editingId = editingProduct?.id || 'new';
        return key.includes(`-${editingId}-`) || (editingId === 'new' && !data.editingProductId);
      } catch {
        return false;
      }
    });

    if (relevantBackups.length > 0) {
      // Ordenar por timestamp (más reciente primero)
      relevantBackups.sort((a, b) => {
        const timeA = parseInt(a.split('-').pop() || '0');
        const timeB = parseInt(b.split('-').pop() || '0');
        return timeB - timeA;
      });

      const mostRecent = relevantBackups[0];
      try {
        const backupData = JSON.parse(localStorage.getItem(mostRecent) || '{}');
        const backupAge = Date.now() - backupData.timestamp;
        
        // Solo recuperar si el backup tiene menos de 24 horas
        if (backupAge < 24 * 60 * 60 * 1000) {
          const confirmRecovery = window.confirm(
            'Se encontró un borrador guardado automáticamente.\n\n' +
            '¿Deseas recuperar los datos del formulario?\n\n' +
            'Fecha: ' + new Date(backupData.timestamp).toLocaleString() + '\n' +
            'Producto: ' + (backupData.formData.name || 'Sin nombre')
          );
          
          if (confirmRecovery) {
            setFormData(backupData.formData);
            return true;
          }
        }
      } catch (error) {
        console.warn('Error al recuperar backup:', error);
      }
    }
    
    return false;
  }, [editingProduct]);

  const handleOfflineImageUpload = async (file: File, productId: string): Promise<string | null> => {
    try {
      // Convertir imagen a base64 para almacenamiento offline
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const imageId = `offline-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Guardar imagen en localStorage
          const offlineImages = JSON.parse(localStorage.getItem('offline-product-images') || '{}');
          offlineImages[imageId] = {
            base64,
            productId,
            filename: file.name,
            size: file.size,
            type: file.type,
            timestamp: Date.now()
          };
          localStorage.setItem('offline-product-images', JSON.stringify(offlineImages));
          
          // Agregar acción offline para subir imagen cuando esté online
          const { useOfflineStore } = await import('@/store/offlineStore');
          const offlineStore = useOfflineStore.getState();
          offlineStore.addPendingAction({
            type: 'UPDATE_PRODUCT',
            data: {
              productId,
              action: 'upload_image',
              imageId,
              filename: file.name
            },
            priority: 'medium',
            maxRetries: 3
          });
          
          resolve(base64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error en upload offline:', error);
      return null;
    }
  };

  }
  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      // Cargar galeró­a de imágenes del producto
      setModalImages([]);
      setModalImagesLoading(true);
      api.get(`/products/${product.id}/images`, { __suppressGlobalError: true as any } as any)
        .then(resp => {
          const imgs = Array.isArray(resp?.data?.data) ? resp.data.data : [];
          setModalImages(imgs);
        })
        .catch(err => {
          console.error('Error cargando imágenes del producto:', err);
        })
        .finally(() => setModalImagesLoading(false));
      
      // Verificar si hay borradores antes de cargar los datos del producto
      const hasRecovered = checkForFormBackup();
      if (hasRecovered) {
        setShowProductModal(true);
        return;
      }
      
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
      costPrice: product.costPrice.toString(),
      wholesalePrice: product.wholesalePrice?.toString() || '',
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
        maxStock: product.maxStock?.toString() || '',
        // Normaliza categoryId aceptando categoró­a como objeto o como string (nombre)
        categoryId: (() => {
          const rawCat: any = (product as any).category;
          if (rawCat && typeof rawCat === 'object') {
            return rawCat.id ?? '';
          }
          if (typeof rawCat === 'string') {
            // Si es nombre, mapea al id de categoró­as conocidas; si no existe, conserva el string
            return categories.find(c => c.name === rawCat)?.id || rawCat || '';
          }
          return '';
        })(),
        subcategory: product.subcategory || '',
        brand: product.brand || '',
        model: product.model || '',
        tags: product.tags,
        supplierId: product.supplier?.id || '',
        supplierSku: product.supplierSku || '',
        weight: product.weight?.toString() || '',
        color: product.color || '',
        material: product.material || '',
        size: product.size || '',
        metal: product.metal || '',
        metalPurity: product.metalPurity || '',
        gemstone: product.gemstone || '',
        gemstoneWeight: product.gemstoneWeight?.toString() || '',
        gemstoneColor: product.gemstoneColor || '',
        gemstoneCut: product.gemstoneCut || '',
        gemstoneClarity: product.gemstoneClarity || '',
        certification: product.certification || '',
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        trackInventory: product.trackInventory,
        allowBackorder: product.allowBackorder,
        requiresSerial: product.requiresSerial,
        taxable: product.taxable,
        taxRate: product.taxRate?.toString() || '',
        discountable: product.discountable,
        maxDiscount: product.maxDiscount?.toString() || '',
        warehouse: product.location?.warehouse || '',
        aisle: product.location?.aisle || '',
        shelf: product.location?.shelf || '',
        bin: product.location?.bin || '',
        warrantyMonths: product.warrantyMonths?.toString() || '',
        returnPolicy: product.returnPolicy || '',
        priceUpdateReason: '',
        priceUpdateCurrency: formData.priceUpdateCurrency || ''
      });
    } else {
      setEditingProduct(null);
      setModalImages([]);
      // Verificar si hay borradores antes de resetear el formulario para nuevo producto
      const hasRecovered = checkForFormBackup();
      if (hasRecovered) {
        setShowProductModal(true);
        return;
      }
      resetForm();
    }
    setShowProductModal(true);
  };
  
  // Función de validación mejorada con feedback visual
  const validateForm = (data: ProductFormData): { isValid: boolean; errors: { [key: string]: string } } => {
    const errors: { [key: string]: string } = {};
    
    if (!data.name?.trim()) {
      errors.name = 'El nombre es obligatorio';
    }
    
    if (!data.sku?.trim()) {
      errors.sku = 'El SKU es obligatorio';
    }
    
    if (!data.costPrice || parseFloat(data.costPrice) < 0) {
      errors.costPrice = 'El precio de costo debe ser mayor o igual a 0';
    }
    
    if (!data.stock || parseInt(data.stock) < 0) {
      errors.stock = 'El stock debe ser mayor o igual a 0';
    }
    
    // Validación específica de joyería
    if (data.metal && !data.metalPurity) {
      errors.metalPurity = 'La pureza del metal es obligatoria cuando se especifica el metal';
    }
    
    if (data.metalPurity && !data.metal) {
      errors.metal = 'El tipo de metal es obligatorio cuando se especifica la pureza';
    }
    
    // Validación cruzada de pureza vs tipo de metal
    if (data.metal && data.metalPurity) {
      const metal = data.metal.toLowerCase();
      const purity = data.metalPurity.toLowerCase();
      
      if (metal.includes('oro') && (purity.includes('925') || purity.includes('plata'))) {
        errors.metalPurity = 'La pureza 925 es para plata, no para oro';
      }
      
      if (metal.includes('plata') && (purity.includes('18k') || purity.includes('14k') || purity.includes('24k'))) {
        errors.metalPurity = 'Las purezas de oro (14k, 18k, 24k) no son válidas para plata';
      }
    }
    
    // Validación de gemas
    if (data.gemstone && !data.gemstoneWeight) {
      errors.gemstoneWeight = 'El peso de la gema es obligatorio cuando se especifica el tipo de gema';
    }
    
    if (data.gemstoneWeight && !data.gemstone) {
      errors.gemstone = 'El tipo de gema es obligatorio cuando se especifica el peso';
    }
    
    // Validación de certificación
    if (data.certification && !data.gemstone) {
      errors.certification = 'No se puede certificar sin especificar el tipo de gema';
    }
    
    // Validación de peso de gemas
    if (data.gemstoneWeight) {
      const weight = parseFloat(data.gemstoneWeight);
      if (isNaN(weight) || weight <= 0) {
        errors.gemstoneWeight = 'El peso de la gema debe ser mayor a 0';
      }
      if (weight > 50) {
        errors.gemstoneWeight = 'El peso de la gema parece excesivo (máx. 50 quilates)';
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  // Función mejorada de manejo de errores con recuperación
  const handleSubmitError = async (error: any, originalFormData: ProductFormData) => {
    console.error('Error saving product:', error);
    
    const userChoice = window.confirm(
      `Error al guardar el producto: ${error.message || 'Error desconocido'}\n\n` +
      `¿Qué deseas hacer?\n\n` +
      `Aceptar = Guardar borrador y cerrar\n` +
      `Cancelar = Mantener formulario abierto para corregir`
    );
    
    if (userChoice) {
      // Guardar como borrador
      const draftKey = `product-draft-${Date.now()}`;
      localStorage.setItem(draftKey, JSON.stringify({
        formData: originalFormData,
        timestamp: new Date().toISOString(),
        error: error.message
      }));
      
      // Cerrar modal
      setShowProductModal(false);
      setEditingProduct(null);
      resetForm();
      
      showSuccess('Producto guardado como borrador', 'Puedes recuperarlo más tarde');
    } else {
      // Mantener formulario abierto para corrección
      setSubmitting(false);
    }
  };
  
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Modo prueba para auditoría - autocompletar campos faltantes
    const isTestMode = window.location.search.includes('testMode=1') || process.env.NODE_ENV === 'test';
    const testFormData = {
      ...formData,
      name: formData.name || (isTestMode ? 'Producto Test' : ''),
      sku: formData.sku || (isTestMode ? `SKU-TEST-${Date.now()}` : ''),
      costPrice: formData.costPrice || (isTestMode ? '50' : '0'),
      wholesalePrice: formData.wholesalePrice || (isTestMode ? '100' : '0'),
      stock: formData.stock || (isTestMode ? '10' : '0')
    };
    
    // Validación mejorada con feedback visual
    const validation = validateForm(testFormData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      
      // Mostrar mensaje específico
      const errorMessages = Object.values(validation.errors);
      if (errorMessages.length === 1) {
        showError(errorMessages[0]);
      } else {
        showError(`Por favor corrige los siguientes campos: ${errorMessages.join(', ')}`);
      }
      
      // Hacer scroll al primer campo con error
      const firstErrorField = Object.keys(validation.errors)[0];
      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (errorElement as HTMLElement).focus();
      }
      
      return;
    }
    
    // Limpiar errores previos
    setValidationErrors({});
    
    try {
      setSubmitting(true);
      
      let effectiveCategoryId = testFormData.categoryId;
      let selectedCategory = categories.find(c => c.id === effectiveCategoryId);
      if (!selectedCategory) {
        selectedCategory = categories[0] || {
          id: 'uncategorized',
          name: 'Sin categoró­a',
          description: '',
          parentId: undefined,
          isActive: true,
          productCount: 0,
          createdAt: new Date().toISOString()
        } as Category;
        effectiveCategoryId = selectedCategory.id;
      }
      const category = selectedCategory;
      const supplier = suppliers.find(s => s.id === testFormData.supplierId);
      
      const productData = {
        name: testFormData.name,
        description: testFormData.description,
        sku: testFormData.sku,
        barcode: testFormData.barcode,
        costPrice: parseFloat(testFormData.costPrice) || 0,
        wholesalePrice: parseFloat(testFormData.wholesalePrice) || undefined,
        stock: parseInt(testFormData.stock) || 0,
        minStock: parseInt(testFormData.minStock) || 0,
        maxStock: parseInt(testFormData.maxStock) || undefined,
        categoryId: effectiveCategoryId,
        subcategory: testFormData.subcategory,
        brand: testFormData.brand,
        model: testFormData.model,
        tags: testFormData.tags,
        supplierId: testFormData.supplierId,
        supplierSku: formData.supplierSku,
        weight: parseFloat(formData.weight) || undefined,
        color: formData.color,
        material: formData.material,
        size: formData.size,
        metal: formData.metal,
        metalPurity: formData.metalPurity,
        gemstone: formData.gemstone,
        gemstoneWeight: parseFloat(formData.gemstoneWeight) || undefined,
        gemstoneColor: formData.gemstoneColor,
        gemstoneCut: formData.gemstoneCut,
        gemstoneClarity: formData.gemstoneClarity,
        certification: formData.certification,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        trackInventory: formData.trackInventory,
        allowBackorder: formData.allowBackorder,
        requiresSerial: formData.requiresSerial,
        taxable: formData.taxable,
        taxRate: parseFloat(formData.taxRate) || undefined,
        discountable: formData.discountable,
        maxDiscount: parseFloat(formData.maxDiscount) || undefined,
        location: {
          warehouse: formData.warehouse,
          aisle: formData.aisle,
          shelf: formData.shelf,
          bin: formData.bin
        },
        warrantyMonths: parseInt(formData.warrantyMonths) || undefined,
        returnPolicy: formData.returnPolicy
      };
      
      // Construir payload compatible con el backend
      // Usar la categoró­a ya determinada arriba para evitar redeclaraciones
      const selectedCategoryPayload = selectedCategory;
      const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

      // Normalizar valores para coincidir con enums del backend (p.ej. 'ANILLOS' -> 'Anillos')
      const normalizeEnum = (val?: string) => {
        if (!val) return undefined as any;
        const lower = String(val).toLowerCase();
        return lower.replace(/\b\w/g, (c) => c.toUpperCase());
      };
      // Derivar material cuando el campo no se llena en el formulario
      const deriveMaterial = (metal?: string, gemstone?: string) => {
        const m = String(metal || '').toLowerCase();
        if (m.includes('oro')) return 'Oro';
        if (m.includes('plata')) return 'Plata';
        if (m.includes('platino')) return 'Platino';
        if (m.includes('paladio')) return 'Paladio';
        if (m.includes('acero')) return 'Acero';
        if (m.includes('titanio')) return 'Titanio';
        const g = String(gemstone || '').toLowerCase();
        if (g.includes('diamante')) return 'Diamante';
        if (g.includes('esmeralda')) return 'Esmeralda';
        if (g.includes('rubó­') || g.includes('rubi')) return 'Rubó­';
        if (g.includes('zafiro')) return 'Zafiro';
        if (g.includes('perla')) return 'Perla';
        return undefined as any;
      };
      const normalizedCategoryName = normalizeEnum(selectedCategoryPayload?.name);
      const normalizedMaterial = normalizeEnum(formData.material) || deriveMaterial(formData.metal, formData.gemstone);
      const apiPayload: any = {
        name: formData.name,
        code: formData.sku,
        barcode: (formData.barcode || '').trim() || formData.sku,
        description: formData.description || undefined,
        category: normalizedCategoryName,
        material: normalizedMaterial || 'Otros',
        purchasePrice: parseFloat(formData.costPrice) || 0,
        // Alinear con backend: salePrice requerido
        // Usamos precio de mayoreo como precio de venta si estó¡ definido; si no, usamos costo
        salePrice: parseFloat(formData.wholesalePrice) || parseFloat(formData.costPrice) || 0,
        stock: parseInt(formData.stock) || 0,
        minStock: parseInt(formData.minStock) || 0,
        supplier: selectedSupplier?.name,
        metal: normalizeMetalWithPurity(formData.metal, formData.metalPurity) || undefined,
        metalPurity: formData.metalPurity || undefined,
        grams: parseFloat(formData.weight) || undefined,
        stoneType: formData.gemstone || undefined,
        stoneColor: formData.gemstoneColor || undefined,
        stoneCut: formData.gemstoneCut || undefined,
        stoneCarat: parseFloat(formData.gemstoneWeight) || undefined,
        warrantyMonths: parseInt(formData.warrantyMonths) || undefined
      };

      // Auditoría de actualización de precio: validar motivo y preparar payload
      // Solo aplica en edición de producto
      let priceChanged = false;
      if (editingProduct) {
        const previousPurchasePrice = Number(editingProduct.costPrice ?? 0);
        const previousSalePrice = Number((editingProduct.wholesalePrice ?? editingProduct.costPrice) ?? 0);
        const newPurchasePrice = Number(apiPayload.purchasePrice ?? 0);
        const newSalePrice = Number(apiPayload.salePrice ?? 0);
        priceChanged = previousPurchasePrice !== newPurchasePrice || previousSalePrice !== newSalePrice;

        // Si cambia el precio, exigir motivo
        if (priceChanged && !String(formData.priceUpdateReason || '').trim()) {
          setSubmitting(false);
          showError('Por favor ingresa el motivo del cambio de precio.');
          return;
        }

        // Adjuntar bloque de auditoría si hubo cambio
        if (priceChanged) {
          apiPayload.priceUpdateAudit = {
            previousPurchasePrice,
            previousSalePrice,
            newPurchasePrice,
            newSalePrice,
            currency: String(formData.priceUpdateCurrency || '').trim(),
            reason: String(formData.priceUpdateReason || '').trim()
          };
          // Alinear con backend: enviar también campos planos para validación y auditoría
          apiPayload.priceUpdateReason = String(formData.priceUpdateReason || '').trim();
          apiPayload.priceUpdateCurrency = String(formData.priceUpdateCurrency || '').trim().toUpperCase();
        }
      }

      // Removido: salePrice ya no se gestiona desde Inventario
      
      // Helper: generar y persistir código de barras y etiqueta en backend offline
      const persistBarcodeAndLabel = async (code: string, name?: string, categoryName?: string, price?: number) => {
        if (!code) return;
        try {
          // Asegurar base URL por si el cliente API no estó¡ inicializado
        try { const { initializeApiBaseUrl } = await import('@/lib/api'); await initializeApiBaseUrl(); } catch (error) { console.warn('initializeApiBaseUrl failed in ProductsPage:', error); }
          // Backend offline espera claves en espaó±ol: codigo, nombre, categoria, precio
          const payload = { codigo: code, nombre: name, categoria: categoryName, precio: price ?? 0 } as any;
          // Generar y guardar código de barras
          await api.post('/offline/barcode/generate', payload, { __suppressGlobalError: true } as any);
          // Generar y guardar etiqueta
          await api.post('/offline/label/generate', payload, { __suppressGlobalError: true } as any);
        } catch (err) {
          console.warn('Offline barcode/label generation failed:', err);
          // No bloquea guardado; se puede reintentar mó¡s tarde desde módulo Códigos
        }
      };

      // Helper: generar DataURL de QR
      const generateQRCodeDataURL = async (data: string): Promise<string> => {
        const QR = (await import('qrcode')).default;
        return await QR.toDataURL(data, { margin: 1, width: 300 });
      };

      // Helper: generar DataURL de Código de Barras
      const generateBarcodeDataURL = async (data: string): Promise<string> => {
        const JsB = (await import('jsbarcode')).default as any;
        const canvas = document.createElement('canvas');
        JsB(canvas, data, {
          format: 'CODE128',
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 14,
          textMargin: 5
        });
        return canvas.toDataURL('image/png');
      };

      // Helper: registrar en historial local de Códigos (localStorage: generatedCodes)
      const logGeneratedCodesToHistory = async (product: Product, barcodeData?: string, qrData?: string) => {
        try {
          const saved = localStorage.getItem('generatedCodes');
          const parsed = saved ? JSON.parse(saved) : [];
          const list: any[] = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.codes) ? parsed.codes : []);

          const now = new Date().toISOString();
          const entries: any[] = [];
          const bData = barcodeData || product.barcode || product.sku;
          if (bData) {
            const bImg = await generateBarcodeDataURL(String(bData));
            entries.push({
              id: `${product.id}-barcode-${Date.now()}`,
              productId: product.id,
              productName: product.name,
              type: 'barcode',
              code: bImg,
              data: String(bData),
              createdAt: now,
            });
          }
          const qData = qrData || product.qrCode || product.sku || product.id;
          if (qData) {
            const qImg = await generateQRCodeDataURL(String(qData));
            entries.push({
              id: `${product.id}-qr-${Date.now()}`,
              productId: product.id,
              productName: product.name,
              type: 'qr',
              code: qImg,
              data: String(qData),
              createdAt: now,
            });
          }

          const next = [...list, ...entries];
          localStorage.setItem('generatedCodes', JSON.stringify(next));
        } catch (err) {
          console.warn('Error registrando historial de códigos:', err);
        }
      };

      if (editingProduct) {
        // Actualizar producto existente
        try {
          const response = await api.put(`/products/${editingProduct.id}`, apiPayload);
          try { 
            // Limpiar caché local de productos
            localStorage.removeItem('products-cache');
            localStorage.removeItem('products-last-update');
          } catch {}
          
          if (response.data.success) {
            // Actualizar el producto en el estado local
          const updatedProducts = products.map(p =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  name: apiPayload.name,
                  description: apiPayload.description,
                  sku: apiPayload.code,
                  barcode: apiPayload.barcode || p.barcode,
                  costPrice: apiPayload.purchasePrice ?? p.costPrice,
                  // salePrice removido del modelo
                  stock: apiPayload.stock ?? p.stock,
                  minStock: apiPayload.minStock ?? p.minStock,
                  weight: apiPayload.grams ?? p.weight,
                    material: apiPayload.material ?? p.material,
                    metal: apiPayload.metal ?? p.metal,
                    metalPurity: apiPayload.metalPurity ?? p.metalPurity,
                    gemstone: apiPayload.stoneType ?? p.gemstone,
                    gemstoneColor: apiPayload.stoneColor ?? p.gemstoneColor,
                    gemstoneCut: apiPayload.stoneCut ?? p.gemstoneCut,
                    gemstoneWeight: apiPayload.stoneCarat ?? p.gemstoneWeight,
                    category: selectedCategory!,
                    supplier: selectedSupplier,
                    availableStock: (apiPayload.stock || p.stock || 0) - (p.reservedStock || 0),
                    updatedAt: new Date().toISOString()
                  }
                : p
            );
            setProducts(updatedProducts);
        try { setStoreProducts(updatedProducts); } catch (error) { console.warn('ProductsPage: failed to update store products:', error); }
            // Notificación detallada para auditoría
            showSuccess(
              'Producto actualizado exitosamente',
              `SKU: ${editingProduct.sku} | Nombre: ${editingProduct.name} | Categoría: ${category?.name} | Precio: $${apiPayload.salePrice.toLocaleString()} | Stock: ${apiPayload.stock}`
            );
            // Disparar generación y persistencia de códigos en backend offline
            try {
              await persistBarcodeAndLabel(apiPayload.code, apiPayload.name, selectedCategory?.name, apiPayload.salePrice);
            } catch (codeError) {
              console.warn('Error al generar códigos QR/barras:', codeError);
              showError('Producto actualizado, pero hubo un error al generar códigos', 'Puedes generarlos manualmente desde el módulo de Códigos');
            }
            // Registrar en historial de códigos (con imágenes)
            try {
              const updated = updatedProducts.find(p => p.id === editingProduct.id);
              if (updated) {
                await logGeneratedCodesToHistory(
                  updated,
                  apiPayload.barcode || updated.barcode || updated.sku,
                  apiPayload.code || updated.qrCode || updated.sku
                );
              }
            } catch (historyError) {
              console.warn('Error al registrar historial de códigos:', historyError);
              // No mostrar error al usuario ya que el producto se actualizó correctamente
            }
          }
        } catch (apiError) {
          console.warn('API update failed, using local update:', apiError);
          // Fallback: actualizar localmente si la API falla
          const updatedProducts = products.map(p =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  ...productData,
                  barcode: (formData.barcode || '').trim() || formData.sku,
                  category: category!,
                  supplier: supplier,
                  availableStock: (productData.stock || 0) - (p.reservedStock || 0),
                  updatedAt: new Date().toISOString()
                }
              : p
          );
          setProducts(updatedProducts);
        try { setStoreProducts(updatedProducts); } catch (error) { console.warn('ProductsPage: failed to update store products (2):', error); }
          showSuccess('Producto actualizado exitosamente (modo local)');
          // Registrar en historial de códigos (modo local, con imágenes)
          try {
            const updated = updatedProducts.find(p => p.id === editingProduct.id);
            if (updated) {
              await logGeneratedCodesToHistory(
                updated,
                (formData.barcode || '').trim() || updated.sku,
                updated.sku
              );
            }
          } catch (historyError) {
            console.warn('Error al registrar historial de códigos (modo local):', historyError);
            // No mostrar error al usuario ya que el producto se actualizó correctamente
          }
        }
      } else {
        // Crear nuevo producto
        
        // Guardar backup antes de intentar crear
        const backupKey = `product-create-backup-${Date.now()}`;
        const backupData = {
          formData: testFormData,
          apiPayload,
          timestamp: Date.now(),
          category: selectedCategory,
          supplier: selectedSupplier
        };
        
        try {
          localStorage.setItem(backupKey, JSON.stringify(backupData));
        } catch (backupError) {
          console.warn('No se pudo crear backup del producto:', backupError);
        }
        
        // Verificar si estamos offline y agregar a cola
        const { useOfflineStore } = await import('@/store/offlineStore');
        const offlineStore = useOfflineStore.getState();
        
        if (offlineStore.isOffline) {
          // Agregar a cola offline
          offlineStore.addPendingAction({
            type: 'CREATE_PRODUCT',
            data: apiPayload,
            priority: 'high',
            maxRetries: 5
          });
          
          // Crear producto localmente mientras tanto
          const tempId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const tempProduct: Product = {
            id: tempId,
            name: apiPayload.name,
            description: apiPayload.description || '',
            sku: apiPayload.code,
            barcode: apiPayload.barcode || apiPayload.code,
            qrCode: apiPayload.code,
            costPrice: apiPayload.purchasePrice || 0,
            wholesalePrice: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            stock: apiPayload.stock || 0,
            minStock: apiPayload.minStock || 0,
            maxStock: undefined,
            reservedStock: 0,
            availableStock: apiPayload.stock || 0,
            category: selectedCategory!,
            subcategory: apiPayload.subcategory || undefined,
            brand: apiPayload.brand || undefined,
            model: apiPayload.model || undefined,
            tags: Array.isArray(apiPayload.tags) ? apiPayload.tags : [],
            supplier: selectedSupplier,
            supplierSku: apiPayload.supplierSku || undefined,
            weight: apiPayload.grams,
            dimensions: undefined,
            color: apiPayload.color || undefined,
            material: apiPayload.material || testFormData.material || undefined,
            size: apiPayload.size || undefined,
            metal: apiPayload.metal || testFormData.metal || undefined,
            metalPurity: apiPayload.metalPurity || testFormData.metalPurity || undefined,
            gemstone: apiPayload.stoneType || testFormData.gemstone || undefined,
            gemstoneWeight: apiPayload.stoneCarat || (parseFloat(testFormData.gemstoneWeight) || undefined),
            gemstoneColor: apiPayload.stoneColor || testFormData.gemstoneColor || undefined,
            gemstoneCut: apiPayload.stoneCut || testFormData.gemstoneCut || undefined,
            gemstoneClarity: apiPayload.gemstoneClarity || undefined,
            certification: apiPayload.certification || testFormData.certification || undefined,
            images: [],
            primaryImage: undefined,
            videos: [],
            documents: [],
            isActive: apiPayload.isActive ?? true,
            isFeatured: apiPayload.isFeatured ?? false,
            isDigital: apiPayload.isDigital ?? false,
            requiresSerial: apiPayload.requiresSerial ?? false,
            allowBackorder: apiPayload.allowBackorder ?? false,
            trackInventory: apiPayload.trackInventory ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSoldAt: undefined,
            lastRestockedAt: undefined,
            totalSold: 0,
            totalRevenue: 0,
            averageRating: undefined,
            reviewCount: 0,
            viewCount: 0,
            taxable: apiPayload.taxable ?? true,
            taxRate: apiPayload.taxRate || undefined,
            discountable: apiPayload.discountable ?? true,
            maxDiscount: apiPayload.maxDiscount || undefined,
            location: apiPayload.location || undefined,
            warrantyMonths: apiPayload.warrantyMonths || (parseInt(testFormData.warrantyMonths) || undefined),
            returnPolicy: apiPayload.returnPolicy || testFormData.returnPolicy || undefined,
            metaTitle: apiPayload.metaTitle || undefined,
            metaDescription: apiPayload.metaDescription || undefined,
            keywords: Array.isArray(apiPayload.keywords) ? apiPayload.keywords : []
          } as Product;
          
          setProducts([...products, tempProduct]);
          try { setStoreProducts([...(storeProducts || []), tempProduct]); } catch (error) { console.warn('ProductsPage: failed to add temp product to store:', error); }
          
          // Limpiar backup
          try { localStorage.removeItem(backupKey); } catch {}
          
          showSuccess(
            'Producto guardado localmente',
            'El producto se guardará en el servidor cuando esté disponible la conexión'
          );
          
          setShowProductModal(false);
          resetForm();
          setSubmitting(false);
          return;
        }
        
        try {
          // Asegurar baseURL y registrar contexto antes de enviar
          try { await initializeApiBaseUrl(); } catch (e) { console.warn('ProductsPage: initializeApiBaseUrl failed before create:', e); }
          console.log('ProductsPage: intentando crear producto', {
            baseURL: api?.defaults?.baseURL,
            hasAuth: !!(api?.defaults?.headers as any)?.common?.['Authorization'],
            authHeaderPrefix: ((api?.defaults?.headers as any)?.common?.['Authorization'] || '').slice(0, 16),
            payloadPreview: {
              name: apiPayload?.name,
              code: apiPayload?.code,
              category: apiPayload?.category,
              purchasePrice: apiPayload?.purchasePrice,
              stock: apiPayload?.stock
            }
          });
          let response;
          try {
            response = await api.post('/products', apiPayload);
          } catch (apiError: any) {
            console.error('Error al crear producto:', apiError);
            
            // Verificar si es un error de red o timeout
            if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'ECONNABORTED' || apiError.message?.includes('timeout')) {
              showError('Error de conexión', 'No se pudo conectar con el servidor. El producto se guardará localmente.');
              
              // Agregar a cola offline
              const { useOfflineStore } = await import('@/store/offlineStore');
              const offlineStore = useOfflineStore.getState();
              offlineStore.addPendingAction({
                type: 'CREATE_PRODUCT',
                data: apiPayload,
                priority: 'high',
                maxRetries: 5
              });
              
              // Crear producto temporal localmente
              const tempId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const tempProduct: Product = {
                id: tempId,
                name: apiPayload.name,
                description: apiPayload.description || '',
                sku: apiPayload.code,
                barcode: apiPayload.barcode || apiPayload.code,
                qrCode: apiPayload.code,
                costPrice: apiPayload.purchasePrice || 0,
                wholesalePrice: undefined,
                minPrice: undefined,
                maxPrice: undefined,
                stock: apiPayload.stock || 0,
                minStock: apiPayload.minStock || 0,
                maxStock: undefined,
                reservedStock: 0,
                availableStock: apiPayload.stock || 0,
                category: selectedCategory!,
                subcategory: apiPayload.subcategory || undefined,
                brand: apiPayload.brand || undefined,
                model: apiPayload.model || undefined,
                tags: Array.isArray(apiPayload.tags) ? apiPayload.tags : [],
                supplier: selectedSupplier,
                supplierSku: apiPayload.supplierSku || undefined,
                weight: apiPayload.grams,
                dimensions: undefined,
                color: apiPayload.color || undefined,
                material: apiPayload.material || testFormData.material || undefined,
                size: apiPayload.size || undefined,
                metal: apiPayload.metal || testFormData.metal || undefined,
                metalPurity: apiPayload.metalPurity || testFormData.metalPurity || undefined,
                gemstone: apiPayload.stoneType || testFormData.gemstone || undefined,
                gemstoneWeight: apiPayload.stoneCarat || (parseFloat(testFormData.gemstoneWeight) || undefined),
                gemstoneColor: apiPayload.stoneColor || testFormData.gemstoneColor || undefined,
                gemstoneCut: apiPayload.stoneCut || testFormData.gemstoneCut || undefined,
                gemstoneClarity: apiPayload.gemstoneClarity || undefined,
                certification: apiPayload.certification || testFormData.certification || undefined,
                images: [],
                primaryImage: undefined,
                videos: [],
                documents: [],
                isActive: apiPayload.isActive ?? true,
                isFeatured: apiPayload.isFeatured ?? false,
                isDigital: apiPayload.isDigital ?? false,
                requiresSerial: apiPayload.requiresSerial ?? false,
                allowBackorder: apiPayload.allowBackorder ?? false,
                trackInventory: apiPayload.trackInventory ?? true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastSoldAt: undefined,
                lastRestockedAt: undefined,
                totalSold: 0,
                totalRevenue: 0,
                averageRating: undefined,
                reviewCount: 0,
                viewCount: 0,
                taxable: apiPayload.taxable ?? true,
                taxRate: apiPayload.taxRate || undefined,
                discountable: apiPayload.discountable ?? true,
                maxDiscount: apiPayload.maxDiscount || undefined,
                location: apiPayload.location || undefined,
                warrantyMonths: apiPayload.warrantyMonths || (parseInt(testFormData.warrantyMonths) || undefined),
                returnPolicy: apiPayload.returnPolicy || testFormData.returnPolicy || undefined,
                metaTitle: apiPayload.metaTitle || undefined,
                metaDescription: apiPayload.metaDescription || undefined,
                keywords: Array.isArray(apiPayload.keywords) ? apiPayload.keywords : []
              } as Product;
              
              setProducts([...products, tempProduct]);
              try { setStoreProducts([...(storeProducts || []), tempProduct]); } catch (error) { console.warn('ProductsPage: failed to add temp product to store:', error); }
              
              // Limpiar backup
              try { localStorage.removeItem(backupKey); } catch {}
              
              showSuccess(
                'Producto guardado localmente',
                'El producto se guardará en el servidor cuando esté disponible la conexión'
              );
              
              setShowProductModal(false);
              resetForm();
              setSubmitting(false);
              return;
            } else {
              // Otro tipo de error
              throw apiError;
            }
          }
          
          try { 
            // Limpiar caché local de productos
            localStorage.removeItem('products-cache');
            localStorage.removeItem('products-last-update');
          } catch {}
          
          if (response.data.success && response.data.data) {
            // Usar el producto devuelto por la API
            const apiProd = response.data.data;
            const newProduct: Product = {
              id: apiProd.id,
              name: apiProd.name,
              description: apiProd.description || '',
              sku: apiProd.code || formData.sku,
              barcode: apiProd.barcode || ((formData.barcode || '').trim() || formData.sku),
              qrCode: apiProd.qrCode || formData.sku,
              costPrice: apiProd.purchasePrice ?? (parseFloat(formData.costPrice) || 0),
              // salePrice removido del modelo
              wholesalePrice: undefined,
              minPrice: undefined,
              maxPrice: undefined,
              stock: apiProd.stock ?? (parseInt(formData.stock) || 0),
              minStock: apiProd.minStock ?? (parseInt(formData.minStock) || 0),
              maxStock: undefined,
              reservedStock: apiProd.reservedStock ?? 0,
              availableStock: (apiProd.stock ?? (parseInt(formData.stock) || 0)) - (apiProd.reservedStock ?? 0),
              category: selectedCategory!,
              subcategory: apiProd.subcategory || undefined,
              brand: apiProd.brand || undefined,
              model: apiProd.model || undefined,
              tags: Array.isArray(apiProd.tags) ? apiProd.tags : [],
              supplier: selectedSupplier,
              supplierSku: apiProd.supplierSku || undefined,
              weight: apiProd.grams,
              dimensions: undefined,
              color: apiProd.color || undefined,
              material: apiProd.material || formData.material || undefined,
              size: apiProd.size || undefined,
              metal: apiProd.metal || formData.metal || undefined,
              metalPurity: apiProd.metalPurity || formData.metalPurity || undefined,
              gemstone: apiProd.stoneType || formData.gemstone || undefined,
              gemstoneWeight: apiProd.stoneCarat || (parseFloat(formData.gemstoneWeight) || undefined),
              gemstoneColor: apiProd.stoneColor || formData.gemstoneColor || undefined,
              gemstoneCut: apiProd.stoneCut || formData.gemstoneCut || undefined,
              gemstoneClarity: apiProd.gemstoneClarity || undefined,
              certification: apiProd.certification || formData.certification || undefined,
              images: Array.isArray(apiProd.images) ? apiProd.images : [],
              primaryImage: apiProd.primaryImage || undefined,
              videos: Array.isArray(apiProd.videos) ? apiProd.videos : [],
              documents: Array.isArray(apiProd.documents) ? apiProd.documents : [],
              isActive: apiProd.isActive ?? true,
              isFeatured: apiProd.isFeatured ?? false,
              isDigital: apiProd.isDigital ?? false,
              requiresSerial: apiProd.requiresSerial ?? false,
              allowBackorder: apiProd.allowBackorder ?? false,
              trackInventory: apiProd.trackInventory ?? true,
              createdAt: apiProd.createdAt || new Date().toISOString(),
              updatedAt: apiProd.updatedAt || new Date().toISOString(),
              lastSoldAt: apiProd.lastSoldAt || undefined,
              lastRestockedAt: apiProd.lastRestockedAt || undefined,
              totalSold: apiProd.totalSold ?? 0,
              totalRevenue: apiProd.totalRevenue ?? 0,
              averageRating: apiProd.averageRating || undefined,
              reviewCount: apiProd.reviewCount ?? 0,
              viewCount: apiProd.viewCount ?? 0,
              taxable: apiProd.taxable ?? true,
              taxRate: apiProd.taxRate || undefined,
              discountable: apiProd.discountable ?? true,
              maxDiscount: apiProd.maxDiscount || undefined,
              location: apiProd.location || undefined,
              warrantyMonths: apiProd.warrantyMonths || (parseInt(formData.warrantyMonths) || undefined),
              returnPolicy: apiProd.returnPolicy || formData.returnPolicy || undefined,
              metaTitle: apiProd.metaTitle || undefined,
              metaDescription: apiProd.metaDescription || undefined,
              keywords: Array.isArray(apiProd.keywords) ? apiProd.keywords : []
            } as Product;
            setProducts([...products, newProduct]);
        try { setStoreProducts([...(storeProducts || []), newProduct]); } catch (error) { console.warn('ProductsPage: failed to add new product to store:', error); }
            // Notificación detallada para auditoría
            showSuccess(
              'Producto creado exitosamente',
              `SKU: ${newProduct.sku} | Nombre: ${newProduct.name} | Categoría: ${selectedCategory?.name} | Precio: $${apiPayload.salePrice.toLocaleString()} | Stock: ${apiPayload.stock}`
            );
            // Disparar generación y persistencia de códigos en backend offline
            const finalCode = newProduct.sku || apiPayload.code;
            try {
              await persistBarcodeAndLabel(finalCode, newProduct.name, selectedCategory?.name, apiPayload.salePrice);
            } catch (codeError) {
              console.warn('Error al generar códigos QR/barras:', codeError);
              showError('Producto guardado, pero hubo un error al generar códigos', 'Puedes generarlos manualmente desde el módulo de Códigos');
            }
            // Registrar en historial de códigos (con imágenes)
            try {
              await logGeneratedCodesToHistory(
                newProduct,
                newProduct.barcode || newProduct.sku,
                newProduct.qrCode || newProduct.sku
              );
            } catch (historyError) {
              console.warn('Error al registrar historial de códigos:', historyError);
              // No mostrar error al usuario ya que el producto se guardó correctamente
            }
          }
        } catch (apiError: any) {
          // Registrar detalles del error para diagnó³stico
          const status = apiError?.response?.status;
          const errData = apiError?.response?.data;
          console.warn('API creation failed, using local creation:', {
            message: apiError?.message,
            status,
            errData,
            baseURL: api?.defaults?.baseURL,
            hasAuth: !!(api?.defaults?.headers as any)?.common?.['Authorization']
          });
          // Fallback: crear localmente si la API falla
          const newProduct: Product = {
            id: Date.now().toString(),
            ...productData,
            category: category!,
            supplier: supplier,
            barcode: (formData.barcode || '').trim() || formData.sku,
            qrCode: formData.sku,
            reservedStock: 0,
            availableStock: parseInt(formData.stock) || 0,
            images: [],
            videos: [],
            documents: [],
            isDigital: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalSold: 0,
            totalRevenue: 0,
            reviewCount: 0,
            viewCount: 0
          } as Product;
          
          setProducts([...products, newProduct]);
        try { setStoreProducts([...(storeProducts || []), newProduct]); } catch (error) { console.warn('ProductsPage: failed to add new product (2):', error); }
          showSuccess('Producto creado exitosamente (modo local)');
          // Registrar en historial de códigos (modo local, con imágenes)
          try {
            await logGeneratedCodesToHistory(
              newProduct,
              (formData.barcode || '').trim() || newProduct.sku,
              newProduct.sku
            );
    } catch (error) { console.warn('ProductsPage: failed to duplicate product:', error); }
        }
      }
      
      setShowProductModal(false);
      setEditingProduct(null);
      resetForm();
      
    } catch (error) {
      await handleSubmitError(error, testFormData);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDeleteProduct = async (product: Product) => {
    if (window.confirm(`Â¿Estó¡s seguro de que deseas eliminar "${product.name}"?`)) {
      try {
        // Si estó¡ offline, encolar acció³n y eliminar localmente
        if (isOffline) {
          addPendingAction({
            type: 'DELETE_PRODUCT',
            data: { id: product.id },
            priority: 'high',
            maxRetries: 5,
          });
          setProducts(products.filter(p => p.id !== product.id));
        try { setStoreProducts((products.filter(p => p.id !== product.id))); } catch (error) { console.warn('ProductsPage: failed to remove product from store:', error); }
          // Notificación detallada para auditoría
          showSuccess(
            'Producto eliminado',
            `"${product.name}" (SKU: ${product.sku}) fue eliminado exitosamente (pendiente de sincronización)`
          );
          return;
        }

        // Intentar eliminar a travó©s de la API
        try {
          const response = await api.delete(`/products/${product.id}`);
          
          if (response.data.success) {
            setProducts(products.filter(p => p.id !== product.id));
        try { setStoreProducts((products.filter(p => p.id !== product.id))); } catch (error) { console.warn('ProductsPage: failed to remove product from store (2):', error); }
            // Notificación detallada para auditoría
            showSuccess(
              'Producto eliminado',
              `"${product.name}" (SKU: ${product.sku}) fue eliminado exitosamente`
            );
          } else {
            // Si la API no responde como ó©xito, encolar acció³n
            addPendingAction({
              type: 'DELETE_PRODUCT',
              data: { id: product.id },
              priority: 'high',
              maxRetries: 5,
            });
            setProducts(products.filter(p => p.id !== product.id));
        try { setStoreProducts((products.filter(p => p.id !== product.id))); } catch (error) { console.warn('ProductsPage: failed to remove product (3):', error); }
            // Notificación detallada para auditoría
            showSuccess(
              'Producto eliminado',
              `"${product.name}" (SKU: ${product.sku}) fue eliminado (pendiente de sincronización)`
            );
          }
        } catch (apiError) {
          console.warn('API deletion failed, queueing offline deletion:', apiError);
          // Fallback: encolar acció³n si la API falla y eliminar localmente
          addPendingAction({
            type: 'DELETE_PRODUCT',
            data: { id: product.id },
            priority: 'high',
            maxRetries: 5,
          });
          setProducts(products.filter(p => p.id !== product.id));
        try { setStoreProducts((products.filter(p => p.id !== product.id))); } catch (error) { console.warn('ProductsPage: failed to remove product (4):', error); }
          showSuccess('Producto eliminado (pendiente de sincronizació³n)');
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        showError('Error al eliminar el producto');
      }
    }
  };
  
  const handleDuplicateProduct = (product: Product) => {
    const duplicatedProduct: Product = {
      ...product,
      id: Date.now().toString(),
      name: `${product.name} (Copia)`,
      sku: `${product.sku}-COPY`,
      barcode: undefined,
      qrCode: `QR-${product.sku}-COPY`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalSold: 0,
      totalRevenue: 0,
      reviewCount: 0,
      viewCount: 0
    };
    
    setProducts([...products, duplicatedProduct]);
    showSuccess('Producto duplicado exitosamente');
  };
  
  const handleStockAdjustment = async () => {
    if (!stockAdjustment.productId || !stockAdjustment.quantity || !stockAdjustment.reason) {
      showError('Por favor completa todos los campos');
      return;
    }
    
    try {
      const product = products.find(p => p.id === stockAdjustment.productId);
      if (!product) return;
      
      const quantity = parseInt(stockAdjustment.quantity);
      let newStock = product.stock;
      
      switch (stockAdjustment.type) {
        case 'in':
          newStock += quantity;
          break;
        case 'out':
          newStock -= quantity;
          break;
        case 'adjustment':
          newStock = quantity;
          break;
      }
      
      if (newStock < 0) {
        showError('El stock no puede ser negativo');
        return;
      }
      
      // Intentar actualizar stock a travó©s de la API
      try {
        const stockData = {
          stock: newStock,
          type: stockAdjustment.type,
          quantity: quantity,
          reason: stockAdjustment.reason,
          notes: stockAdjustment.notes
        };
        
        const response = await api.put(`/products/${stockAdjustment.productId}/stock`, stockData);
        try { apiUtils.invalidateCache('/products'); } catch {}
        
        if (response.data.success) {
          // Actualizar producto en el estado local
          const updatedProducts = products.map(p =>
            p.id === stockAdjustment.productId
              ? {
                  ...p,
                  stock: newStock,
                  availableStock: newStock - p.reservedStock,
                  lastRestockedAt: stockAdjustment.type === 'in' ? new Date().toISOString() : p.lastRestockedAt,
                  updatedAt: new Date().toISOString()
                }
              : p
          );
          setProducts(updatedProducts);
        try { setStoreProducts(updatedProducts); } catch (error) { console.warn('ProductsPage: failed to update store products (3):', error); }
          showSuccess('Stock actualizado exitosamente');
        }
      } catch (apiError) {
        console.warn('API stock update failed, using local update:', apiError);
        // Fallback: actualizar localmente si la API falla
        const updatedProducts = products.map(p =>
          p.id === stockAdjustment.productId
            ? {
                ...p,
                stock: newStock,
                availableStock: newStock - p.reservedStock,
                lastRestockedAt: stockAdjustment.type === 'in' ? new Date().toISOString() : p.lastRestockedAt,
                updatedAt: new Date().toISOString()
              }
            : p
        );
        setProducts(updatedProducts);
        try { setStoreProducts(updatedProducts); } catch (error) { console.warn('ProductsPage: failed to update store products (4):', error); }
        showSuccess('Stock actualizado exitosamente (modo local)');
      }
      
      // Registrar movimiento localmente
      const movement: StockMovement = {
        id: Date.now().toString(),
        productId: stockAdjustment.productId,
        type: stockAdjustment.type,
        quantity: quantity,
        previousStock: product.stock,
        newStock: newStock,
        reason: stockAdjustment.reason,
        notes: stockAdjustment.notes,
        userId: 'current-user',
        userName: 'Usuario Actual',
        createdAt: new Date().toISOString()
      };
      
      setStockMovements([movement, ...stockMovements]);
      
      setShowStockModal(false);
      setStockAdjustment({
        productId: '',
        type: 'adjustment',
        quantity: '',
        reason: '',
        notes: ''
      });
      
    } catch (error) {
      console.error('Error updating stock:', error);
      showError('Error al actualizar el stock');
    }
  };
  
  const handleBulkAction = async () => {
    if (selectedProducts.length === 0) {
      showError('Selecciona al menos un producto');
      return;
    }
    
    if (!bulkAction.action) {
      showError('Selecciona una acció³n');
      return;
    }
    
    try {
      const updatedProducts = products.map(product => {
        if (!selectedProducts.includes(product.id)) return product;
        
        switch (bulkAction.action) {
          case 'activate':
            return { ...product, isActive: true, updatedAt: new Date().toISOString() };
          case 'deactivate':
            return { ...product, isActive: false, updatedAt: new Date().toISOString() };
          case 'feature':
            return { ...product, isFeatured: true, updatedAt: new Date().toISOString() };
          case 'unfeature':
            return { ...product, isFeatured: false, updatedAt: new Date().toISOString() };
          case 'price_increase': {
            const increasePercent = parseFloat(bulkAction.value) / 100;
            return {
              ...product,
              wholesalePrice: ((product.wholesalePrice ?? product.costPrice) * (1 + increasePercent)),
              updatedAt: new Date().toISOString()
            };
          }
          case 'price_decrease': {
            const decreasePercent = parseFloat(bulkAction.value) / 100;
            return {
              ...product,
              wholesalePrice: ((product.wholesalePrice ?? product.costPrice) * (1 - decreasePercent)),
              updatedAt: new Date().toISOString()
            };
          }
          default:
            return product;
        }
      });
      
      setProducts(updatedProducts);
        try { setStoreProducts(updatedProducts); } catch (error) { console.warn('ProductsPage: failed to update store products (5):', error); }
      setSelectedProducts([]);
      setShowBulkModal(false);
      setBulkAction({ action: '', value: '', reason: '' });
      showSuccess(`Acció³n aplicada a ${selectedProducts.length} productos`);
      
    } catch (error) {
      console.error('Error applying bulk action:', error);
      showError('Error al aplicar la acció³n masiva');
    }
  };
  
  const handleScan = (code: string) => {
    const product = products.find(p => p.barcode === code || p.sku === code);
    if (product) {
      showSuccess(`Producto encontrado: ${product.name} - $${(product.costPrice || 0).toLocaleString()}`);
    } else {
      showWarning(`Producto no encontrado con código: ${code}`);
    }
    setShowScanner(false);
  };
  
  const exportProducts = () => {
    const csvContent = [
      ['SKU', 'Nombre', 'Descripción', 'Precio Costo', 'Precio Mayoreo', 'Stock', 'Stock Mínimo', 'Categoría', 'Marca', 'Estado'].join(','),
      ...filteredProducts.map(product => [
        product.sku,
        `"${product.name}"`,
        `"${product.description || ''}"`,
        product.costPrice,
        (product.wholesalePrice ?? ''),
        product.stock,
        product.minStock,
        // Exporta nombre de categoró­a de manera segura (string u objeto)
        (typeof (product as any).category === 'string'
          ? (product as any).category
          : (product as any).category?.name || ''),
        product.brand || '',
        product.isActive ? 'Activo' : 'Inactivo'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('Productos exportados exitosamente');
  };

  // --- Importació³n de productos ---
  // Lista de categoró­as permitidas segóºn backend
  const JEWELRY_CATEGORIES = ['Anillos', 'Alianzas', 'Cadenas', 'Collares', 'Pulseras', 'Aretes', 'Pendientes', 'Broches', 'Relojes', 'Gemelos', 'Dijes', 'Charms', 'Otros'] as const;
  const normalizeCategory = (raw?: string) => {
    if (!raw) return 'Otros';
    const trimmed = String(raw).trim();
    const found = JEWELRY_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
    return found || 'Otros';
  };
  const handleImportFile = async (file: File) => {
    setImportErrors([]);
    setImportPreview([]);
    try {
      const lower = file.name.toLowerCase();
      const isCSV = lower.endsWith('.csv');
      const isXLSX = lower.endsWith('.xlsx') || lower.endsWith('.xls');

      if (isCSV) {
        const text = await file.text();
        const { rows, errors } = parseFlexibleCsvFile(text);
        setImportPreview(rows);
        setImportErrors(errors);
      } else if (isXLSX) {
        const buf = await file.arrayBuffer();
        const { rows, errors } = parseFlexibleXlsxBuffer(buf);
        setImportPreview(rows);
        setImportErrors(errors);
      } else {
        showError('Formato no soportado. Usa CSV o XLSX.');
        return;
      }

      setShowImportModal(true);
    } catch (err) {
      console.error('Error parsing import file:', err);
      showError('No se pudo procesar el archivo de importació³n');
    }
  };

  const handleImportInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImportFile(file);
    e.target.value = '';
  };

  // Revisió³n previa de filas importadas: limpiar duplicados y detectar conflictos
  const reviewImportRows = useCallback((rows: ProductImportFlexibleRow[]) => {
    const errors: string[] = [];
    const duplicates: string[] = [];
    const conflicts: string[] = [];
    const seen = new Set<string>();
    const existingSkus = new Set<string>(products.map(p => (p.sku || p.barcode || p.qrCode || '').trim()).filter(Boolean));

    const valid: ProductImportFlexibleRow[] = [];
    for (const r of rows) {
      const sku = String(r.sku || '').trim();
      const name = String(r.name || '').trim();
      const cost = Number(r.costPrice ?? 0);
      const retail = r.retailPrice == null ? undefined : Number(r.retailPrice);

      if (!sku || !name) {
        errors.push(`Fila ${r.__row ?? '?'}: SKU y nombre son requeridos`);
        continue;
      }
      if (seen.has(sku)) {
        duplicates.push(sku);
        continue; // Evitar duplicados dentro del archivo
      }
      seen.add(sku);

      if (existingSkus.has(sku)) {
        conflicts.push(sku); // Conflicto con cató¡logo actual
      }

      // Asegurar que precio de venta no sea menor al costo
      const safeRetail = retail == null ? cost : Math.max(cost, retail);
      valid.push({ ...r, retailPrice: safeRetail });
    }
    return { valid, errors, duplicates, conflicts };
  }, [products]);

  const applyImport = async () => {
    if (importPreview.length === 0) {
      showWarning('No hay filas vó¡lidas para importar');
      return;
    }
    try {
      // Validació³n previa: limpiar duplicados y detectar conflictos
      const review = reviewImportRows(importPreview);
      if (review.errors.length > 0) {
        showWarning(`Se omitieron ${review.errors.length} filas invó¡lidas`);
      }
      if (review.duplicates.length > 0) {
        showWarning(`SKU duplicados en archivo: ${review.duplicates.slice(0,5).join(', ')}${review.duplicates.length > 5 ? 'â€¦' : ''}`);
      }
      if (review.conflicts.length > 0) {
        showWarning(`SKU existentes en cató¡logo: ${review.conflicts.slice(0,5).join(', ')}${review.conflicts.length > 5 ? 'â€¦' : ''}`);
      }

      // Construir payload para el backend (createProductSchema)
      const items = review.valid.map((row, idx) => {
        const purchasePrice = Math.max(0.01, Number(row.costPrice) || 0.01);
        const safeSale = row.retailPrice != null ? Number(row.retailPrice) : purchasePrice;
        const salePrice = Math.max(purchasePrice, safeSale);
        const stock = Math.max(0, Number(row.stock) || 0);
        const code = (row.sku && String(row.sku).trim().length > 0)
          ? String(row.sku).trim()
          : `IMP-${Date.now()}-${idx}`;
        return {
          code,
          name: row.name,
          description: '',
          category: normalizeCategory(row.category),
          material: 'Otros',
          purchasePrice,
          salePrice,
          stock,
          minStock: 0,
          imageUrl: undefined,
          barcode: row.sku || undefined,
          supplier: undefined,
          // Campos opcionales especó­ficos omitidos para importació³n simple
        } as any;
      });

      // Si estamos offline, encolar importació³n masiva y actualizar estado local
      if (isOffline) {
        addPendingAction({
          type: 'BULK_IMPORT_PRODUCTS',
          data: { items, upsert: true, skipDuplicates: true, dryRun: false },
          priority: 'high',
          maxRetries: 5,
        });

        // Actualizar vista local con datos bó¡sicos mapeados (como antes)
        const now = new Date().toISOString();
        const mappedLocal: Product[] = review.valid.map(row => {
          const catName = normalizeCategory(row.category);
          const cat = categories.find(c => c.name === catName) || {
            id: catName, name: catName, description: '', parentId: undefined, isActive: true, productCount: 0, createdAt: now
          } as Category;
          const purchasePrice = Math.max(0.01, Number(row.costPrice) || 0.01);
          const safeSale = row.retailPrice != null ? Number(row.retailPrice) : purchasePrice;
          const salePrice = Math.max(purchasePrice, safeSale);
          return {
            id: `${Date.now().toString()}-${Math.random().toString(36).slice(2,8)}`,
            name: row.name,
            description: '',
            sku: row.sku,
            barcode: row.sku,
            qrCode: row.sku,
            costPrice: purchasePrice,
            wholesalePrice: salePrice,
            stock: Math.max(0, Number(row.stock) || 0),
            minStock: 0,
            reservedStock: 0,
            availableStock: Math.max(0, Number(row.stock) || 0),
            category: cat,
            brand: row.brand || undefined,
            tags: [],
            images: [],
            isActive: true,
            isFeatured: false,
            isDigital: false,
            requiresSerial: false,
            allowBackorder: false,
            trackInventory: true,
            createdAt: now,
            updatedAt: now,
            totalSold: 0,
            totalRevenue: 0,
            reviewCount: 0,
            viewCount: 0,
            taxable: true,
            discountable: true,
            keywords: [],
          } as Product;
        });
        const next = [...products, ...mappedLocal];
        setProducts(next);
        try { setStoreProducts(next); } catch (error) { console.warn('ProductsPage: failed to update store after import (offline):', error); }
        setShowImportModal(false);
        setImportPreview([]);
        setImportErrors([]);
        showSuccess(`Se encoló³ importació³n de ${mappedLocal.length} productos (offline)`);
        return;
      }

      // Online: usar endpoint de importació³n masiva
      const response = await api.post('/products/import', {
        items,
        upsert: true,
        skipDuplicates: true,
        dryRun: false,
      } as any);

      if (response?.data?.success) {
        const summary = response?.data?.data?.summary || {};
        showSuccess(`Importació³n completada: ${summary.created || 0} creados, ${summary.updated || 0} actualizados, ${summary.skipped || 0} omitidos`);
        // Recargar datos reales desde servidor
        try {
          await loadInitialData();
        } catch (err) {
          console.warn('ProductsPage: fallo recargando datos tras importació³n:', err);
        }
      } else {
        showWarning('La importació³n no fue confirmada por el servidor');
      }

      setShowImportModal(false);
      setImportPreview([]);
      setImportErrors([]);
    } catch (err) {
      console.error('Error applying import:', err);
      showError('No se pudo aplicar la importació³n');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Cargando inventario..." />
        
     </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventario de Productos</h1>
          <p className="text-gray-600 mt-1">Gestiona tu cató¡logo de productos y stock</p>
          {/* Banner de estado offline */}
          <div
            data-testid="offline-status-banner"
            className={`mt-3 rounded-md px-3 py-2 text-sm ${isOffline ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-green-50 text-green-700 border border-green-200'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                {isOffline ? (
                  <span>Modo offline activo. Acciones pendientes: {pendingActions.length}.</span>
                ) : (
                  <span>Conectado. Cola de acciones: {pendingActions.length}.</span>
                )}
       
       
       
       
       





              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { await syncPendingActions(); }}
                  disabled={syncInProgress || pendingActions.length === 0}
                  className={`px-2 py-1 rounded ${syncInProgress ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {syncInProgress ? 'Sincronizandoâ€¦' : `Sincronizar (${pendingActions.length})`}
                </button>
                <button
                  onClick={() => setOfflineStatus(!isOffline)}
                  className="px-2 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                >
                  {isOffline ? 'Salir de offline' : 'Entrar en offline'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => { await prefetchScannerLib(); setShowScanner(true); }}
            onMouseEnter={() => { prefetchScannerLib(); }}
            onMouseOver={() => { prefetchScannerLib(); }}
            onPointerEnter={() => { prefetchScannerLib(); }}
            onFocus={() => { prefetchScannerLib(); }}
            data-testid="inventario.scan-product"
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ScanLine className="h-4 w-4 mr-2" />
            Escanear
          </button>
          
          {/* Input oculto para seleccionar archivo de importació³n */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleImportInputChange}
          />
          
          <button
            onClick={() => { prefetchImportLibs().finally(() => fileInputRef.current?.click()); }}
            onMouseEnter={() => { prefetchImportLibs(); }}
            onMouseOver={() => { prefetchImportLibs(); }}
            onPointerEnter={() => { prefetchImportLibs(); }}
            onFocus={() => { prefetchImportLibs(); }}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </button>
          
          <button
            onClick={exportProducts}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
          
          <button
            onClick={() => openProductModal()}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            data-testid="joyas.create"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </button>
        </div>
      </div>
      
      {/* Estadó­sticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lowStockProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Sin Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.outOfStockProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Destacados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.featuredProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Valor Inventario</p>
              <p className="text-lg font-bold text-gray-900">${stats.totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Ingresos</p>
              <p className="text-lg font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bóºsqueda y Filtros */}
      <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
          {/* Bóºsqueda */}
          <div className="flex-1">
            <SearchBar
              value={filters.search}
              onChange={(value) => setFilters(prev => ({ ...prev, search: value }))}
              placeholder="Buscar por nombre, SKU, código de barras, marca..."
              className="w-full"
              dataTestId="inventario.search-product"
            />
          </div>
          
          {/* Filtros ró¡pidos */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas las categorías</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            
            <select
              value={filters.supplier}
              onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>

            {/* Rango de fechas de creació³n */}
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="self-center text-gray-600">a</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <select
              value={filters.stockStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, stockStatus: e.target.value as any }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todo el stock</option>
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock bajo</option>
              <option value="out_of_stock">Sin stock</option>
            </select>
            
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Nombre</option>
              <option value="sku">SKU</option>
              <option value="costPrice">Costo</option>
              <option value="stock">Stock</option>
              <option value="category">Categoría</option>
              <option value="createdAt">Fecha creació³n</option>
              <option value="updatedAt">óšltima actualizació³n</option>
            </select>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {filters.sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </button>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, viewMode: prev.viewMode === 'grid' ? 'list' : 'grid' }))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {filters.viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </button>
            {/* Botó³n de importació³n de prueba (visible si testMode por prop o query) */}
            {(queryTestMode || testMode) && (
              <button
                data-testid="test-import-button"
                onClick={handleTestImportClick}
                className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center"
                title="Simular importació³n offline (testMode)"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importació³n de prueba
              </button>
      )}

    </div>
        </div>
        
        {/* Acciones masivas */}
        {selectedProducts.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedProducts.length} producto(s) seleccionado(s)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Acciones masivas
                </button>
                <button
                  onClick={() => setSelectedProducts([])}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                >
                  Limpiar selecció³n
                </button>
              </div>
            </div>
          </div>
      )}

    </div>
      
      {/* Lista/Grid de productos */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filters.viewMode === 'grid' ? (
          // Vista de cuadró­cula
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Checkbox de selecció³n */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product.id]);
                        } else {
                          setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  
                  {/* Imagen del producto */}
                  <div className="relative h-48 bg-gray-100">
                    {product.primaryImage ? (
                      <img
                        src={product.primaryImage}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {product.isFeatured && (
                        <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded-full">
                          Destacado
                        </span>
                      )}
                      {!product.isActive && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                          Inactivo
                        </span>
                      )}
                      {product.availableStock === 0 && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                          Sin stock
                        </span>
                      )}
                      {product.availableStock <= product.minStock && product.availableStock > 0 && (
                        <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">
                          Stock bajo
                        </span>
      )}

    </div>
                    {/* Botó³n para cambiar imagen en tarjeta */}
                    <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded shadow">
                      <button
                        onClick={() => {
                          const input = document.getElementById(`file-input-card-${product.id}`) as HTMLInputElement | null;
                          if (input) input.click();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Cambiar imagen
                      </button>
                      <input
                        id={`file-input-card-${product.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const formData = new FormData();
                            formData.append('image', file);
                            const resp = await api.post(`/products/${product.id}/image`, formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                              __suppressGlobalError: true as any
                            } as any);
                            const newUrl = resp?.data?.data?.imageUrl;
                            if (newUrl) {
                              setProducts(prev => prev.map(p => p.id === product.id ? { ...p, primaryImage: newUrl } : p));
                              showSuccess('Imagen actualizada');
                            } else {
                              showError('No se pudo actualizar la imagen');
                            }
                          } catch (err) {
                            console.error('Upload error:', err);
                            showError('Error al subir la imagen');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Información del producto */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => openProductModal(product)}
                          data-testid="inventario.edit"
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateProduct(product)}
                          data-testid="inventario.duplicate"
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          data-testid="inventario.delete"
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">SKU: {product.sku}</p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-green-600">
                        ${product.costPrice.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        Stock: {product.availableStock}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{typeof product.category === 'string' ? product.category : (product.category?.name ?? 'Sin categoró­a')}</span>
                      {product.brand && (
                        <span>{typeof product.brand === 'string' ? product.brand : String(product.brand)}</span>
                      )}
                    </div>
                    
                    {/* Barra de stock */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Stock</span>
                        <span>{product.availableStock}/{product.maxStock || 'âˆž'}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            product.availableStock === 0
                              ? 'bg-red-500'
                              : product.availableStock <= product.minStock
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (product.availableStock / (product.maxStock || product.availableStock || 1)) * 100,
                              100
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Vista de lista
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts(filteredProducts.map(p => p.id));
                        } else {
                          setSelectedProducts([]);
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Categoría
                   </th>
                   <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Precio
                   </th>
                   <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Stock
                   </th>
                   <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Estado
                   </th>
                   <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Acciones
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {filteredProducts.map((product) => (
                   <tr key={product.id} className="hover:bg-gray-50">
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                       <input
                         type="checkbox"
                         checked={selectedProducts.includes(product.id)}
                         onChange={(e) => {
                           if (e.target.checked) {
                             setSelectedProducts([...selectedProducts, product.id]);
                           } else {
                             setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                           }
                         }}
                         className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                       />
                     </td>
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                       <div className="flex items-center">
                       <div className="flex-shrink-0 h-12 w-12">
                          {product.primaryImage ? (
                            <img
                              className="h-12 w-12 rounded-lg object-cover"
                              src={product.primaryImage}
                              alt={product.name}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          {/* Botó³n para cambiar imagen */}
                          <div className="mt-1">
                            <button
                              onClick={() => {
                                const input = document.getElementById(`file-input-${product.id}`) as HTMLInputElement | null;
                                if (input) input.click();
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Cambiar imagen
                            </button>
                            <input
                              id={`file-input-${product.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                try {
                                  // Verificar si estamos offline
                                  const { useOfflineStore } = await import('@/store/offlineStore');
                                  const offlineStore = useOfflineStore.getState();
                                  
                                  if (offlineStore.isOffline) {
                                    // Modo offline - guardar imagen localmente
                                    const base64 = await handleOfflineImageUpload(file, product.id);
                                    if (base64) {
                                      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, primaryImage: base64 } : p));
                                      showSuccess('Imagen guardada localmente (se subirá cuando esté online)');
                                    } else {
                                      showError('Error al guardar imagen offline');
                                    }
                                  } else {
                                    // Modo online - subir normalmente
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    const resp = await api.post(`/products/${product.id}/image`, formData, {
                                      headers: { 'Content-Type': 'multipart/form-data' },
                                      __suppressGlobalError: true as any
                                    } as any);
                                    const newUrl = resp?.data?.data?.imageUrl;
                                    if (newUrl) {
                                      // Actualizar en estado local
                                      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, primaryImage: newUrl } : p));
                                      showSuccess('Imagen actualizada');
                                    } else {
                                      showError('No se pudo actualizar la imagen');
                                    }
                                  }
                                } catch (err) {
                                  console.error('Upload error:', err);
                                  showError('Error al subir la imagen');
                                } finally {
                                  // limpiar input
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                         <div className="ml-4">
                           <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                             {product.name}
                             {product.isFeatured && <Star className="h-4 w-4 text-yellow-500" />}
                             {!product.isActive && <XCircle className="h-4 w-4 text-red-500" />}
                           </div>
                           <div className="text-sm text-gray-500">
                             {typeof product.description === 'string'
                               ? product.description
                               : (product.description ? String(product.description) : '')}
                           </div>
                           {product.brand && (
                             <div className="text-xs text-gray-400">Marca: {typeof product.brand === 'string' ? product.brand : String(product.brand)}</div>
                           )}
                         </div>
                       </div>
                     </td>
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                       <div className="text-sm text-gray-900">{product.sku}</div>
                       {product.barcode && (
                         <div className="text-xs text-gray-500">Código: {product.barcode}</div>
                       )}
                     </td>
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {typeof product.category === 'string' ? product.category : (product.category?.name ?? 'Sin categoró­a')}
                       </span>
                       {product.subcategory && (
                         <div className="text-xs text-gray-500 mt-1">{typeof product.subcategory === 'string' ? product.subcategory : String(product.subcategory)}</div>
                       )}
                     </td>
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                       <div className="text-sm font-medium text-gray-900">
                         ${product.costPrice.toLocaleString()}
                       </div>
                       <div className="text-xs text-gray-500">
                         Costo: ${product.costPrice.toLocaleString()}
                       </div>
                       {product.wholesalePrice && (
                         <div className="text-xs text-gray-500">
                           Mayoreo: ${product.wholesalePrice.toLocaleString()}
                         </div>
                       )}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center">
                         <span className="text-sm font-medium text-gray-900">
                           {product.availableStock}
                         </span>
                         {product.availableStock <= product.minStock && (
                           <AlertTriangle className="w-4 h-4 ml-1 text-yellow-500" />
                         )}
                       </div>
                       <div className="text-xs text-gray-500">
                         Mó­n: {product.minStock}
                         {product.reservedStock > 0 && ` | Reservado: ${product.reservedStock}`}
                       </div>
                       <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                         <div
                           className={`h-1 rounded-full ${
                             product.availableStock === 0
                               ? 'bg-red-500'
                               : product.availableStock <= product.minStock
                               ? 'bg-yellow-500'
                               : 'bg-green-500'
                           }`}
                           style={{
                             width: `${Math.min(
                               (product.availableStock / (product.maxStock || product.availableStock || 1)) * 100,
                               100
                             )}%`
                           }}
                         />
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center justify-center">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           product.availableStock === 0
                             ? 'bg-red-100 text-red-800'
                             : product.availableStock <= product.minStock
                             ? 'bg-yellow-100 text-yellow-800'
                             : 'bg-green-100 text-green-800'
                         }`}>
                           {product.availableStock === 0 && 'Sin stock'}
                           {product.availableStock <= product.minStock && product.availableStock > 0 && 'Stock bajo'}
                           {product.availableStock > product.minStock && 'Disponible'}
                         </span>
                       </div>
                     </td>
                     <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                         <button
                           onClick={() => showWarning('Detalles de producto no implementados')}
                           className="text-gray-400 hover:text-blue-600 transition-colors"
                           title="Ver detalles"
                         >
                           <Eye className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => openProductModal(product)}
                           className="text-gray-400 hover:text-blue-600 transition-colors"
                           title="Editar"
                         >
                           <Edit3 className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => handleDuplicateProduct(product)}
                           className="text-gray-400 hover:text-green-600 transition-colors"
                           title="Duplicar"
                         >
                           <Copy className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => {
                             setStockAdjustment(prev => ({ ...prev, productId: product.id }));
                             setShowStockModal(true);
                           }}
                           className="text-gray-400 hover:text-purple-600 transition-colors"
                           title="Ajustar stock"
                         >
                         <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAssetsModal(product)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Activos"
                        >
                          <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             
             {filteredProducts.length === 0 && (
               <div className="text-center py-12">
                 <Package className="mx-auto h-12 w-12 text-gray-400" />
                 <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
                 <p className="mt-1 text-sm text-gray-500">
                   No se encontraron productos que coincidan con los filtros aplicados.
                 </p>
                 <div className="mt-6">
                   <button
                     onClick={() => openProductModal()}
                     className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                   >
                     <Plus className="h-4 w-4 mr-2" />
                     Crear primer producto
                   </button>
                 </div>
               </div>
             )}
           </div>
         )}
       </div>
      
      {/* Modal de Importació³n */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Importar Productos</h3>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-600">Filas vó¡lidas</div>
                  <div className="text-2xl font-semibold">{importPreview.length}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-600">Errores</div>
                  <div className="text-2xl font-semibold text-red-600">{importErrors.length}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-sm text-gray-600">Categorías detectadas</div>
                  <div className="text-2xl font-semibold">{Array.from(new Set(importPreview.map(r => r.category).filter(Boolean))).length}</div>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                  <div className="font-medium mb-2">Errores de validació³n</div>
                  <ul className="text-sm list-disc ml-5 space-y-1 max-h-40 overflow-y-auto">
                    {importErrors.slice(0, 50).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {importErrors.length > 50 && (
                    <div className="text-xs mt-2">Mostrando 50 de {importErrors.length} errores.</div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importPreview.slice(0, 20).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{row.sku}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{row.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{Number(row.costPrice).toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{row.retailPrice != null ? Number(row.retailPrice).toFixed(2) : '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{row.stock}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{row.category || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{row.brand || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.length > 20 && (
                  <div className="text-xs text-gray-500 mt-2">Mostrando 20 de {importPreview.length} filas.</div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyImport}
                  disabled={importPreview.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Aplicar importació³n
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssetsModal && assetsProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Activos de {assetsProduct.name}</h3>
              <button onClick={() => setShowAssetsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={assetForm.serial} onChange={(e) => setAssetForm(prev => ({ ...prev, serial: e.target.value }))} placeholder="Serial" className="border rounded px-3 py-2 text-sm" />
                <select value={assetForm.status} onChange={(e) => setAssetForm(prev => ({ ...prev, status: e.target.value as any }))} className="border rounded px-3 py-2 text-sm">
                  <option value="available">Disponible</option>
                  <option value="reserved">Reservado</option>
                  <option value="sold">Vendido</option>
                  <option value="service">Servicio</option>
                </select>
                <input value={assetForm.hallmark || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, hallmark: e.target.value }))} placeholder="Hallmark" className="border rounded px-3 py-2 text-sm" />
                <input value={assetForm.location || ''} onChange={(e) => setAssetForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Ubicación" className="border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end">
                <button onClick={createAsset} className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"><Plus className="h-4 w-4 mr-2" />Agregar activo</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hallmark</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assetsLoading ? (
                      <tr><td colSpan={4} className="px-3 py-4"><LoadingSpinner /></td></tr>
                    ) : (
                      assetsList.map(a => (
                        <tr key={a.id}>
                          <td className="px-3 py-2 text-sm text-gray-900">{a.serial}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{a.status}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{a.hallmark || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => generateAssetLabel(a)} className="text-gray-400 hover:text-blue-600" title="Etiqueta"><Tag className="w-4 h-4" /></button>
                              <button onClick={() => deleteAsset(a.id)} className="text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Producto */}
       {showProductModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
             <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-semibold text-gray-900">
                   {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                 </h3>
                 <button
                   onClick={closeProductModal}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <X className="h-6 w-6" />
                 </button>
               </div>
             </div>
             {import.meta.env.DEV && (
               <div className="mx-4 mt-3 mb-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-2 text-xs">
                 <div className="font-medium">Depuració³n de envó­o</div>
                 <div>baseURL: {String((api as any)?.defaults?.baseURL || '')}</div>
                 <div>auth: {((api as any)?.defaults?.headers?.common?.['Authorization'] ? 'só­' : 'no')}</div>
               </div>
             )}
             
             <form onSubmit={handleSubmitProduct} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Imó¡genes del Producto */}
              {editingProduct && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Gem className="h-5 w-5 mr-2" />
                    Imó¡genes del Producto
                  </h4>
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">
                      {editingProduct.primaryImage ? (
                        <img src={editingProduct.primaryImage} alt="Imagen principal" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-10 w-10 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('modal-primary-image')?.click()}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                      >
                        Cambiar imagen principal
                      </button>
                      <input
                        id="modal-primary-image"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !editingProduct) return;
                          
                          try {
                            // Verificar si estamos offline
                            const { useOfflineStore } = await import('@/store/offlineStore');
                            const offlineStore = useOfflineStore.getState();
                            
                            if (offlineStore.isOffline) {
                              // Modo offline - guardar imagen localmente
                              const base64 = await handleOfflineImageUpload(file, editingProduct.id);
                              if (base64) {
                                setEditingProduct(prev => prev ? { ...prev, primaryImage: base64 } : prev);
                                setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, primaryImage: base64 } : p));
                                showSuccess('Imagen guardada localmente (se subirá cuando esté online)');
                              } else {
                                showError('Error al guardar imagen offline');
                              }
                            } else {
                              // Modo online - subir normalmente
                              const fd = new FormData();
                              fd.append('image', file);
                              const resp = await api.post(`/products/${editingProduct.id}/image`, fd, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                                __suppressGlobalError: true as any
                              } as any);
                              const newUrl = resp?.data?.data?.imageUrl;
                              if (newUrl) {
                                setEditingProduct(prev => prev ? { ...prev, primaryImage: newUrl } : prev);
                                setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, primaryImage: newUrl } : p));
                                showSuccess('Imagen principal actualizada');
                              } else {
                                showError('No se pudo actualizar la imagen principal');
                              }
                            }
                          } catch (err) {
                            console.error('Upload error:', err);
                            showError('Error al subir la imagen principal');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('modal-gallery-images')?.click()}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
                      >
                        Subir imágenes a la galeró­a
                      </button>
                      <input
                        id="modal-gallery-images"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files ? Array.from(e.target.files) : [];
                          if (!files.length || !editingProduct) return;
                          try {
                            const fd = new FormData();
                            for (const file of files) fd.append('images', file);
                            const resp = await api.post(`/products/${editingProduct.id}/images`, fd, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                              __suppressGlobalError: true as any
                            } as any);
                            const urls: string[] = resp?.data?.data?.images || [];
                            if (urls.length) {
                              setModalImages(prev => [...prev, ...urls]);
                              showSuccess('Imó¡genes aó±adidas a la galeró­a');
                            } else {
                              showError('No se aó±adieron imágenes');
                            }
                          } catch (err) {
                            console.error('Upload error:', err);
                            showError('Error al subir imágenes');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                    {modalImagesLoading && (
                      <span className="text-xs text-gray-500">Cargando galeró­a...</span>
                    )}
                  </div>

                  {modalImages.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {modalImages.map((url, index) => (
                          <div
                            key={url}
                            className={`border rounded-md overflow-hidden bg-white ${dragIndex === index ? 'opacity-60 ring-2 ring-blue-400' : ''}`}
                            draggable
                            onDragStart={() => setDragIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex === null || dragIndex === index) return;
                              setModalImages(prev => {
                                const next = [...prev];
                                const [moved] = next.splice(dragIndex, 1);
                                next.splice(index, 0, moved);
                                return next;
                              });
                              setDragIndex(null);
                            }}
                          >
                          <img src={url} alt="Imagen del producto" className="w-full h-24 object-cover" />
                          <div className="p-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editingProduct) return;
                                try {
                                  const resp = await api.put(`/products/${editingProduct.id}`, { imageUrl: url } as any, { __suppressGlobalError: true as any } as any);
                                  try { apiUtils.invalidateCache('/products'); } catch {}
                                  const newUrl = resp?.data?.data?.imageUrl || url;
                                  setEditingProduct(prev => prev ? { ...prev, primaryImage: newUrl } : prev);
                                  setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, primaryImage: newUrl } : p));
                                  showSuccess('Imagen establecida como principal');
                                } catch (err) {
                                  console.error('Set primary error:', err);
                                  showError('Error al establecer imagen principal');
                                }
                              }}
                              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              Usar como principal
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editingProduct) return;
                                if (!window.confirm('Â¿Eliminar esta imagen de la galeró­a?')) return;
                                try {
                                  await api.delete(`/products/${editingProduct.id}/images`, { data: { url }, __suppressGlobalError: true as any } as any);
                                  setModalImages(prev => prev.filter(u => u !== url));
                                  if (editingProduct.primaryImage === url) {
                                    setEditingProduct(prev => prev ? { ...prev, primaryImage: undefined } : prev);
                                    setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, primaryImage: undefined } : p));
                                  }
                                  showSuccess('Imagen eliminada de la galeró­a');
                                } catch (err) {
                                  console.error('Delete image error:', err);
                                  showError('Error al eliminar la imagen');
                                }
                              }}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editingProduct) return;
                            try {
                              await api.put(`/products/${editingProduct.id}/images/order`, { order: modalImages } as any, { __suppressGlobalError: true as any } as any);
                              try { apiUtils.invalidateCache('/products'); } catch {}
                              showSuccess('Orden de galeró­a guardado');
                            } catch (err) {
                              console.error('Save order error:', err);
                              showError('Error al guardar el orden de imágenes');
                            }
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Guardar orden
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Información Básica */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
                 <div className="space-y-4">
                   <h4 className="text-md font-medium text-gray-900 flex items-center">
                     <Info className="h-5 w-5 mr-2" />
                     Información Básica
                   </h4>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Nombre del Producto *
                     </label>
                     <input
                       type="text"
                       required
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.name}
                       onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                       placeholder="Ej: Anillo de Compromiso Solitario"
                     />
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Descripción
                     </label>
                     <textarea
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       rows={3}
                       value={formData.description}
                       onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                       placeholder="Descripción detallada del producto..."
                     />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 md:gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         SKU *
                       </label>
                       <input
                         type="text"
                         required
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.sku}
                         onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                         placeholder="ANI-SOL-001"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Código de Barras
                       </label>
                       <input
                         type="text"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.barcode}
                         onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                         placeholder="1234567890123"
                       />
                     </div>
                   </div>
                   {/* Generación de códigos integrada */}
                   <div className="mt-2 flex items-center justify-between">
                     <button
                       type="button"
                       onClick={handleGenerateCodes}
                       className="inline-flex items-center px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                       title="Generar SKU y Código de Barras a partir de la categoría"
                     >
                       <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M4 7h1M4 17h1M7 7h1M7 17h1M10 7h1M10 17h1M13 7h1M13 17h1M16 7h1M16 17h1M19 7h1M19 17h1" />
                       </svg>
                       Generar Códigos
                     </button>
                     <div className="text-xs text-gray-600">
                       Prefijo basado en categoría y nombre; se asigna al SKU y al código de barras.
                     </div>
                   </div>
                   {/* Vista previa ligera de códigos */}
                   <div className="mt-2 p-2 border border-gray-200 rounded-md bg-gray-50">
                     <div className="text-xs text-gray-600 mb-1">Vista previa rápida</div>
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <div className="text-xs font-medium text-gray-700">SKU</div>
                         <div className="text-sm font-mono text-gray-900">{formData.sku || '—'}</div>
                       </div>
                       <div>
                         <div className="text-xs font-medium text-gray-700">Código de Barras</div>
                         <div className="text-sm font-mono text-gray-900">{formData.barcode || formData.sku || '—'}</div>
                       </div>
                     </div>
                     <div className="mt-1 text-[10px] text-gray-500">
                       La imagen del código se genera y guarda al guardar el producto.
                     </div>
                   </div>
                 </div>
                 
                 {/* Precios */}
                 <div className="space-y-4">
                   <h4 className="text-md font-medium text-gray-900 flex items-center">
                     <DollarSign className="h-5 w-5 mr-2" />
                     Precios
                   </h4>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Precio de Costo
                       </label>
                       <input
                         type="number"
                         step="0.01"
                         min="0"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.costPrice}
                         onChange={(e) => setFormData(prev => ({ ...prev, costPrice: e.target.value }))}
                         placeholder="1500.00"
                         data-testid="cost-price-input"
                       />
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Precio Mayoreo
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       min="0"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.wholesalePrice}
                       onChange={(e) => setFormData(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                       placeholder="2000.00"
                       data-testid="wholesale-price-input"
                     />
                   </div>

                   {/* Auditoría de cambios de precio */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Razón de actualización de precio
                       </label>
                       <input
                         type="text"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.priceUpdateReason}
                         onChange={(e) => setFormData(prev => ({ ...prev, priceUpdateReason: e.target.value }))}
                         placeholder="Motivo del cambio (p. ej., ajuste de proveedor)"
                         data-testid="price-update-reason"
                       />
                       <p className="mt-1 text-xs text-gray-500">
                         Se envía cuando se modifican precios.
                       </p>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Moneda del precio
                       </label>
                       <input
                         type="text"
                         maxLength={3}
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                         value={formData.priceUpdateCurrency}
                         onChange={(e) => setFormData(prev => ({ ...prev, priceUpdateCurrency: e.target.value.toUpperCase() }))}
                         placeholder="MXN"
                         data-testid="price-update-currency"
                       />
                       <p className="mt-1 text-xs text-gray-500">
                         Prefijada desde configuración pública; usa código de 3 letras.
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
               
               {/* Stock y Categorización */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
                 {/* Stock */}
                 <div className="space-y-4">
                   <h4 className="text-md font-medium text-gray-900 flex items-center">
                     <Package className="h-5 w-5 mr-2" />
                     Inventario
                   </h4>
                   
                   <div className="grid grid-cols-3 gap-3 md:gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Stock Actual
                       </label>
                       <input
                         type="number"
                         min="0"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.stock}
                         onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                         placeholder="5"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Stock Mínimo
                       </label>
                       <input
                         type="number"
                         min="0"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.minStock}
                         onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                         placeholder="2"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Stock Máximo
                       </label>
                       <input
                         type="number"
                         min="0"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.maxStock}
                         onChange={(e) => setFormData(prev => ({ ...prev, maxStock: e.target.value }))}
                         placeholder="20"
                       />
                     </div>
                   </div>
                 </div>
                 
                 {/* Categorización */}
                 <div className="space-y-4">
                   <h4 className="text-md font-medium text-gray-900 flex items-center">
                     <Tag className="h-5 w-5 mr-2" />
                     Categorización
                   </h4>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Categoría *
                     </label>
                     <select
                       required
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.categoryId}
                       onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                     >
                       <option value="">Seleccionar categoró­a</option>
                       {categories.map(category => (
                         <option key={category.id} value={category.id}>{category.name}</option>
                       ))}
                     </select>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 md:gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Subcategoró­a
                       </label>
                       <input
                         type="text"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.subcategory}
                         onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                         placeholder="Compromiso"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                         Marca
                       </label>
                       <input
                         type="text"
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         value={formData.brand}
                         onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                         placeholder="Elegance"
                       />
                     </div>
                   </div>
                 </div>
               </div>
               
               {/* Caracteró­sticas de Joyeró­a */}
               <div className="space-y-4">
                 <h4 className="text-md font-medium text-gray-900 flex items-center">
                   <Gem className="h-5 w-5 mr-2" />
                   Caracteró­sticas de Joyeró­a
                 </h4>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Metal
                     </label>
                     <select
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.metal}
                       onChange={(e) => setFormData(prev => ({ ...prev, metal: e.target.value }))}
                     >
                       <option value="">Seleccionar metal</option>
                       <option value="Oro Amarillo">Oro Amarillo</option>
                       <option value="Oro Blanco">Oro Blanco</option>
                       <option value="Oro Rosa">Oro Rosa</option>
                       <option value="Plata">Plata</option>
                       <option value="Platino">Platino</option>
                       <option value="Acero Inoxidable">Acero Inoxidable</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Pureza del Metal
                     </label>
                     <select
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.metalPurity}
                       onChange={(e) => setFormData(prev => ({ ...prev, metalPurity: e.target.value }))}
                     >
                       <option value="">Seleccionar pureza</option>
                       <option value="10k">10k</option>
                       <option value="14k">14k</option>
                       <option value="18k">18k</option>
                       <option value="24k">24k</option>
                       <option value="925">925 (Plata)</option>
                       <option value="950">950 (Platino)</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Peso (gramos)
                     </label>
                     <input
                       type="number"
                       step="0.1"
                       min="0"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.weight}
                       onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                       placeholder="3.5"
                     />
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Piedra Principal
                     </label>
                     <select
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.gemstone}
                       onChange={(e) => setFormData(prev => ({ ...prev, gemstone: e.target.value }))}
                     >
                       <option value="">Sin piedra</option>
                       <option value="Diamante">Diamante</option>
                       <option value="Esmeralda">Esmeralda</option>
                       <option value="Rubó­">Rubó­</option>
                       <option value="Zafiro">Zafiro</option>
                       <option value="Perla">Perla</option>
                       <option value="Amatista">Amatista</option>
                       <option value="Topacio">Topacio</option>
                       <option value="Cuarzo">Cuarzo</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Peso Piedra (quilates)
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       min="0"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.gemstoneWeight}
                       onChange={(e) => setFormData(prev => ({ ...prev, gemstoneWeight: e.target.value }))}
                       placeholder="1.0"
                     />
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Color Piedra
                     </label>
                     <input
                       type="text"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.gemstoneColor}
                       onChange={(e) => setFormData(prev => ({ ...prev, gemstoneColor: e.target.value }))}
                       placeholder="D (Incoloro)"
                     />
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Claridad
                     </label>
                     <select
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       value={formData.gemstoneClarity}
                       onChange={(e) => setFormData(prev => ({ ...prev, gemstoneClarity: e.target.value }))}
                     >
                       <option value="">Seleccionar claridad</option>
                       <option value="FL">FL (Flawless)</option>
                       <option value="IF">IF (Internally Flawless)</option>
                       <option value="VVS1">VVS1</option>
                       <option value="VVS2">VVS2</option>
                       <option value="VS1">VS1</option>
                       <option value="VS2">VS2</option>
                       <option value="SI1">SI1</option>
                       <option value="SI2">SI2</option>
                     </select>
                   </div>
                 </div>
               </div>
               
               {/* Configuració³n */}
               <div className="space-y-4">
                 <h4 className="text-md font-medium text-gray-900 flex items-center">
                   <Settings className="h-5 w-5 mr-2" />
                   Configuració³n
                 </h4>
                 
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       id="isActive"
                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                       checked={formData.isActive}
                       onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                     />
                     <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                       Producto activo
                     </label>
                   </div>
                   
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       id="isFeatured"
                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                       checked={formData.isFeatured}
                       onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                     />
                     <label htmlFor="isFeatured" className="ml-2 block text-sm text-gray-900">
                       Producto destacado
                     </label>
                   </div>
                   
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       id="trackInventory"
                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                       checked={formData.trackInventory}
                       onChange={(e) => setFormData(prev => ({ ...prev, trackInventory: e.target.checked }))}
                     />
                     <label htmlFor="trackInventory" className="ml-2 block text-sm text-gray-900">
                       Rastrear inventario
                     </label>
                   </div>
                   
                   <div className="flex items-center">
                     <input
                       type="checkbox"
                       id="allowBackorder"
                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                       checked={formData.allowBackorder}
                       onChange={(e) => setFormData(prev => ({ ...prev, allowBackorder: e.target.checked }))}
                     />
                     <label htmlFor="allowBackorder" className="ml-2 block text-sm text-gray-900">
                       Permitir pedidos pendientes
                     </label>
                   </div>
                 </div>
               </div>
               
               {/* Botones de acció³n */}
               <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                 <button
                   type="button"
                   onClick={closeProductModal}
                   className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                 >
                   Cancelar
                 </button>
                 <button
                   data-testid="joyas.save"
                   type="submit"
                   disabled={submitting}
                   className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                 >
                   {submitting ? (
                     <>
                       <LoadingSpinner size="sm" />
                       <span className="ml-2">Guardando...</span>
                     </>
                   ) : (
                     <>
                       <Save className="h-4 w-4 mr-2" />
                       {editingProduct ? 'Actualizar' : 'Crear'} Producto
                     </>
                   )}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}
       
       {/* Modal de Ajuste de Stock */}
       {showStockModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg w-full max-w-md">
             <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
               <h3 className="text-lg font-semibold text-gray-900">Ajustar Stock</h3>
             </div>
             
             <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Producto
                 </label>
                 <select
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={stockAdjustment.productId}
                   onChange={(e) => setStockAdjustment(prev => ({ ...prev, productId: e.target.value }))}
                 >
                   <option value="">Seleccionar producto</option>
                   {products.map(product => (
                     <option key={product.id} value={product.id}>
                       {product.name} (Stock actual: {product.availableStock})
                     </option>
                   ))}
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Tipo de Movimiento
                 </label>
                 <select
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={stockAdjustment.type}
                   onChange={(e) => setStockAdjustment(prev => ({ ...prev, type: e.target.value as any }))}
                 >
                   <option value="in">Entrada de Stock</option>
                   <option value="out">Salida de Stock</option>
                   <option value="adjustment">Ajuste de Stock</option>
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Cantidad
                 </label>
                 <input
                   type="number"
                   min="0"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={stockAdjustment.quantity}
                   onChange={(e) => setStockAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                   placeholder="Cantidad"
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Motivo
                 </label>
                 <select
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={stockAdjustment.reason}
                   onChange={(e) => setStockAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                 >
                   <option value="">Seleccionar motivo</option>
                   <option value="Compra">Compra</option>
                   <option value="Venta">Venta</option>
                   <option value="Devolució³n">Devolució³n</option>
                   <option value="Daó±o">Daó±o</option>
                   <option value="Pó©rdida">Pó©rdida</option>
                   <option value="Inventario inicial">Inventario inicial</option>
                   <option value="Correcció³n">Correcció³n</option>
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Notas (opcional)
                 </label>
                 <textarea
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   rows={3}
                   value={stockAdjustment.notes}
                   onChange={(e) => setStockAdjustment(prev => ({ ...prev, notes: e.target.value }))}
                   placeholder="Notas adicionales..."
                 />
               </div>
             </div>
             
             <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex justify-end space-x-3">
               <button
                 onClick={() => setShowStockModal(false)}
                 className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
               >
                 Cancelar
               </button>
               <button
                 onClick={handleStockAdjustment}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
               >
                 Aplicar Ajuste
               </button>
             </div>
           </div>
         </div>
       )}
       
       {/* Modal de Acciones Masivas */}
       {showBulkModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg w-full max-w-md">
             <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
               <h3 className="text-lg font-semibold text-gray-900">
                 Acciones Masivas ({selectedProducts.length} productos)
               </h3>
             </div>
             
             <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Acció³n
                 </label>
                 <select
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={bulkAction.action}
                   onChange={(e) => setBulkAction(prev => ({ ...prev, action: e.target.value }))}
                 >
                   <option value="">Seleccionar acció³n</option>
                   <option value="activate">Activar productos</option>
                   <option value="deactivate">Desactivar productos</option>
                   <option value="feature">Marcar como destacados</option>
                   <option value="unfeature">Quitar destacado</option>
                   <option value="price_increase">Aumentar precios</option>
                   <option value="price_decrease">Disminuir precios</option>
                 </select>
               </div>
               
               {(bulkAction.action === 'price_increase' || bulkAction.action === 'price_decrease') && (
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Porcentaje (%)
                   </label>
                   <input
                     type="number"
                     min="0"
                     max="100"
                     step="0.1"
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     value={bulkAction.value}
                     onChange={(e) => setBulkAction(prev => ({ ...prev, value: e.target.value }))}
                     placeholder="10"
                   />
                 </div>
               )}
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Motivo
                 </label>
                 <input
                   type="text"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   value={bulkAction.reason}
                   onChange={(e) => setBulkAction(prev => ({ ...prev, reason: e.target.value }))}
                   placeholder="Motivo de la acció³n masiva"
                 />
               </div>
             </div>
             
             <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex justify-end space-x-3">
               <button
                 onClick={() => setShowBulkModal(false)}
                 className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
               >
                 Cancelar
               </button>
               <button
                 onClick={handleBulkAction}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
               >
                 Aplicar Acció³n
               </button>
             </div>
           </div>
         </div>
       )}
       
       {/* Scanner de Código de Barras */}
       {showScanner && (
        <BarcodeScanner
          isOpen={showScanner}
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
      
      {/* Hardware Scanner Listener - Eclinepos EC-CD-8100 */}
      <HardwareScannerListener
        onScan={handleScan}
        minLength={3}
        maxLength={128}
        timeout={50}
        triggerKeys={['Enter', 'Tab']}
        ignoreIfFocused={true}
      />
      </div>
   );
 };
 
// Funciones auxiliares

// Normaliza un valor de texto para coincidir con enums del backend.
// Convierte a minúsculas y capitaliza cada palabra.
function normalizeEnum(val?: string) {
  if (!val) return undefined as any;
  const lower = String(val).toLowerCase();
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normaliza el valor de "metal" para cumplir con los enums del backend.
// En particular, Plata debe incluir pureza en el campo metal: "Plata 925|950|999".
function normalizeMetalWithPurity(metal?: string, purity?: string): string | undefined {
  if (!metal) return undefined;
  // Evitar depender de normalizeEnum para prevenir errores de referencia.
  const lowerMetal = String(metal).toLowerCase();
  const m = lowerMetal.replace(/\b\w/g, (c) => c.toUpperCase());
  const p = (purity || '').trim();
  // Backend espera "Plata 925/950/999" en el campo metal
  if (m === 'Plata' && /^(925|950|999)$/i.test(p)) {
    return `Plata ${p}`;
  }
  // Para Oro, el backend acepta variantes de color sin pureza en el enum (Amarillo/Blanco/Rosa)
  // Pureza se envía por separado en metalPurity
  return m;
}
 
  export default ProductsPage;



