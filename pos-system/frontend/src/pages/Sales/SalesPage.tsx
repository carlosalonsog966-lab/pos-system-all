import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getStableKey } from '@/lib/utils';
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  X,
  ShoppingCart,
  Calculator,
  Receipt,
  AlertCircle,
  Smartphone,
  DollarSign,
  Tag,
  Users,
  Package,
  History,
  Eye,
  RefreshCw,
  TrendingUp,
  Printer
} from 'lucide-react';
import { api, initializeApiBaseUrl, normalizeListPayload, parsePaginatedResponse, backendStatus } from '@/lib/api';
import { z } from 'zod';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { useProductsStore } from '@/store/productsStore';
import { useClientsStore } from '@/store/clientsStore';
import { useAuthStore } from '@/store/authStore';
  
import SearchBar from '@/components/SearchBar';
import Modal from '@/components/Modal';
import BarcodeScanner from '@/components/BarcodeScanner';
import HardwareScannerListener from '@/components/Hardware/HardwareScannerListener';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import ObservabilityChip from '@/components/Common/ObservabilityChip';
import { GuideService, type Guide, type GuideStats } from '@/services/guideService';
import { AgencyService, type Agency } from '@/services/agencyService';
import SettingsService from '@/lib/settingsService';
import { maybeFixMojibake } from '@/lib/textEncoding';
import { SalesService } from '@/services/salesService';
import { createSaleSchema } from '@/schemas/sale';
import { useSalesUrlSync } from '@/hooks/useSalesUrlSync';

// Interfaces mejoradas
interface Product {
  id: string;
  name: string;
  description?: string;
  salePrice: number;
  stock: number;
  minStock: number;
  barcode?: string;
  sku?: string;
  // category puede venir como string o como objeto desde la API
  category?: string | { id?: string; name?: string; [key: string]: unknown };
  brand?: string;
  weight?: number;
  material?: string;
  images?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Control de descuentos por producto (opcional, si backend lo provee)
  discountable?: boolean; // Por defecto true si no está presente
  maxDiscountPercent?: number; // Límite específico del producto, si existe
}

// Tipo mínimo para empleados (vendedores)
interface Employee {
  id: string;
  code: string;
  name: string;
  email?: string;
  branch?: {
    id: string;
    code: string;
    name: string;
  };
  // Optional commission fields when available from backend
  commissionFormula?: 'DIRECT' | 'DISCOUNT_PERCENTAGE';
  discountPercentage?: number;
  commissionRate?: number;
  streetSaleCardRate?: number;
  streetSaleCashRate?: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  birthDate?: string;
  customerType: 'regular' | 'vip' | 'wholesale';
  creditLimit?: number;
  discount?: number;
  totalPurchases: number;
  lastPurchase?: string;
  isActive: boolean;
  notes?: string;
}

interface SaleItem {
  id?: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  notes?: string;
}

interface Sale {
  id?: string;
  saleNumber?: string;
  items: SaleItem[];
  client?: Client;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  cashReceived?: number;
  change?: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  cashierId?: string;
  saleDate?: string;
  // Referencias de pago
  cardReference?: string;
  transferReference?: string;
  // Campos del sistema de turismo
  saleType?: 'GUIDE' | 'STREET';
  agencyId?: string;
  guideId?: string;
  employeeId?: string;
  branchId?: string;
  agencyCommission?: number;
  guideCommission?: number;
  employeeCommission?: number;
  // Timestamps opcionales presentes en la API
  createdAt?: string;
  updatedAt?: string;
}

interface PaymentDetails {
  cash?: number;
  card?: number;
  transfer?: number;
  cardReference?: string;
  transferReference?: string;
}

interface SalesFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  status?: string;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  // Filtros por referencias
  hasReference?: boolean;
  referenceQuery?: string;
}

type SalesPageProps = { testMode?: boolean };
const SalesPage: React.FC<SalesPageProps> = ({ testMode = false }) => {
  // Estados principales
  const [activeTab, setActiveTab] = useState<'new-sale' | 'guide-sale' | 'sales-history' | 'analytics'>('new-sale');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  // Estados de bÃƒÂºsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const { salesFilters, setSalesFilters, handleSalesFilterChange } = useSalesUrlSync(activeTab);
  const amountRangeError = (salesFilters.minAmount !== undefined && salesFilters.maxAmount !== undefined && salesFilters.maxAmount < salesFilters.minAmount);
  // PaginaciÃƒÂ³n de productos
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / pageSize)), [filteredProducts, pageSize]);
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, onlyLowStock, salesFilters]);
  
  // Estados del sistema de turismo
  const [, setAgencies] = useState<Agency[]>([]);
  const [, setGuides] = useState<Guide[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [saleType, setSaleType] = useState<'GUIDE' | 'STREET'>('STREET');
  const [saleFlowTab, setSaleFlowTab] = useState<'GUIDE' | 'STREET'>('STREET');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [guideStats, setGuideStats] = useState<GuideStats | null>(null);
  const [guideStatsLoading, setGuideStatsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Sincronizar pestaña interna con saleType y datos asociados
  useEffect(() => {
    setSaleType(saleFlowTab);
    setCurrentSale(prev => ({
      ...prev,
      saleType: saleFlowTab,
      agencyId: saleFlowTab === 'GUIDE' ? prev.agencyId : undefined,
      guideId: saleFlowTab === 'GUIDE' ? prev.guideId : undefined,
    }));
    if (saleFlowTab === 'STREET') {
      setSelectedAgency(null);
      setSelectedGuide(null);
    }
  }, [saleFlowTab]);

  // Forzar modo según pestaña superior seleccionada - con persistencia de estado
  useEffect(() => {
    if (activeTab === 'guide-sale') {
      setSaleFlowTab('GUIDE');
      setSaleType('GUIDE');
      // Mantener agencia/guía seleccionados si existen
      setCurrentSale(prev => ({ 
        ...prev, 
        saleType: 'GUIDE',
        agencyId: selectedAgency?.id || prev.agencyId,
        guideId: selectedGuide?.id || prev.guideId,
      }));
    } else if (activeTab === 'new-sale') {
      setSaleFlowTab('STREET');
      setSaleType('STREET');
      // Solo limpiar agencia/guía si no hay venta en progreso
      if (currentSale.items.length === 0) {
        setSelectedAgency(null);
        setSelectedGuide(null);
        setCurrentSale(prev => ({ ...prev, saleType: 'STREET', agencyId: undefined, guideId: undefined }));
      } else {
        // Si hay venta en progreso, solo cambiar el tipo sin perder datos
        setCurrentSale(prev => ({ ...prev, saleType: 'STREET' }));
      }
    }
  }, [activeTab, selectedAgency, selectedGuide]);

  // Sincronización de filtros de historial de ventas se maneja en useSalesUrlSync

  // Cargar KPIs del guía seleccionado (rango de hoy)
  useEffect(() => {
    const loadGuideStats = async () => {
      if (!selectedGuide?.id) { setGuideStats(null); return; }
      try {
        setGuideStatsLoading(true);
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        const stats = await GuideService.getGuideStats(selectedGuide.id, start.toISOString(), end.toISOString());
        setGuideStats(stats);
      } catch {
        setGuideStats(null);
      } finally {
        setGuideStatsLoading(false);
      }
    };
    loadGuideStats();
  }, [selectedGuide?.id]);
  
  // Estados de venta actual
  const DRAFT_KEY = 'pos:sales:draft:v1';
  const [currentSale, setCurrentSale] = useState<Sale>({
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'pending',
    saleType: 'STREET',
  });
  
  // Estados de modales y UI
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerGuide, setShowScannerGuide] = useState(false);
  const [showScannerEmployee, setShowScannerEmployee] = useState(false);
  const [showMasterScanner, setShowMasterScanner] = useState(false);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // Cerrar cualquier overlay/modal al cambiar de ruta para evitar superposición negra
  useEffect(() => {
    setShowClientModal(false);
    setShowPaymentModal(false);
    setShowScanner(false);
    setShowScannerGuide(false);
    setShowScannerEmployee(false);
    setShowMasterScanner(false);
    setShowSaleDetails(false);
    setShowNewClientModal(false);
  }, [location.pathname]);
  
  // Estados de pago
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({});
  const [cashReceived, setCashReceived] = useState('');
  const [singlePaymentReference, setSinglePaymentReference] = useState('');
  // Motivo corporativo de descuento cuando se aplica cualquier descuento
  const CORPORATE_DISCOUNT_REASONS = [
    'Promoción temporal',
    'Cliente frecuente',
    'Producto con defecto',
    'Ajuste comercial',
    'Autorización gerencia',
  ];
  const [discountReason, setDiscountReason] = useState<string>('');

  // Usuario autenticado para límites por rol
  const { user } = useAuthStore();
  const getRoleMaxDiscountPercent = useCallback((): number => {
    const role = user?.role || 'cashier';
    // Política por rol (ajustable si existe configuración):
    // admin: 50%, manager: 30%, cashier: 20%.
    if (role === 'admin') return 50;
    if (role === 'manager') return 30;
    return 20;
  }, [user?.role]);
  const getItemMaxDiscountPercent = useCallback((item: SaleItem): number => {
    const roleMax = getRoleMaxDiscountPercent();
    const productMax = Number(item.product.maxDiscountPercent ?? roleMax);
    return Math.max(0, Math.min(roleMax, productMax));
  }, [getRoleMaxDiscountPercent]);

  // Validación de pago y errores por método
  const getPaymentErrors = () => {
    const errors: {
      cashReceived?: string;
      mixedTotal?: string;
      cardReference?: string;
      transferReference?: string;
      singleReference?: string;
      discountReason?: string;
    } = {};
    const total = currentSale.total || 0;
    const method = currentSale.paymentMethod;

    if (method === 'cash') {
      const cr = parseFloat(cashReceived || '');
      if (!cashReceived) {
        errors.cashReceived = 'Ingrese el efectivo recibido';
      } else if (isNaN(cr) || cr < total) {
        errors.cashReceived = 'El efectivo debe ser mayor o igual al total';
      }
    } else if (method === 'mixed') {
      const cash = paymentDetails.cash || 0;
      const card = paymentDetails.card || 0;
      const transfer = paymentDetails.transfer || 0;
      const paid = cash + card + transfer;
      if (Math.abs(total - paid) >= 0.01) {
        errors.mixedTotal = `Falta: $${Math.abs(total - paid).toLocaleString()}`;
      }
      if (card > 0 && !(paymentDetails.cardReference || '').trim()) {
        errors.cardReference = 'Referencia de tarjeta requerida';
      }
      if (transfer > 0 && !(paymentDetails.transferReference || '').trim()) {
        errors.transferReference = 'Referencia de transferencia requerida';
      }
    } else if (method === 'card' || method === 'transfer') {
      if (!singlePaymentReference.trim()) {
        errors.singleReference = 'Número de referencia requerido';
      }
    }

    // Motivo corporativo requerido si hay descuentos
    if (currentSale.items.some(i => Number(i.discount) > 0)) {
      if (!String(discountReason || '').trim()) {
        errors.discountReason = 'Seleccione el motivo del descuento';
      }
    }

    return errors;
  };
  
  // Estados de carga y procesamiento
  const [loading, setLoading] = useState(!testMode);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados de cliente nuevo
  type NewClient = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    customerType: Client['customerType'];
  };
  const [newClient, setNewClient] = useState<NewClient>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    customerType: 'regular',
  });

  const { showSuccess, showError, showWarning, showInfo } = useNotificationStore();
  const { isOffline, addPendingAction, syncPendingActions, pendingActions, syncInProgress } = useOfflineStore();
 const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
  // Monitorear salud del backend y deshabilitar escrituras en modo degradado/caído
  useEffect(() => {
    const cb = (st: 'ok' | 'no_health' | 'down') => setBackendHealthMode(st);
    try {
      if (typeof (backendStatus as any)?.onStatus === 'function') {
        (backendStatus as any).onStatus(cb);
      }
      if (typeof (backendStatus as any)?.startPolling === 'function') {
        (backendStatus as any).startPolling(60000);
      }
    } catch {}
    return () => {
      try {
        if (typeof (backendStatus as any)?.offStatus === 'function') {
          (backendStatus as any).offStatus(cb);
        }
      } catch {}
    };
  }, []);
  // const { products: storeProducts, setProducts: setStoreProducts } = useProductsStore();
  // const { clients: storeClients, setClients: setStoreClients } = useClientsStore();

  // Configuración de impuestos (debería venir de configuración)
  const [applyTax, setApplyTax] = useState(true);
  const [taxRate, setTaxRate] = useState<number>(0.16); // 16% IVA por defecto
  const DEBOUNCE_MS = 250; // Debounce para filtros

  // Efectos
  const didInitRef = useRef(false);
  // Inicialización: ejecutar una vez (movida más abajo tras declarar fetchInitialData)
  // useEffect inicial se declara después de definir fetchInitialData para evitar
  // "used before its declaration".

  // Cargar tasa de IVA desde configuraciones públicas
  useEffect(() => {
    if (testMode) return;
    let active = true;
    (async () => {
      try {
        const publicSettings = await SettingsService.getPublicSettings();
        const ps = publicSettings as { taxRate?: number };
        if (active && typeof ps.taxRate === 'number') {
          const pct = ps.taxRate!;
          const factor = pct > 1 ? pct / 100 : pct; // soporta 16 o 0.16
          setTaxRate(factor);
        }
      } catch {
        // Mantener valor por defecto si falla
      }
    })();
    return () => { active = false; };
  }, [testMode]);

  // Efecto de filtrado de productos (declarado más abajo tras definir filterProducts)

  // Efecto de filtrado de ventas (declarado más abajo tras definir filterSales)

  // Efecto de cálculo de totales (declarado más abajo tras definir calculateTotals)

  // Guardar borrador de venta automáticamente
  useEffect(() => {
    try {
      const serializable = {
        items: currentSale.items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        paymentMethod: currentSale.paymentMethod,
        saleType,
        client: currentSale.client ? {
          id: currentSale.client.id,
          firstName: currentSale.client.firstName,
          lastName: currentSale.client.lastName,
        } : undefined,
        cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
        paymentDetails,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
    } catch { void 0; }
  }, [currentSale.items, currentSale.paymentMethod, paymentDetails, cashReceived, saleType, currentSale.client]);

  // Restaurar borrador de venta al cargar productos
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw || '{}');
      if (Array.isArray(draft.items)) {
        const restoredItems = draft.items
          .map((d: { productId: string; quantity: number; unitPrice: number; discount: number; }) => {
            const product = products.find(p => p.id === d.productId);
            if (!product) return null;
            return calculateItemTotal({
              product,
              quantity: Number(d.quantity) || 0,
              unitPrice: Number(d.unitPrice) || 0,
              discount: Number(d.discount) || 0,
              discountAmount: 0,
              subtotal: 0,
              total: 0,
            });
          })
          .filter(Boolean) as SaleItem[];

        setCurrentSale(prev => ({
          ...prev,
          items: restoredItems,
          paymentMethod: draft.paymentMethod || prev.paymentMethod,
          client: draft.client ? {
            ...prev.client,
            id: draft.client.id,
            firstName: draft.client.firstName,
            lastName: draft.client.lastName,
            isActive: prev.client?.isActive ?? true,
            totalPurchases: prev.client?.totalPurchases ?? 0,
            customerType: prev.client?.customerType ?? 'regular',
          } : prev.client,
          saleType: draft.saleType || prev.saleType,
        }));
        setPaymentDetails(draft.paymentDetails || {});
        setCashReceived(draft.cashReceived ? String(draft.cashReceived) : '');
      }
    } catch { void 0; }
  }, [products]);

  // Atajos de teclado para agilizar el flujo en ventas
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

      // Ctrl+K: enfocar el buscador
      if ((e.key === 'k' || e.key === 'K') && e.ctrlKey) {
        e.preventDefault();
        const input = searchRef.current?.querySelector('input');
        input?.focus();
        return;
      }

      // F2: abrir escáner maestro (siempre disponible)
      if (e.key === 'F2') {
        e.preventDefault();
        setShowMasterScanner(true);
        return;
      }

      // F9: abrir modal de pago cuando haya ÃƒÂ­tems
      if (e.key === 'F9') {
        e.preventDefault();
        if (currentSale.items.length > 0 && !processing) {
          setShowPaymentModal(true);
        }
        return;
      }

      // Ctrl+Supr: limpiar venta actual si hay ÃƒÂ­tems
      if (e.key === 'Delete' && e.ctrlKey) {
        e.preventDefault();
        if (currentSale.items.length > 0) {
          clearSale();
        }
        return;
      }

      // Ctrl+= / Ctrl++: aumentar cantidad del ÃƒÂºltimo ÃƒÂ­tem
      if ((e.key === '+' || e.key === '=') && e.ctrlKey && !isTyping) {
        e.preventDefault();
        const last = currentSale.items[currentSale.items.length - 1];
        if (last) {
          updateQuantity(last.product.id, last.quantity + 1);
        }
        return;
      }

      // Ctrl+-: disminuir cantidad del ÃƒÂºltimo ÃƒÂ­tem
      if (e.key === '-' && e.ctrlKey && !isTyping) {
        e.preventDefault();
        const last = currentSale.items[currentSale.items.length - 1];
        if (last) {
          updateQuantity(last.product.id, Math.max(1, last.quantity - 1));
        }
        return;
      }

      // NavegaciÃƒÂ³n por grid de productos con flechas y Enter
      const cols = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
      if (!isTyping && paginatedProducts.length > 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedProductIndex(null);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedProductIndex((idx) => {
            const next = (idx ?? -1) + 1;
            return Math.min(next, paginatedProducts.length - 1);
          });
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSelectedProductIndex((idx) => {
            const prev = (idx ?? paginatedProducts.length) - 1;
            return Math.max(prev, 0);
          });
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedProductIndex((idx) => {
            const base = (idx ?? -cols) + cols;
            return Math.min(base, paginatedProducts.length - 1);
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedProductIndex((idx) => {
            const base = (idx ?? cols) - cols;
            return Math.max(base, 0);
          });
          return;
        }
        if (e.key === 'Enter' && selectedProductIndex !== null) {
          e.preventDefault();
          const prod = paginatedProducts[selectedProductIndex];
          if (prod && prod.stock > 0) {
            addToSale(prod);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSale.items, processing, paginatedProducts, selectedProductIndex, addToSale, updateQuantity, clearSale]);

  // Asegurar que el ÃƒÂ­ndice seleccionado sea vÃƒÂ¡lido al cambiar la paginaciÃƒÂ³n
  useEffect(() => {
    setSelectedProductIndex((idx) => {
      if (idx === null) return null;
      if (idx >= paginatedProducts.length) return paginatedProducts.length > 0 ? paginatedProducts.length - 1 : null;
      return idx;
    });
  }, [paginatedProducts]);

  // Funciones de datos
  // (fetchInitialData) se define más abajo, después de declarar las funciones usadas

  const fetchProducts = useCallback(async () => {
    try {
      const { isOffline } = useOfflineStore.getState();
      if (isOffline) {
        const { products: storeProducts } = useProductsStore.getState();
        const data = Array.isArray(storeProducts) ? storeProducts : [];
        setProducts(data);
        showWarning('Sin conexión. Mostrando productos guardados localmente');
        return;
      }
      await initializeApiBaseUrl();
      const response = await api.get('/products', { __suppressGlobalError: true, headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' } } as unknown as AxiosRequestConfig);
      // Zod: esquema flexible de producto
      const ProductSchema = z.object({
        id: z.string(),
        name: z.string(),
        price: z.number().optional().nullable(),
        stock: z.number().int().nonnegative(),
        minStock: z.number().int().optional().default(0),
        barcode: z.string().optional(),
        category: z.union([z.string(), z.object({ id: z.string().optional(), name: z.string().optional() }).passthrough()]).optional(),
        brand: z.string().optional(),
        weight: z.number().optional(),
        material: z.string().optional(),
        images: z.array(z.string()).optional(),
        isActive: z.boolean().optional().default(true),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
      }).passthrough();
      const parsed = parsePaginatedResponse(response.data, ProductSchema);
      const productsData = (parsed.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        salePrice: typeof p.salePrice === 'number' ? p.salePrice : Number(p.price ?? p.costPrice ?? 0),
        stock: Number(p.stock ?? 0),
        minStock: Number(p.minStock ?? 0),
        barcode: p.barcode ?? undefined,
        category: p.category ?? undefined,
        brand: p.brand ?? undefined,
        weight: typeof p.weight === 'number' ? p.weight : undefined,
        material: p.material ?? undefined,
        images: Array.isArray(p.images) ? p.images : undefined,
        isActive: p.isActive ?? true,
        createdAt: p.createdAt ?? new Date().toISOString(),
        updatedAt: p.updatedAt ?? new Date().toISOString(),
      })) as Product[];
      const { products: storeProducts } = useProductsStore.getState();
      const cacheFallback = Array.isArray(storeProducts) ? storeProducts : [];
      const data = Array.isArray(productsData) ? productsData : [];
      if (data.length === 0 && cacheFallback.length > 0) {
        // Homologar comportamiento: si servidor devuelve vacío, usar caché persistida
        setProducts(cacheFallback);
        showWarning('Servidor devolvió lista vacía. Usando productos del caché local');
      } else {
        setProducts(data);
      }
    } catch (error) {
      console.warn('Error fetching products:', error);
      const { products: storeProducts } = useProductsStore.getState();
      const data = Array.isArray(storeProducts) ? storeProducts : [];
      if (data.length > 0) {
        setProducts(data);
        showWarning('Mostrando productos guardados localmente');
      } else {
        setProducts([]);
        showWarning('No se pudieron cargar productos del servidor');
      }
    }
  }, [showWarning]);

  const fetchClients = useCallback(async () => {
    try {
      // Evitar llamadas protegidas si no hay sesión iniciada
      const { isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        const { clients: storeClients } = useClientsStore.getState();
        const data = Array.isArray(storeClients) ? storeClients : [];
        setClients(data);
        showWarning('No autenticado. Inicia sesión para cargar clientes');
        return;
      }
      const { isOffline } = useOfflineStore.getState();
      if (isOffline) {
        const { clients: storeClients } = useClientsStore.getState();
        const data = Array.isArray(storeClients) ? storeClients : [];
        setClients(data);
        showWarning('Sin conexión. Mostrando clientes guardados localmente');
        return;
      }
      await initializeApiBaseUrl();
      const response = await api.get('/clients', { __suppressGlobalError: true } as unknown as AxiosRequestConfig);
      const clientsData = Array.isArray(response.data)
        ? response.data
        : (response.data?.data ?? response.data ?? []);

      setClients(clientsData);
    } catch (error) {
      console.warn('Error fetching clients:', error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Si el token es inválido o la sesión expiró, cerrar sesión y redirigir
        const auth = useAuthStore.getState();
        auth.logout();
        showWarning('Sesión expirada. Por favor inicia sesión nuevamente');
        
        // Guardar borrador antes de redirigir
        try {
          const serializable = {
            items: currentSale.items.map(i => ({
              productId: i.product.id,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
            })),
            paymentMethod: currentSale.paymentMethod,
            client: currentSale.client ? {
              id: currentSale.client.id,
              firstName: currentSale.client.firstName,
              lastName: currentSale.client.lastName,
            } : undefined,
            cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
            paymentDetails,
            saleType: saleType,
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
          
          // Confirmar con usuario antes de perder datos
          if (window.confirm('Su sesión ha expirado. ¿Desea guardar su venta actual antes de salir?')) {
            window.location.href = '/login';
          }
        } catch {
          window.location.href = '/login';
        }
        return;
      }
      const { isOffline } = useOfflineStore.getState();
      if (isOffline) {
        const { clients: storeClients } = useClientsStore.getState();
        const data = Array.isArray(storeClients) ? storeClients : [];
        setClients(data);
        showWarning('Sin conexión. Mostrando clientes guardados localmente');
      } else {
        setClients([]);
        showWarning('No se pudieron cargar clientes del servidor');
      }
    }
  }, [showWarning]);

  const fetchSales = useCallback(async () => {
    try {
      // Evitar llamadas protegidas si no hay sesión iniciada
      const { isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        setSales([]);
        showWarning('No autenticado. Inicia sesión para cargar ventas');
        return;
      }
      const { isOffline } = useOfflineStore.getState();
      if (isOffline) {
        // No hay store de ventas: mantener vacío y avisar modo offline
        setSales([]);
        showWarning('Sin conexión. Ventas no disponibles en modo offline');
        return;
      }
      await initializeApiBaseUrl();
      const maxRetries = 2;
      let attempt = 0;
      let response: AxiosResponse<unknown> | undefined;
      while (attempt <= maxRetries) {
        try {
          response = await api.get('/sales', { __suppressGlobalError: true } as unknown as AxiosRequestConfig);
          break;
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403) throw err;
          if (attempt >= maxRetries) throw err;
          const delay = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
          attempt += 1;
          await new Promise((res) => setTimeout(res, delay));
        }
      }

      const payload = response?.data as any;
      const salesData = normalizeListPayload<Sale>(payload);
      setSales(salesData);
    } catch (error: unknown) {
      console.error('Error fetching sales:', error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Alinear comportamiento con interceptor global cuando está suprimido
        const auth = useAuthStore.getState();
        auth.logout();
        showWarning('Sesión expirada. Por favor inicia sesión nuevamente');
        
        // Guardar borrador antes de redirigir
        try {
          const serializable = {
            items: currentSale.items.map(i => ({
              productId: i.product.id,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
            })),
            paymentMethod: currentSale.paymentMethod,
            client: currentSale.client ? {
              id: currentSale.client.id,
              firstName: currentSale.client.firstName,
              lastName: currentSale.client.lastName,
            } : undefined,
            cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
            paymentDetails,
            saleType: saleType,
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
          
          // Confirmar con usuario antes de perder datos
          if (window.confirm('Su sesión ha expirado. ¿Desea guardar su venta actual antes de salir?')) {
            window.location.href = '/login';
          }
        } catch {
          window.location.href = '/login';
        }
        return;
      }
      setSales([]);
      const serverMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showError('Error al cargar las ventas', serverMsg || 'Verifique su conexión.');
    }
  }, [showWarning, showError]);

  const fetchAgencies = useCallback(async () => {
    try {
      const agencies = await AgencyService.getActiveAgencies();
      setAgencies(agencies);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      setAgencies([]);
    }
  }, []);

  const fetchGuides = useCallback(async () => {
    try {
      const guides = await GuideService.getActiveGuides();
      const uniqueGuides = Array.from(new Map(guides.map(g => [g.id, g])).values());
      setGuides(uniqueGuides);
    } catch (error) {
      console.error('Error fetching guides:', error);
      setGuides([]);
    }
  }, []);

  // Definir fetchInitialData DESPUÉS de las dependencias que usa para evitar "used before assignment"
  const fetchInitialData = useCallback(async () => {
    try {
      if (testMode) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await initializeApiBaseUrl();
      await Promise.all([
        fetchProducts(),
        fetchClients(),
        fetchSales(),
        fetchAgencies(),
        fetchGuides(),
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showError('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
    }
  }, [testMode, showError, fetchProducts, fetchClients, fetchSales, fetchAgencies, fetchGuides]);

  // Inicialización: ejecutar una vez (declarado tras definir fetchInitialData)
  useEffect(() => {
    if (didInitRef.current) return; // Evitar doble ejecución en StrictMode
    didInitRef.current = true;
    fetchInitialData();
  }, [fetchInitialData]);

  const refreshData = async () => {
    if (testMode) return;
    setRefreshing(true);
    await fetchInitialData();
    setRefreshing(false);
    showSuccess('Datos actualizados correctamente');
  };

  // Funciones de filtrado
  const filterProducts = useCallback(() => {
    let filtered = products.filter(product => product.isActive);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.barcode?.includes(term) ||
        (
          typeof product.category === 'string'
            ? product.category.toLowerCase().includes(term)
            : (product.category?.name || '').toLowerCase().includes(term)
        ) ||
        product.brand?.toLowerCase().includes(term)
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(product => {
        const cat = product.category;
        if (!cat) return false;
        return typeof cat === 'string' ? cat === categoryFilter : (cat.name || '') === categoryFilter;
      });
    }

    if (onlyLowStock) {
      filtered = filtered.filter(product => product.stock > 0 && product.stock <= Math.max(0, product.minStock || 0));
    }

    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, onlyLowStock, products]);

  // Efecto de filtrado de productos
  useEffect(() => {
    const t = setTimeout(() => {
      filterProducts();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm, categoryFilter, products, filterProducts]);

  const filterSales = useCallback(() => {
    let filtered = [...sales];

    const min = salesFilters.minAmount;
    const max = salesFilters.maxAmount;
    const invalidRange = (min !== undefined && max !== undefined && max < min);

    if (salesFilters.dateFrom) {
      filtered = filtered.filter(sale => 
        new Date(sale.saleDate || '') >= new Date(salesFilters.dateFrom!)
      );
    }

    if (salesFilters.dateTo) {
      filtered = filtered.filter(sale => 
        new Date(sale.saleDate || '') <= new Date(salesFilters.dateTo!)
      );
    }

    if (salesFilters.clientId) {
      filtered = filtered.filter(sale => sale.client?.id === salesFilters.clientId);
    }

    if (salesFilters.status) {
      filtered = filtered.filter(sale => sale.status === salesFilters.status);
    }

    if (salesFilters.paymentMethod) {
      filtered = filtered.filter(sale => sale.paymentMethod === salesFilters.paymentMethod);
    }

    if (!invalidRange && min !== undefined) {
      filtered = filtered.filter(sale => sale.total >= min!);
    }

    if (!invalidRange && max !== undefined) {
      filtered = filtered.filter(sale => sale.total <= max!);
    }

    // Filtro: ventas con referencia de pago
    if (salesFilters.hasReference) {
      filtered = filtered.filter(sale => !!(sale.cardReference || sale.transferReference));
    }

    // Búsqueda por texto en referencias de pago
    if (salesFilters.referenceQuery && salesFilters.referenceQuery.trim()) {
      const term = salesFilters.referenceQuery.trim().toLowerCase();
      filtered = filtered.filter(sale =>
        (sale.cardReference || '').toLowerCase().includes(term) ||
        (sale.transferReference || '').toLowerCase().includes(term)
      );
    }

    setFilteredSales(filtered);
  }, [salesFilters, sales]);

  // Efecto de filtrado de ventas
  useEffect(() => {
    const t = setTimeout(() => {
      filterSales();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [salesFilters, sales, filterSales]);

  // Funciones de cálculo
  const calculateTotals = useCallback(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const subtotal = currentSale.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = currentSale.items.reduce((sum, item) => sum + item.discountAmount, 0);
    const taxableAmount = subtotal - discountAmount;
    const effectiveRate = applyTax ? taxRate : 0;
    const taxAmount = round2(taxableAmount * effectiveRate);
    const total = round2(taxableAmount + taxAmount);

    setCurrentSale(prev => ({
      ...prev,
      subtotal: round2(subtotal),
      discountAmount: round2(discountAmount),
      taxAmount,
      total,
    }));
  }, [currentSale.items, applyTax, taxRate]);

  // Efecto de cálculo de totales
  useEffect(() => {
    calculateTotals();
  }, [currentSale.items, applyTax, taxRate, calculateTotals]);

  // Commission calculators mirroring backend logic
  const computeAgencyCommission = useCallback((saleTotal: number): number => {
    if (!selectedAgency || !saleTotal) return 0;
    const rate = Number(selectedAgency.commissionRate || 0);
    return saleTotal * (rate / 100);
  }, [selectedAgency]);

  const computeGuideCommission = useCallback((saleTotal: number): number => {
    if (!selectedGuide || !saleTotal) return 0;
    const formula = selectedGuide.commissionFormula || 'DISCOUNT_PERCENTAGE';
    const rate = Number(selectedGuide.commissionRate || 0);
    const discount = Number(selectedGuide.discountPercentage || 0);
    if (formula === 'DIRECT') {
      return saleTotal * (rate / 100);
    } else {
      const afterDiscount = saleTotal * (1 - discount / 100);
      return afterDiscount * (rate / 100);
    }
  }, [selectedGuide]);

  const computeEmployeeCommission = useCallback((saleTotal: number): number => {
    if (!selectedEmployee || !saleTotal) return 0;
    const formula = selectedEmployee.commissionFormula || 'DISCOUNT_PERCENTAGE';
    const discount = Number(selectedEmployee.discountPercentage || 0);

    // Street sale: use specific card/cash rates depending on payment method
    if ((saleType || 'STREET') === 'STREET') {
      const isCard = currentSale.paymentMethod === 'card';
      const rate = Number(isCard ? selectedEmployee.streetSaleCardRate || 0 : selectedEmployee.streetSaleCashRate || 0);
      if (rate <= 0) return 0;
      if (formula === 'DIRECT') {
        return saleTotal * (rate / 100);
      } else {
        const afterDiscount = saleTotal * (1 - discount / 100);
        return afterDiscount * (rate / 100);
      }
    }

    // Guide sale: use general commissionRate
    const rate = Number(selectedEmployee.commissionRate || 0);
    if (rate <= 0) return 0;
    if (formula === 'DIRECT') {
      return saleTotal * (rate / 100);
    } else {
      const afterDiscount = saleTotal * (1 - discount / 100);
      return afterDiscount * (rate / 100);
    }
  }, [selectedEmployee, saleType, currentSale.paymentMethod]);

  const calculateItemTotal = useCallback((item: SaleItem): SaleItem => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const subtotal = round2(item.quantity * item.unitPrice);
    const discountAmount = round2(subtotal * (item.discount / 100));
    const total = round2(subtotal - discountAmount);

    return {
      ...item,
      subtotal,
      discountAmount,
      total,
    };
  }, []);

  // Funciones de venta
  function addToSale(product: Product) {
    if (product.stock <= 0) {
      showError('Producto sin stock disponible');
      return;
    }
    
    // Mostrar indicador de carga temporal para efecto visual
    const tempId = `adding-${product.id}-${Date.now()}`;
    setProcessing(true);
    
    setTimeout(() => {
      setCurrentSale(prev => {
        const existingItemIndex = prev.items.findIndex(item => item.product.id === product.id);
        if (existingItemIndex >= 0) {
          const updatedItems = [...prev.items];
          const currentQuantity = updatedItems[existingItemIndex].quantity;
          if (currentQuantity >= product.stock) {
            showError('No hay suficiente stock disponible');
            setProcessing(false);
            return prev;
          }
          updatedItems[existingItemIndex] = calculateItemTotal({
            ...updatedItems[existingItemIndex],
            quantity: currentQuantity + 1,
          });
          return { ...prev, items: updatedItems };
        } else {
          const newItem: SaleItem = calculateItemTotal({
            product,
            quantity: 1,
            unitPrice: Number(product.salePrice ?? 0),
            discount: 0,
            discountAmount: 0,
            subtotal: 0,
            total: 0,
          });
          return { ...prev, items: [...prev.items, newItem] };
        }
      });

      setProcessing(false);
      
      // Llamada a la API para registrar el item en el carrito (para auditoría)
      try {
        api.post('/sales/items', {
          productId: product.id,
          quantity: 1,
          unitPrice: Number(product.salePrice ?? 0),
          timestamp: new Date().toISOString()
        }).catch(error => {
          // Silencioso: no interrumpir la experiencia del usuario si falla
          console.debug('Error al registrar item en carrito:', error);
        });
      } catch (error) {
        console.debug('Error al registrar item en carrito:', error);
      }
      
      // Notificación con detalles específicos para la auditoría
      const newQuantity = currentSale.items.find(item => item.product.id === product.id)?.quantity || 1;
      const totalItems = currentSale.items.length + (currentSale.items.find(item => item.product.id === product.id) ? 0 : 1);
      
      showSuccess(
        `${product.name} (${product.sku || product.id}) agregado al carrito`,
        `Cantidad: ${newQuantity} | Total items: ${totalItems} | Stock restante: ${product.stock - newQuantity}`
      );
    }, 100); // Pequeño retraso para efecto visual (reducido para auditoría)
  }

  function updateQuantity(productId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      removeFromSale(productId);
      return;
    }
    setCurrentSale(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.product.id === productId) {
          if (newQuantity > item.product.stock) {
            showError('No hay suficiente stock disponible');
            return item;
          }
          return calculateItemTotal({
            ...item,
            quantity: newQuantity,
          });
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  }

  // Presets de margen para establecer precio unitario rápidamente
  function applyMarginPreset(productId: string, marginPct: number) {
    const item = currentSale.items.find(i => i.product.id === productId);
    if (!item) return;
    const baseCost = Number(item.product.salePrice ?? 0);
    const computed = Number((baseCost * (1 + marginPct / 100)).toFixed(2));
    updateUnitPrice(productId, computed);
    if (computed < baseCost) {
      showWarning('Precio con margen menor al costo');
    }
  }

  function updateDiscount(productId: string, discount: number) {
    const updatedItems = currentSale.items.map(item => {
      if (item.product.id !== productId) return item;
      const isDiscountable = item.product.discountable ?? true;
      if (!isDiscountable && discount > 0) {
        showError('Este producto no admite descuentos');
        return item;
      }
      const maxAllowed = getItemMaxDiscountPercent(item);
      const normalized = Math.max(0, Math.min(maxAllowed, Number(discount) || 0));
      if (discount > maxAllowed) {
        showWarning(`Descuento limitado al máximo permitido (${maxAllowed}%)`);
      }
      return calculateItemTotal({
        ...item,
        discount: normalized,
      });
    });

    setCurrentSale(prev => ({ ...prev, items: updatedItems }));
  }

  // Actualizar precio unitario libre por ítem
  function updateUnitPrice(productId: string, newUnitPrice: number) {
    if (newUnitPrice < 0) {
      showError('El precio no puede ser negativo');
      return;
    }

    const updatedItems = currentSale.items.map(item => {
      if (item.product.id === productId) {
        return calculateItemTotal({
          ...item,
          unitPrice: newUnitPrice,
        });
      }
      return item;
    });

    setCurrentSale(prev => ({ ...prev, items: updatedItems }));
  }

  function removeFromSale(productId: string) {
    setCurrentSale(prev => {
      const updatedItems = prev.items.filter(item => item.product.id !== productId);
      return { ...prev, items: updatedItems };
    });
    showSuccess('Producto removido de la venta');
  }

  function clearSale() {
    // Solo limpiar si hay algo que limpiar
    if (currentSale.items.length === 0 && !currentSale.client && !cashReceived) {
      showWarning('No hay venta actual para limpiar');
      return;
    }
    
    // Confirmar con usuario antes de limpiar
    if (window.confirm('¿Está seguro de limpiar la venta actual? Esta acción no se puede deshacer.')) {
      setCurrentSale({
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: 0,
        paymentMethod: 'cash',
        status: 'pending',
        saleType: 'STREET',
      });
      setPaymentDetails({});
      setCashReceived('');
      setSaleType('STREET');
      setSelectedAgency(null);
      setSelectedGuide(null);
      try { localStorage.removeItem(DRAFT_KEY); } catch { void 0; }
      showSuccess('Venta limpiada exitosamente');
    }
  }

  // Funciones de cliente
  const selectClient = (client: Client) => {
    setCurrentSale(prev => ({ ...prev, client }));
    setShowClientModal(false);
    showSuccess(`Cliente ${client.firstName} ${client.lastName} seleccionado`);
  };

  const createNewClient = async () => {
    if (!newClient.firstName || !newClient.lastName) {
      showError('Nombre y apellido son requeridos');
      return;
    }

    // Guardar estado actual por si hay error
    const backupKey = `${DRAFT_KEY}:backup:${Date.now()}`;
    try {
      const serializable = {
        items: currentSale.items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        paymentMethod: currentSale.paymentMethod,
        client: currentSale.client,
        cashReceived,
        paymentDetails,
        saleType: saleType,
        agencyId: selectedAgency?.id,
        guideId: selectedGuide?.id,
        employeeId: selectedEmployee?.id,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(backupKey, JSON.stringify(serializable));
    } catch { void 0; }

    try {
      setProcessing(true);
      // Validación venta con guía
      if (saleType === 'GUIDE') {
        if (!selectedAgency) {
          showError('Seleccione una agencia para la venta con guía');
          setProcessing(false);
          return;
        }
        if (!selectedGuide) {
          showError('Seleccione un guía para la venta con guía');
          setProcessing(false);
          return;
        }
      }
      // Sanitizar y completar payload requerido por backend
      const sanitizeString = (v?: string) => {
        const t = (v ?? '').trim();
        return t.length > 0 ? t : undefined;
      };
      const payload = {
        code: `CLI${Date.now().toString(36).toUpperCase()}`,
        firstName: newClient.firstName.trim(),
        lastName: newClient.lastName.trim(),
        email: sanitizeString(newClient.email),
        phone: sanitizeString(newClient.phone),
        address: sanitizeString(newClient.address),
        city: sanitizeString(newClient.city),
      };
      const response = await api.post('/clients', payload);
      
      if (response.data.success) {
        const createdClient = response.data.data;
        setClients(prev => [...prev, createdClient]);
        selectClient(createdClient);
        setNewClient({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          customerType: 'regular',
        });
        setShowNewClientModal(false);
        showSuccess('Cliente creado exitosamente');
      }
    } catch (error) {
      console.error('Error creating client:', error);
      showError('Error al crear el cliente');
    } finally {
      setProcessing(false);
    }
  };

  // Funciones de pago
  const processSale = async () => {
    if (currentSale.items.length === 0) {
      showError('Agregue productos a la venta');
      return;
    }

    // Validación de precio unitario establecido
    const invalidPriceItems = currentSale.items.filter(i => i.unitPrice <= 0);
    if (invalidPriceItems.length > 0) {
      showError('Ingrese un precio válido (> 0) para todos los productos');
      return;
    }

    // Aviso suave si hay ítems con precio menor al costo
    const belowCostItems = currentSale.items.filter(i => i.unitPrice > 0 && i.unitPrice < Number(i.product.salePrice ?? 0));
    if (belowCostItems.length > 0) {
      showWarning('Algunos productos tienen precio menor al costo');
    }

    // Reglas reforzadas de descuento por ítem
    // Unificar validación: rango permitido por rol/producto, valores finitos y que el descuento no exceda el subtotal
    const discountIssues = currentSale.items.filter(i => {
      const d = Number(i.discount);
      const maxAllowed = getItemMaxDiscountPercent(i);
      const invalidRange = !isFinite(d) || d < 0 || d > maxAllowed;
      const exceedsSubtotal = (i.discountAmount - i.subtotal) > 0.01;
      const productBlocks = (i.product.discountable === false) && d > 0;
      return invalidRange || exceedsSubtotal || productBlocks;
    });
    if (discountIssues.length > 0) {
      const names = discountIssues.map(i => i.product.name).join(', ');
      showError(`Descuento inválido para: ${names}. Debe ser finito, entre 0% y el máximo permitido por rol/producto, y no exceder el subtotal.`);
      return;
    }

    // Motivo de descuento corporativo obligatorio cuando hay descuentos por ítem
    if (currentSale.items.some(i => Number(i.discount) > 0)) {
      const reason = String(discountReason || '').trim();
      if (reason.length === 0) {
        showError('Seleccione el motivo del descuento');
        return;
      }
    }

    // Revalidación de stock y valores antes de confirmar
    const stockIssues = currentSale.items.filter(i => Number(i.quantity) > Number(i.product.stock));
    if (stockIssues.length > 0) {
      const names = stockIssues.map(i => i.product.name).join(', ');
      showError(`Stock insuficiente para: ${names}`);
      return;
    }

    const valueIssues = currentSale.items.filter(i => !isFinite(Number(i.unitPrice)) || Number(i.unitPrice) < 0 || !isFinite(Number(i.quantity)) || Number(i.quantity) <= 0);
    if (valueIssues.length > 0) {
      showError('Revise cantidad (>0) y precio unitario (>=0) en todos los ítems');
      return;
    }

    // (Validación de descuento ya realizada arriba)

    // Normalizar y recalcular totales por ítem para el payload
    const normalizedItems = currentSale.items.map(i => calculateItemTotal({
      ...i,
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      discount: Number(i.discount) || 0,
    }));

    if (currentSale.paymentMethod === 'cash' && !cashReceived) {
      showError('Ingrese el monto recibido en efectivo');
      return;
    }

    if (currentSale.paymentMethod === 'cash') {
      const received = parseFloat(cashReceived);
      if (received < currentSale.total) {
        showError('El monto recibido es insuficiente');
        return;
      }
      setCurrentSale(prev => ({
        ...prev,
        cashReceived: received,
        change: received - currentSale.total,
      }));
    }

    // Validación de pago mixto
    if (currentSale.paymentMethod === 'mixed') {
      const cash = Number(paymentDetails.cash || 0);
      const card = Number(paymentDetails.card || 0);
      const transfer = Number(paymentDetails.transfer || 0);
      const totalPaid = Math.round((cash + card + transfer) * 100) / 100;
      const diff = Math.round((currentSale.total - totalPaid) * 100) / 100;
      if (Math.abs(diff) > 0.01) {
        showError(`El pago mixto debe igualar el total. Diferencia: ${diff.toLocaleString()}`);
        return;
      }
      if (card > 0 && !String(paymentDetails.cardReference || '').trim()) {
        showError('Ingrese referencia de tarjeta para el monto en tarjeta');
        return;
      }
      if (transfer > 0 && !String(paymentDetails.transferReference || '').trim()) {
        showError('Ingrese referencia de transferencia para el monto en transferencia');
        return;
      }
    }

    try {
      setProcessing(true);
      // Validación venta con guía
      if (saleType === 'GUIDE') {
        if (!selectedAgency) {
          showError('Seleccione una agencia para la venta con guía');
          setProcessing(false);
          return;
        }
        if (!selectedGuide) {
          showError('Seleccione un guía para la venta con guía');
          setProcessing(false);
          return;
        }
        if (!selectedEmployee) {
          showError('Seleccione un vendedor para la venta con guía');
          setProcessing(false);
          return;
        }
      }
      
      const agencyCommission = saleType === 'GUIDE' ? computeAgencyCommission(currentSale.total) : 0;
      const guideCommission = saleType === 'GUIDE' ? computeGuideCommission(currentSale.total) : 0;
      const employeeCommission = computeEmployeeCommission(currentSale.total);

      const saleData = {
        items: normalizedItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount ?? 0,
        })),
        clientId: currentSale.client?.id,
        paymentMethod: currentSale.paymentMethod,
        // Consolidar motivo corporativo con notas libres
        notes: [String(discountReason || '').trim() || undefined, String(currentSale.notes || '').trim() || undefined]
          .filter(Boolean)
          .join(' | ') || undefined,
        // Referencias de pago según método seleccionado
        cardReference: (
          currentSale.paymentMethod === 'card'
            ? (singlePaymentReference || '').trim() || undefined
            : (currentSale.paymentMethod === 'mixed' && Number(paymentDetails.card || 0) > 0)
              ? (paymentDetails.cardReference || '').trim() || undefined
              : undefined
        ),
        transferReference: (
          currentSale.paymentMethod === 'transfer'
            ? (singlePaymentReference || '').trim() || undefined
            : (currentSale.paymentMethod === 'mixed' && Number(paymentDetails.transfer || 0) > 0)
              ? (paymentDetails.transferReference || '').trim() || undefined
              : undefined
        ),
        // Datos del sistema de turismo
        saleType: saleType,
        agencyId: saleType === 'GUIDE' ? selectedAgency?.id : undefined,
        guideId: saleType === 'GUIDE' ? selectedGuide?.id : undefined,
        employeeId: saleType === 'GUIDE' ? selectedEmployee?.id : undefined,
        // Comisiones calculadas
        agencyCommission,
        guideCommission,
        employeeCommission,
      };

      // Validación con Zod para asegurar compatibilidad con backend
      const parsed = createSaleSchema.safeParse(saleData);
      if (!parsed.success) {
        const issue = parsed.error.issues?.[0];
        showError(issue?.message || 'Datos de venta inválidos');
        setProcessing(false);
        return;
      }
      const validatedSale = parsed.data;

      if (isOffline) {
        // Asignar Idempotency-Key para ventas con guía en modo offline
        const idem = saleType === 'GUIDE' ? (
          globalThis.crypto?.randomUUID?.() ||
          `GUIDE-${Date.now()}-${getStableKey(selectedAgency?.id, selectedGuide?.id, selectedEmployee?.id, currentSale.total, currentSale.items.length)}`
        ) : undefined;
        const offlineData = idem ? { ...validatedSale, idempotencyKey: idem } : validatedSale;
        addPendingAction({ type: 'CREATE_SALE', data: offlineData, priority: 'high', maxRetries: 5 });
        // Disparar evento también en modo offline para refrescar vistas con datos locales/estimados
        try {
          window.dispatchEvent(new CustomEvent('sale:created', { detail: offlineData }));
        } catch { void 0; }
        showSuccess(`Venta guardada en cola offline - Total: $${currentSale.total.toLocaleString()}`);
        setShowPaymentModal(false);
        clearSale();
        setProcessing(false);
        return;
      }
      let responseData: { success: boolean; data: Sale };
      if (saleType === 'GUIDE') {
        const idem = (
          globalThis.crypto?.randomUUID?.() ||
          `GUIDE-${Date.now()}-${getStableKey(selectedAgency?.id, selectedGuide?.id, selectedEmployee?.id, currentSale.total, currentSale.items.length)}`
        );
        const resp = await SalesService.createSale({ ...validatedSale, saleType: 'GUIDE' }, idem);
        responseData = { success: true, data: resp as Sale };
      } else {
        const resp = await SalesService.createSale(validatedSale);
        responseData = { success: true, data: resp as Sale };
      }

      if (responseData.success) {
        const newSale = responseData.data;
        setSales(prev => [newSale, ...prev]);
        
        // Actualizar stock de productos
        await fetchProducts();
        
        // Notificar globalmente que se creó una venta para refrescar Dashboard/Reportes
        try {
          window.dispatchEvent(new CustomEvent('sale:created', { detail: newSale }));
        } catch { void 0; }

        // Notificación detallada con información específica para auditoría
        const itemsCount = newSale.items?.length || 0;
        const paymentMethod = newSale.paymentMethod === 'cash' ? 'Efectivo' : 
                             newSale.paymentMethod === 'card' ? 'Tarjeta' : 
                             newSale.paymentMethod === 'transfer' ? 'Transferencia' : 'Mixto';
        
        showSuccess(
          `Venta #${newSale.id} procesada exitosamente`,
          `Total: $${newSale.total.toLocaleString()} | Items: ${itemsCount} | Pago: ${paymentMethod} | Cliente: ${newSale.client?.firstName || 'N/A'}`
        );
        
        // ÉXITO: limpiar backup y borrador
        try {
          // Limpiar cualquier backup de ventas
          const keys = Object.keys(localStorage).filter(key => key.startsWith(`${DRAFT_KEY}:backup:`));
          keys.forEach(key => localStorage.removeItem(key));
          localStorage.removeItem(DRAFT_KEY);
        } catch { void 0; }
        
        setShowPaymentModal(false);
        clearSale();
        
        // Mostrar opción de imprimir ticket (id puede ser opcional)
        if (window.confirm('¿Desea imprimir el ticket de venta?')) {
          if (newSale.id) {
            await printTicket(newSale.id);
            console.log('Ticket generado: El ticket se ha descargado exitosamente');
          }
        }
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      showError('Error al procesar la venta. Su carrito ha sido guardado y puede recuperarlo.');
      
      // Ofrecer recuperación
      if (window.confirm('¿Desea recuperar su venta del carrito? Los datos se restaurarán.')) {
        try {
          const keys = Object.keys(localStorage).filter(key => key.startsWith(`${DRAFT_KEY}:backup:`));
          const latestBackup = keys.sort().pop();
          const backup = latestBackup ? localStorage.getItem(latestBackup) : null;
          if (backup) {
            localStorage.setItem(DRAFT_KEY, backup);
            window.location.reload(); // Recargar para restaurar
          }
        } catch { 
          showError('No se pudo recuperar la venta');
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const printTicket = async (saleId: string) => {
    try {
      console.log('Generando ticket: Preparando ticket de venta para descarga...');
      
      const response = await api.get(`/tickets/generate/${saleId}`, {
        responseType: 'blob',
        __suppressGlobalError: true,
      } as unknown as AxiosRequestConfig);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${saleId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      
  showSuccess('Ticket generado', `Ticket de venta #${saleId} descargado exitosamente`);
    } catch (error) {
      console.error('Error printing ticket:', error);
      showError('Error al generar el ticket');
    }
  };

  // Funciones de escÃƒÆ’Ã‚Â¡ner
  const handleMasterScan = async (code: string) => {
    // 1) Intentar producto local
    const product = products.find(p => 
      p.barcode === code || 
      p.id === code ||
      p.name.toLowerCase().includes(code.toLowerCase())
    );
    if (product) {
      if (product.stock > 0) {
        addToSale(product);
        setShowMasterScanner(false);
        showSuccess(`Producto agregado: ${product.name} - $${(product.salePrice || 0).toLocaleString()}`);
        return;
      } else {
        showError('Producto sin stock disponible');
        return;
      }
    }

    // 2) Consultar backend para entidades (guía / vendedor)
    const data = await scanEntityByCode(code);
    if (!data) return;
    const type = data.barcode?.type;
    if (type === 'GUIDE') {
      const guide = data.entity as Guide;
      if (selectedGuide && selectedGuide.id !== guide.id) {
        showWarning('Ya hay un guía seleccionado. Limpie la venta para cambiar.');
        return;
      }
      if (selectedGuide && selectedGuide.id === guide.id) {
        showWarning('Este guía ya está seleccionado');
        setShowMasterScanner(false);
        return;
      }
      setSelectedGuide(guide);
      const agency = (guide as Guide & { agency?: Agency })?.agency;
      if (agency) setSelectedAgency(agency);
      setSaleFlowTab('GUIDE');
      setCurrentSale(prev => ({
        ...prev,
        saleType: 'GUIDE',
        agencyId: agency?.id,
        guideId: guide.id,
      }));
      setShowMasterScanner(false);
      showSuccess(`Guía escaneado: ${guide.name} (${guide.code})`);
      return;
    }
    if (type === 'EMPLOYEE') {
      const employee = data.entity as Employee;
      // En STREET permitimos asignar vendedor sin guía. En GUIDE sí requerimos guía primero.
      if (saleType === 'GUIDE' && !selectedGuide) {
        showWarning('Escanee primero al guía');
        setShowMasterScanner(false);
        setShowScannerGuide(true);
        return;
      }
      if (selectedEmployee && selectedEmployee.id !== employee.id) {
        showWarning('Ya hay un vendedor seleccionado. Limpie la venta para cambiar.');
        return;
      }
      if (selectedEmployee && selectedEmployee.id === employee.id) {
        showWarning('Este vendedor ya está seleccionado');
        setShowMasterScanner(false);
        return;
      }
      setSelectedEmployee(employee);
      setCurrentSale(prev => ({
        ...prev,
        employeeId: employee.id,
        branchId: employee.branch?.id,
      }));
      setShowMasterScanner(false);
      showSuccess('Vendedor escaneado correctamente');
      return;
    }

    showError('Código no reconocido');
  };

  const handleScan = (scannedCode: string) => {
    const product = products.find(p => 
      p.barcode === scannedCode || 
      p.id === scannedCode ||
      p.name.toLowerCase().includes(scannedCode.toLowerCase())
    );

    if (product) {
      if (product.stock > 0) {
        addToSale(product);
        setShowScanner(false);
      } else {
        showError('Producto sin stock disponible');
      }
    } else {
      showError('Producto no encontrado');
    }
  };
  
  // Escaneo de códigos de guía y vendedor via backend
  const scanEntityByCode = async (code: string) => {
    try {
      await initializeApiBaseUrl();
      const res = await api.get(`/barcodes/scan/${encodeURIComponent(code)}`, { __suppressGlobalError: true } as unknown as AxiosRequestConfig);
      const data = res.data?.data ?? res.data;
      if (!res.data?.success && !data?.barcode) throw new Error('Código no reconocido');
      return data;
    } catch (error) {
      showError('Código no reconocido o inactivo');
      return null;
    }
  };

  const handleScanGuideEntity = async (code: string) => {
    const data = await scanEntityByCode(code);
    if (!data) return;
    if (data.barcode?.type !== 'GUIDE') {
      showWarning('El código escaneado no corresponde a un guía');
      return;
    }
    const guide = data.entity as Guide;
    if (selectedGuide && selectedGuide.id !== guide.id) {
      showWarning('Ya hay un guía seleccionado. Limpie la venta para cambiar.');
      return;
    }
    if (selectedGuide && selectedGuide.id === guide.id) {
      showWarning('Este guía ya está seleccionado');
      setShowScannerGuide(false);
      return;
    }
    setSelectedGuide(guide);
    const agency = (guide as Guide & { agency?: Agency }).agency;
    if (agency) setSelectedAgency(agency);
    setSaleFlowTab('GUIDE');
    setCurrentSale(prev => ({
      ...prev,
      saleType: 'GUIDE',
      agencyId: agency?.id,
      guideId: guide.id,
    }));
    setShowScannerGuide(false);
    showSuccess('Guía escaneado correctamente');
  };

  const handleScanEmployeeEntity = async (code: string) => {
    const data = await scanEntityByCode(code);
    if (!data) return;
    if (data.barcode?.type !== 'EMPLOYEE') {
      showWarning('El código escaneado no corresponde a un vendedor');
      return;
    }
    const employee = data.entity as Employee;
    if (!selectedGuide) {
      showWarning('Escanee primero al guía');
      setShowScannerGuide(true);
      return;
    }
    if (selectedEmployee && selectedEmployee.id !== employee.id) {
      showWarning('Ya hay un vendedor seleccionado. Limpie la venta para cambiar.');
      return;
    }
    if (selectedEmployee && selectedEmployee.id === employee.id) {
      showWarning('Este vendedor ya está seleccionado');
      setShowScannerEmployee(false);
      return;
    }
    setSelectedEmployee(employee);
    setCurrentSale(prev => ({
      ...prev,
      employeeId: employee.id,
      branchId: employee.branch?.id,
    }));
    setShowScannerEmployee(false);
    showSuccess('Vendedor escaneado correctamente');
  };

  // Funciones de anÃƒÆ’Ã‚Â¡lisis
  const salesAnalytics = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const todaySales = sales.filter(sale => 
      sale.saleDate?.startsWith(todayStr) && sale.status === 'completed'
    );

    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.saleDate || '');
      return saleDate.getMonth() === thisMonth && 
             saleDate.getFullYear() === thisYear && 
             sale.status === 'completed';
    });

    const totalToday = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const totalMonth = monthSales.reduce((sum, sale) => sum + sale.total, 0);
    const avgTicket = monthSales.length > 0 ? totalMonth / monthSales.length : 0;

    return {
      todaySales: todaySales.length,
      todayRevenue: totalToday,
      monthSales: monthSales.length,
      monthRevenue: totalMonth,
      avgTicket,
    };
  }, [sales]);

  // Categorías únicas para filtro (soporta category como objeto)
  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const p of products) {
      const c = p.category as unknown;
      if (!c) continue;
      const name = typeof c === 'string' ? c : (c as { name?: string }).name ?? '';
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-600">Gestión completa de ventas y transacciones</p>
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
                  {syncInProgress ? 'Sincronizando…' : `Sincronizar (${pendingActions.length})`}
                </button>
              </div>
            </div>
          </div>
          {/* Banner de estado degradado/caído */}
          {backendHealthMode !== 'ok' && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>
                    {backendHealthMode === 'down'
                      ? 'Servidor no disponible. Escrituras deshabilitadas temporalmente.'
                      : 'Modo degradado: escrituras críticas deshabilitadas temporalmente.'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {/* Chips de observabilidad para conteos rápidos */}
          {(() => {
            const salesCount = filteredSales.length;
            const itemsCount = filteredSales.reduce((acc, s) => acc + (Array.isArray(s.items) ? s.items.length : 0), 0);
            return (
              <div className="flex items-center gap-2 mr-2">
                <ObservabilityChip label="Ventas Totales" value={salesCount} warnKey="SALES_WARN_COUNT" critKey="SALES_CRIT_COUNT" />
                <ObservabilityChip label="Items" value={itemsCount} warnKey="SALEITEMS_WARN_COUNT" critKey="SALEITEMS_CRIT_COUNT" />
              </div>
            );
          })()}
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {pendingActions?.length > 0 && !isOffline && (
            <button
              onClick={async () => {
                try {
                  await syncPendingActions();
                  showSuccess('Sincronización', 'Acciones offline sincronizadas');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  showError('Error de sincronización', msg);
                }
              }}
              disabled={syncInProgress}
              className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={'h-4 w-4 mr-2 ' + (syncInProgress ? 'animate-spin' : '')} />
              {syncInProgress ? 'Sincronizando…' : 'Sincronizar (' + pendingActions.length + ')'}
            </button>
          )}
{isOffline && (
            <div className="flex items-center px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
              <AlertCircle className="h-4 w-4 mr-2" />
              Modo Offline
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'new-sale', label: 'Nueva Venta', icon: ShoppingCart },
            { id: 'guide-sale', label: 'Venta con Guía', icon: Users },
            { id: 'sales-history', label: 'Historial', icon: History },
            { id: 'analytics', label: 'Análisis', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'new-sale' | 'guide-sale' | 'sales-history' | 'analytics')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'new-sale' && (
        <div className="space-y-4">
          {/* Sticky Top Bar: Search + Filters + Quick Actions */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
            <div className="px-4 py-3">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex-1" ref={searchRef}>
                  <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Buscar productos por nombre, código o categoría..."
                    className="w-full"
                    dataTestId="sales-search-input"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    data-testid="sales-category-filter"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((categoryName) => (
                      <option key={categoryName} value={categoryName}>{categoryName}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowMasterScanner(true)}
                    data-testid="sales-scan-button"
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Escáner Maestro
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Atajos: F2 Escáner Maestro, F9 Procesar, Ctrl+Supr Limpiar venta
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 md:gap-6 mt-4">
            {/* Context & Scan (Left Column) */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
              {/* Context Panel */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Contexto y Escaneo</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setShowMasterScanner(true)}
                      className="flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Escáner Maestro
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="p-2 rounded border bg-indigo-50 border-indigo-200">
                      <div className="text-xs text-indigo-700">Vendedor</div>
                      <div className="text-sm font-medium text-indigo-900">
                        {selectedEmployee ? selectedEmployee.name : 'Sin vendedor seleccionado'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            
            </div>

            {/* Products Section (Center Column) */}
            <div className="col-span-12 lg:col-span-6 space-y-4">
              {/* Products Grid */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Productos ({filteredProducts.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Por página</label>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={pageSize}
                      onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={onlyLowStock}
                        onChange={(e) => { setPage(1); setOnlyLowStock(e.target.checked); }}
                      />
                      Solo bajo stock
                    </label>
                    <button
                      className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Anterior
                    </button>
<span className="text-sm text-gray-600">{page} / {totalPages}</span>
                  <button
                    className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Siguiente
                  </button>
</div>
              </div>
              <div className="p-3 sm:p-4">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No se encontraron productos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className={`group border rounded-xl p-2.5 cursor-pointer transition hover:shadow ${
                          product.stock <= 0 
                            ? 'bg-gray-50 border-gray-200 opacity-60' 
                            : product.stock <= product.minStock
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-white border-gray-200 group-hover:border-blue-300'
                        } ${selectedProductIndex === index ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                        onClick={() => product.stock > 0 && addToSale(product)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                            {product.name}
                          </h4>
                          {product.stock <= 0 && (
                            <span
                              className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                              title="No disponible"
                            >
                              Sin stock
                            </span>
                          )}
                          {product.stock > 0 && product.stock <= product.minStock && (
                            <span
                              className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                              title={`Min: ${product.minStock} | Actual: ${product.stock}`}
                            >
                              Bajo stock
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="font-semibold text-sm text-gray-700">
                            Costo: ${Number(product.salePrice ?? 0).toLocaleString()}
                          </p>
                          <p>Stock: {product.stock}</p>
                          {product.category && (
                            <p className="text-xs">
                              <Tag className="h-3 w-3 inline mr-1" />
                              {typeof product.category === 'string' 
                                ? product.category 
                                : (product.category?.name ?? '')}
                            </p>
                          )}
                          {product.barcode && (
                            <p className="text-xs font-mono">{product.barcode}</p>
                          )}
                        </div>
                        
                        {/* Botón Agregar con data-testid para el auditor */}
                        <button
                          data-testid="sales-add-item-button"
                          onClick={(e) => { e.stopPropagation(); addToSale(product); }}
                          disabled={product.stock <= 0}
                          className="mt-2 inline-flex items-center px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Agregar a la venta"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Sale Summary (Right Column) */}
            <div className="col-span-12 lg:col-span-3 space-y-4 lg:sticky lg:top-24">
            {/* Cliente: selección y creación (unificado) */}
            <div className="bg-white rounded-xl shadow border border-gray-200">
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-600">Cliente</div>
                    <div className="text-sm font-medium text-gray-900">
                      {currentSale.client ? `${currentSale.client.firstName} ${currentSale.client.lastName}` : 'Cliente general'}
                    </div>
                    {currentSale.client?.email && (
                      <div className="text-xs text-gray-500">{currentSale.client.email}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      data-testid="sales-select-customer-button"
                      onClick={() => setShowClientModal(true)}
                      className="text-blue-600 hover:text-blue-700 text-xs"
                    >
                      Cambiar
                    </button>
                    <button
                      onClick={() => setShowNewClientModal(true)}
                      className="text-green-600 hover:text-green-700 text-xs"
                    >
                      Nuevo
                    </button>
                  </div>
                </div>
                {currentSale.client && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-600 mb-1">Tipo de Cliente</label>
                    <select
                      className="w-full px-2 py-1 border rounded text-sm"
                      value={currentSale.client.customerType}
                      onChange={(e) =>
                        setCurrentSale(prev => ({
                          ...prev,
                          client: prev.client ? { ...prev.client, customerType: e.target.value as Client['customerType'] } : prev.client,
                        }))
                      }
                    >
                      <option value="regular">Regular</option>
                      <option value="vip">VIP</option>
                      <option value="wholesale">Mayorista</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            {/* Quick Payment */}
            <div className="bg-white rounded-xl shadow border border-gray-200">
              <div className="p-3 sm:p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cobro rápido</h3>
                  <span className="ml-3 inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                    {currentSale.items.length} ítems
                  </span>
                </div>
                <button
                  onClick={() => currentSale.items.length > 0 && !processing && setShowPaymentModal(true)}
                  disabled={currentSale.items.length === 0 || processing}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
                >
                  Cobrar
                </button>
              </div>
              {currentSale.items.length > 0 && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>${currentSale.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA ({Math.round(taxRate * 100)}%):</span>
                      <span>${currentSale.taxAmount.toLocaleString()}</span>
                    </div>
                    {currentSale.discountAmount > 0 && (
                      <div className="flex justify-between col-span-2 text-red-600">
                        <span>Descuento:</span>
                        <span>-${currentSale.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 col-span-2">
                      <div className="flex justify-between text-base sm:text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">${currentSale.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Current Sale */}
            <div className="bg-white rounded-xl shadow border border-gray-200">
              <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Venta Actual</h3>
                  <span className="ml-3 inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                    {currentSale.items.length} ítems · Subtotal: ${currentSale.subtotal.toLocaleString()}
                  </span>
                  {currentSale.items.length > 0 && (
                    <button
                      onClick={clearSale}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-3 sm:p-4">
                {currentSale.items.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay productos en la venta</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentSale.items.map((item) => (
                      <div key={item.product.id} className="border border-gray-200 rounded-xl p-2.5">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <button
                            onClick={() => removeFromSale(item.product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Cantidad:</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
<span className="w-8 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
</div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Precio unitario:</span>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateUnitPrice(item.product.id, parseFloat(e.target.value) || 0)}
                                className={`w-20 text-right px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${item.unitPrice <= 0 ? 'border-red-400 bg-red-50' : item.unitPrice > 0 && item.unitPrice < Number(item.product.salePrice ?? 0) ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`}
                                placeholder="0.00"
                              />
                              <span className="text-xs text-gray-500">Costo: ${Number(item.product.salePrice ?? 0).toLocaleString()}</span>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => applyMarginPreset(item.product.id, 10)}
                                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                                  title="Aplicar 10% sobre costo"
                                >10%</button>
                                <button
                                  type="button"
                                  onClick={() => applyMarginPreset(item.product.id, 20)}
                                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                                  title="Aplicar 20% sobre costo"
                                >20%</button>
                                <button
                                  type="button"
                                  onClick={() => applyMarginPreset(item.product.id, 30)}
                                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                                  title="Aplicar 30% sobre costo"
                                >30%</button>
                              </div>
                            </div>
                          </div>

                          {item.unitPrice <= 0 && (
                            <div className="flex items-center text-xs text-red-600 mt-1">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Ingrese un precio mayor a 0
                            </div>
                          )}
                          {item.unitPrice > 0 && item.unitPrice < Number(item.product.salePrice ?? 0) && (
                            <div className="flex items-center text-xs text-yellow-700 mt-1">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Precio menor al costo
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Descuento (%):</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount}
                              onChange={(e) => updateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-16 text-right px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Máximo permitido: {getItemMaxDiscountPercent(item)}%
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-medium">Total:</span>
                            <span className="font-semibold text-green-600">
                              ${item.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sale Totals */}
            {currentSale.items.length > 0 && (
              <div className="bg-white rounded-xl shadow border border-gray-200">
                <div className="p-5">
                  <div className="flex justify-end mb-2">
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={applyTax}
                        onChange={(e) => setApplyTax(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Aplicar IVA</span>
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>${currentSale.subtotal.toLocaleString()}</span>
                    </div>
                    {currentSale.discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuento:</span>
                        <span>-${currentSale.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA ({Math.round(taxRate * 100)}%):</span>
                      <span>${currentSale.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">${currentSale.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Client Selection module removed to avoid duplication (kept only top chip) */}

            {/* Selector de "Tipo de Venta" y configuración de Agencia/Guía removidos de "Nueva Venta".
                Esta configuración vive exclusivamente en la pestaña "Venta con Guía". */}

            {/* Process Sale */}
            {currentSale.items.length > 0 && (
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={processing}
                className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Calculator className="h-5 w-5 mr-2" />
                )}
                Procesar Venta
              </button>
)}
          </div>
        </div>
        </div>
      )}

      {/* Nueva pestaña: Venta con Guía */}
      {activeTab === 'guide-sale' && (
        <div className="space-y-4">
          {/* Sticky Top Bar: Search + Filters + Quick Actions */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
            <div className="px-4 py-3">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex-1" ref={searchRef}>
                  <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Buscar productos por nombre, código o categoría..."
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((categoryName) => (
                      <option key={categoryName} value={categoryName}>{categoryName}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowMasterScanner(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Escáner Maestro
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Atajos: F2 Escáner Maestro, F9 Procesar, Ctrl+Supr Limpiar venta
                </div>
              </div>
            </div>
          </div>

          {/* Se removió la selección manual de Agencia/Guía.
              En esta pestaña se asignan automáticamente al escanear.
              Use Configuración para administrar datos de agencias/guías/vendedores. */}

          {/* Productos y resumen de venta */}
          <div className="grid grid-cols-12 gap-3 md:gap-6 mt-4">
            {/* Context & Scan (Left Column) */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
              {/* Encabezado compacto de Guía (minimalista) */}
              {selectedGuide && (
                <div className="bg-white rounded-lg border">
                  <div className="p-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">{selectedGuide.name}</div>
                      {selectedAgency && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">Agencia: {selectedAgency.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Ventas Hoy: {guideStatsLoading ? '…' : (guideStats?.stats.totalSalesCount ?? 0)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        Total: ${guideStatsLoading ? '—' : (guideStats?.stats.totalSales ?? 0).toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Ticket Prom.: ${guideStatsLoading ? '—' : (guideStats?.stats.averageTicket ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Acciones y estado (minimalista) */}
              <div className="bg-white rounded-lg border">
                <div className="p-3 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setShowMasterScanner(true)}
                    className="flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Smartphone className="h-4 w-4 mr-2" /> Escáner Maestro
                  </button>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                      Guía: {selectedGuide ? selectedGuide.name : 'Sin seleccionar'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Agencia: {selectedAgency ? selectedAgency.name : 'Sin seleccionar'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Vendedor: {selectedEmployee ? selectedEmployee.name : 'Sin seleccionar'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Section (Center Column) */}
            <div className="col-span-12 lg:col-span-6 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Productos ({filteredProducts.length})</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Por página</label>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={pageSize}
                      onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={onlyLowStock}
                        onChange={(e) => { setPage(1); setOnlyLowStock(e.target.checked); }}
                      />
                      Solo bajo stock
                    </label>
                    <button className="px-2 py-1 border rounded text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
                    <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                    <button className="px-2 py-1 border rounded text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</button>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No se encontraron productos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedProducts.map((product, index) => (
                        <div
                          key={product.id}
                          className={`group border rounded-xl p-2.5 cursor-pointer transition hover:shadow ${
                            product.stock <= 0 
                              ? 'bg-gray-50 border-gray-200 opacity-60' 
                              : product.stock <= product.minStock
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-white border-gray-200 group-hover:border-blue-300'
                          } ${selectedProductIndex === index ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                          onClick={() => product.stock > 0 && addToSale(product)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</h4>
                            {product.stock <= 0 && (
                              <span
                                className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                                title="No disponible"
                              >
                                Sin stock
                              </span>
                            )}
                            {product.stock > 0 && product.stock <= product.minStock && (
                              <span
                                className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                                title={`Min: ${product.minStock} | Actual: ${product.stock}`}
                              >
                                Bajo stock
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p className="font-semibold text-sm text-gray-700">Costo: ${Number(product.salePrice ?? 0).toLocaleString()}</p>
                            <p>Stock: {product.stock}</p>
                            {product.category && (
                              <p className="text-xs">
                                <Tag className="h-3 w-3 inline mr-1" />
                                {typeof product.category === 'string' 
                                  ? product.category 
                                  : (product.category?.name ?? '')}
                              </p>
                            )}
                            {product.barcode && (<p className="text-xs font-mono">{product.barcode}</p>)}
                          </div>
                          
                          {/* Botón Agregar con data-testid para el auditor */}
                          <button
                            data-testid="sales-add-to-cart-button"
                            onClick={(e) => { e.stopPropagation(); addToSale(product); }}
                            disabled={product.stock <= 0}
                            className="mt-2 inline-flex items-center px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Agregar a la venta"
                          >
                            <Plus className="h-4 w-4 mr-1" /> Agregar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sale Summary (Right Column) */}
            <div className="col-span-12 lg:col-span-3 space-y-4 lg:sticky lg:top-24">
              {/* Quick Payment */}
              <div className="bg-white rounded-xl shadow border border-gray-200">
                <div className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cobro rápido</h3>
                    <span className="ml-3 inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">{currentSale.items.length} ítems</span>
                  </div>
                  <button
                    onClick={() => currentSale.items.length > 0 && !processing && setShowPaymentModal(true)}
                    disabled={currentSale.items.length === 0 || processing}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
                  >
                    Cobrar
                  </button>
                </div>
                {currentSale.items.length > 0 && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span>${currentSale.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">IVA ({Math.round(taxRate * 100)}%):</span><span>${currentSale.taxAmount.toLocaleString()}</span></div>
                      {currentSale.discountAmount > 0 && (<div className="flex justify-between col-span-2 text-red-600"><span>Descuento:</span><span>- ${currentSale.discountAmount.toLocaleString()}</span></div>)}
                      <div className="border-t pt-2 col-span-2"><div className="flex justify-between text-base sm:text-lg font-bold"><span>Total:</span><span className="text-green-600">${currentSale.total.toLocaleString()}</span></div></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Sale */}
              <div className="bg-white rounded-xl shadow border border-gray-200">
                <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Venta Actual</h3>
                    <span className="ml-3 inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">{currentSale.items.length} ítems · Subtotal: ${currentSale.subtotal.toLocaleString()}</span>
                    {currentSale.items.length > 0 && (
                      <button onClick={clearSale} className="text-red-600 hover:text-red-700 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  {currentSale.items.length === 0 ? (
                    <div className="text-center py-8"><ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">No hay productos en la venta</p></div>
                  ) : (
                    <div className="space-y-3">
                      {currentSale.items.map((item) => (
                        <div key={item.product.id} className="border border-gray-200 rounded-xl p-2.5">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm">{item.product.name}</h4>
                            <button onClick={() => removeFromSale(item.product.id)} className="text-red-600 hover:text-red-700"><X className="h-4 w-4" /></button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                            <div className="flex items-center">
                              <button onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} className="p-1 rounded hover:bg-gray-100"><Minus className="h-4 w-4" /></button>
                              <span className="mx-2 text-sm">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1 rounded hover:bg-gray-100"><Plus className="h-4 w-4" /></button>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Precio unitario</label>
                              <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateUnitPrice(item.product.id, Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Descuento (%)</label>
                              <input type="number" step="0.01" value={item.discount} onChange={(e) => updateDiscount(item.product.id, Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
                              <p className="mt-1 text-[11px] text-gray-500">Máximo: {getItemMaxDiscountPercent(item)}%</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm">Subtotal: ${item.subtotal.toLocaleString()}</div>
                              <div className="font-semibold">Total: ${item.total.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Procesar Venta */}
          {currentSale.items.length > 0 && (
            <button
              data-testid="sales-process-payment-button"
              onClick={() => setShowPaymentModal(true)}
              disabled={processing}
              className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (<RefreshCw className="h-5 w-5 mr-2 animate-spin" />) : (<Calculator className="h-5 w-5 mr-2" />)}
              Procesar Venta
            </button>
          )}
        </div>
      )}

      {activeTab === 'sales-history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-8 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={salesFilters.dateFrom || ''}
                  onChange={(e) => handleSalesFilterChange({ dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={salesFilters.dateTo || ''}
                  onChange={(e) => handleSalesFilterChange({ dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <select
                  value={salesFilters.clientId || ''}
                  onChange={(e) => handleSalesFilterChange({ clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos los clientes</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={salesFilters.status || ''}
                  onChange={(e) => handleSalesFilterChange({ status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos los estados</option>
                  <option value="completed">Completada</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto mínimo
                </label>
                <input
                  type="number"
                  min={0}
                  value={salesFilters.minAmount ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleSalesFilterChange({ minAmount: v.trim() === '' ? undefined : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const minVal = v === '' ? undefined : Number(v);
                    if (minVal !== undefined && salesFilters.maxAmount !== undefined && salesFilters.maxAmount < minVal) {
                      // Autocorregir: elevar maxAmount al nuevo mínimo
                      handleSalesFilterChange({ maxAmount: minVal });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
          Método de pago
                </label>
                <select
                  value={salesFilters.paymentMethod || ''}
                  onChange={(e) => handleSalesFilterChange({ paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
          <option value="">Todos los métodos</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="mixed">Mixto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto máximo
                </label>
                <input
                  type="number"
                  min={0}
                  value={salesFilters.maxAmount ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleSalesFilterChange({ maxAmount: v.trim() === '' ? undefined : Number(v) });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const maxVal = v === '' ? undefined : Number(v);
                    if (maxVal !== undefined && salesFilters.minAmount !== undefined && maxVal < salesFilters.minAmount) {
                      // Autocorregir: elevar maxAmount al mínimo actual
                      handleSalesFilterChange({ maxAmount: salesFilters.minAmount });
                    }
                  }}
                  aria-invalid={amountRangeError || undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
                {amountRangeError && (
                  <p className="mt-1 text-xs text-red-600">El máximo no puede ser menor que el mínimo</p>
                )}
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={!!salesFilters.hasReference}
                    onChange={(e) => handleSalesFilterChange({ hasReference: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Con referencia</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar referencia
                </label>
                <input
                  type="text"
                  value={salesFilters.referenceQuery || ''}
                  onChange={(e) => handleSalesFilterChange({ referenceQuery: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Texto en autorización/transferencia"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setSalesFilters({})}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      showSuccess('Enlace copiado al portapapeles');
                    } catch (e) {
                      showError('No se pudo copiar el enlace');
                    }
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copiar enlace con filtros
                </button>
              </div>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Historial de Ventas ({filteredSales.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              {filteredSales.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontraron ventas</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Venta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Método de Pago
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {sale.saleNumber || sale.id?.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {sale.client ? 
                              `${maybeFixMojibake(sale.client.firstName)} ${maybeFixMojibake(sale.client.lastName)}` : 
                              'Cliente general'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(sale.saleDate || '').toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600">
                            ${sale.total.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            {sale.paymentMethod === 'cash' && <Banknote className="h-4 w-4 mr-1" />}
                            {sale.paymentMethod === 'card' && <CreditCard className="h-4 w-4 mr-1" />}
                            {sale.paymentMethod === 'transfer' && <Smartphone className="h-4 w-4 mr-1" />}
                            {sale.paymentMethod === 'mixed' && <DollarSign className="h-4 w-4 mr-1" />}
                            {sale.paymentMethod === 'cash' && 'Efectivo'}
                            {sale.paymentMethod === 'card' && 'Tarjeta'}
                            {sale.paymentMethod === 'transfer' && 'Transferencia'}
                            {sale.paymentMethod === 'mixed' && 'Mixto'}
                          </div>
                          {(sale.cardReference || sale.transferReference) && (
                            <div className="mt-1 text-xs text-gray-600">
                              {sale.cardReference && (
                                <span className="inline-flex items-center mr-2">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  <span className="font-mono">{sale.cardReference}</span>
                                </span>
                              )}
                              {sale.transferReference && (
                                <span className="inline-flex items-center">
                                  <Smartphone className="h-3 w-3 mr-1" />
                                  <span className="font-mono">{sale.transferReference}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            sale.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : sale.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {sale.status === 'completed' && 'Completada'}
                            {sale.status === 'pending' && 'Pendiente'}
                            {sale.status === 'cancelled' && 'Cancelada'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowSaleDetails(true);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
<button
                              onClick={() => printTicket(sale.id!)}
                              disabled={backendHealthMode !== 'ok'}
                              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ventas Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">{salesAnalytics.todaySales}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ingresos Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${salesAnalytics.todayRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ventas del Mes</p>
                  <p className="text-2xl font-bold text-gray-900">{salesAnalytics.monthSales}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calculator className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${salesAnalytics.avgTicket.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts: análisis dinámico */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis de Ventas</h3>
            {(() => {
              try {
                const salesList = Array.isArray(sales) ? sales : [];
                if (salesList.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Sin datos suficientes para análisis</p>
                    </div>
                  );
                }

                const today = new Date();
                const dayKey = (d: Date) => d.toISOString().slice(0,10);
                const mapDay = new Map<string, number>();
                salesList.forEach((s: Sale) => {
                  const d = new Date(s.saleDate ?? s.createdAt ?? Date.now());
                  const key = dayKey(d);
                  const total = typeof s.total === 'number' ? s.total : 0;
                  mapDay.set(key, (mapDay.get(key) || 0) + total);
                });

                const byDay: { date: Date; revenue: number }[] = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date(today);
                  d.setDate(today.getDate() - i);
                  const key = dayKey(d);
                  byDay.push({ date: d, revenue: mapDay.get(key) || 0 });
                }

                const byHour: { hour: number; revenue: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0 }));
                salesList.forEach((s: Sale) => {
                  const d = new Date(s.saleDate ?? s.createdAt ?? Date.now());
                  if (d.toDateString() === today.toDateString()) {
                    const total = typeof s.total === 'number' ? s.total : 0;
                    byHour[d.getHours()].revenue += total;
                  }
                });

                const maxDay = Math.max(...byDay.map(d => d.revenue), 1);
                const maxHour = Math.max(...byHour.map(h => h.revenue), 1);
                const fmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' });

                return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Ingresos por día (últimos 7)</h4>
                      <div className="flex items-end justify-between h-32 gap-2">
                        {byDay.map((d) => (
                          <div key={String(d.date)} className="flex flex-col items-center w-full">
                            <div
                              className="w-full bg-blue-100 rounded-t"
                              style={{ height: `${Math.round((d.revenue / maxDay) * 100)}%` }}
                            />
                            <span className="mt-2 text-xs text-gray-600">{fmt.format(d.date)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Total semana: ${byDay.reduce((a, b) => a + b.revenue, 0).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Distribución por hora (hoy)</h4>
                      <div className="flex items-end justify-between h-32 gap-1">
                        {byHour.map((h) => (
                          <div key={String(h.hour)} className="flex flex-col items-center w-full">
                            <div
                              className="w-full bg-green-100 rounded-t"
                              style={{ height: `${Math.round((h.revenue / maxHour) * 100)}%` }}
                            />
                            <span className="mt-2 text-[10px] text-gray-600">{String(h.hour).padStart(2, '0')}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Ingresos hoy: ${byHour.reduce((a, b) => a + b.revenue, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              } catch {
                return (
                  <div className="text-center py-12">
                    <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No se pudo generar el análisis</p>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      
      {/* Client Selection Modal */}
      <Modal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        title="Seleccionar Cliente"
        size="lg"
      >
        <div className="space-y-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar cliente..."
          />
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {clients
              .filter(client => 
                client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.phone?.includes(searchTerm)
              )
              .map(client => (
                <div
                  key={client.id}
                  onClick={() => selectClient(client)}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {client.firstName} {client.lastName}
                      </h4>
                      {client.email && (
                        <p className="text-sm text-gray-600">{client.email}</p>
                      )}
                      {client.phone && (
                        <p className="text-sm text-gray-600">{client.phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        client.customerType === 'vip' 
                          ? 'bg-purple-100 text-purple-800'
                          : client.customerType === 'wholesale'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.customerType === 'vip' && 'VIP'}
                        {client.customerType === 'wholesale' && 'Mayorista'}
                        {client.customerType === 'regular' && 'Regular'}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">
                        Compras: ${client.totalPurchases.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Modal>

      {/* New Client Modal */}
      <Modal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        title="Nuevo Cliente"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={newClient.firstName}
                onChange={(e) => setNewClient(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido *
              </label>
              <input
                type="text"
                value={newClient.lastName}
                onChange={(e) => setNewClient(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
              </label>
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
          Dirección
              </label>
              <input
                type="text"
                value={newClient.address}
                onChange={(e) => setNewClient(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={newClient.city}
                onChange={(e) => setNewClient(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Cliente
            </label>
            <select
              value={newClient.customerType}
              onChange={(e) => setNewClient(prev => ({ ...prev, customerType: e.target.value as Client['customerType'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="regular">Regular</option>
              <option value="vip">VIP</option>
              <option value="wholesale">Mayorista</option>
            </select>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowNewClientModal(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={createNewClient}
              disabled={processing || backendHealthMode !== 'ok' || !newClient.firstName || !newClient.lastName}
              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Procesar Pago"
        size="lg"
      >
        <div className="space-y-6">
          {/* Sale Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Resumen de Venta</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${currentSale.subtotal.toLocaleString()}</span>
              </div>
              {currentSale.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento:</span>
                  <span>-${currentSale.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IVA ({Math.round(taxRate * 100)}%):</span>
                <span>${currentSale.taxAmount.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-green-600">${currentSale.total.toLocaleString()}</span>
                </div>
              </div>
              {/* Commissions Summary */}
              {(() => {
                const agencyC = saleType === 'GUIDE' ? computeAgencyCommission(currentSale.total) : 0;
                const guideC = saleType === 'GUIDE' ? computeGuideCommission(currentSale.total) : 0;
                const employeeC = computeEmployeeCommission(currentSale.total);
                const anyCommission = (agencyC + guideC + employeeC) > 0.0001;
                return anyCommission ? (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Comisiones</p>
                    {saleType === 'GUIDE' && (
                      <div className="flex justify-between text-blue-700">
                        <span>Agencia:</span>
                        <span>${agencyC.toLocaleString()}</span>
                      </div>
                    )}
                    {saleType === 'GUIDE' && (
                      <div className="flex justify-between text-blue-700">
                        <span>Guía:</span>
                        <span>${guideC.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-700">
                      <span>Empleado:</span>
                      <span>${employeeC.toLocaleString()}</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Payment Method */}
          <div>
          <h4 className="font-medium text-gray-900 mb-3">Método de Pago</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'cash', label: 'Efectivo', icon: Banknote },
                { id: 'card', label: 'Tarjeta', icon: CreditCard },
                { id: 'transfer', label: 'Transferencia', icon: Smartphone },
                { id: 'mixed', label: 'Mixto', icon: DollarSign },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setCurrentSale(prev => ({ ...prev, paymentMethod: method.id as Sale['paymentMethod'] }))}
                  className={`flex flex-col items-center p-4 border rounded-lg transition-colors ${
                     currentSale.paymentMethod === method.id
                       ? 'border-blue-500 bg-blue-50 text-blue-700'
                       : 'border-gray-300 hover:bg-gray-50'
                   }`}
                 >
                   <method.icon className="h-6 w-6 mb-2" />
                   <span className="text-sm font-medium">{method.label}</span>
                 </button>
))}
             </div>
           </div>

           {/* Cash Payment */}
           {currentSale.paymentMethod === 'cash' && (
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Efectivo Recibido
               </label>
               {(() => {
                 const errs = getPaymentErrors();
                 const hasErr = !!errs.cashReceived;
                 return (
                   <>
                     <input
                       type="number"
                       step="0.01"
                       min={currentSale.total}
                       value={cashReceived}
                       onChange={(e) => setCashReceived(e.target.value)}
                       className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasErr ? 'border-red-300' : 'border-gray-300'}`}
                       placeholder="0.00"
                     />
                     {hasErr && (
                       <p className="mt-1 text-sm text-red-600">{errs.cashReceived}</p>
                     )}
                   </>
                 );
               })()}
               {cashReceived && parseFloat(cashReceived) >= currentSale.total && (
                 <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                   <p className="text-sm text-green-700 font-medium">
                     Cambio: ${(parseFloat(cashReceived) - currentSale.total).toLocaleString()}
                   </p>
                 </div>
               )}
             </div>
           )}

           {/* Mixed Payment */}
           {currentSale.paymentMethod === 'mixed' && (
             <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Distribución del Pago</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Efectivo
                   </label>
                   <input
                     type="number"
                     step="0.01"
                     min="0"
                     value={paymentDetails.cash || ''}
                     onChange={(e) => setPaymentDetails(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="0.00"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Tarjeta
                   </label>
                   <input
                     type="number"
                     step="0.01"
                     min="0"
                     value={paymentDetails.card || ''}
                     onChange={(e) => setPaymentDetails(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="0.00"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Transferencia
                   </label>
                   <input
                     type="number"
                     step="0.01"
                     min="0"
                     value={paymentDetails.transfer || ''}
                     onChange={(e) => setPaymentDetails(prev => ({ ...prev, transfer: parseFloat(e.target.value) || 0 }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="0.00"
                   />
                 </div>
               </div>
               
               {/* Payment references */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Referencia Tarjeta
                   </label>
                   {(() => {
                     const errs = getPaymentErrors();
                     const hasErr = !!errs.cardReference;
                     return (
                       <>
                         <input
                           type="text"
                           value={paymentDetails.cardReference || ''}
                           onChange={(e) => setPaymentDetails(prev => ({ ...prev, cardReference: e.target.value }))}
                           className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasErr ? 'border-red-300' : 'border-gray-300'}`}
                           placeholder="Número de autorización"
                         />
                         {hasErr && (
                           <p className="mt-1 text-sm text-red-600">{errs.cardReference}</p>
                         )}
                       </>
                     );
                   })()}
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Referencia Transferencia
                   </label>
                   {(() => {
                     const errs = getPaymentErrors();
                     const hasErr = !!errs.transferReference;
                     return (
                       <>
                         <input
                           type="text"
                           value={paymentDetails.transferReference || ''}
                           onChange={(e) => setPaymentDetails(prev => ({ ...prev, transferReference: e.target.value }))}
                           className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasErr ? 'border-red-300' : 'border-gray-300'}`}
                           placeholder="Número de transferencia"
                         />
                         {hasErr && (
                           <p className="mt-1 text-sm text-red-600">{errs.transferReference}</p>
                         )}
                       </>
                     );
                   })()}
                 </div>
               </div>

               {/* Payment total validation */}
               {(() => {
                 const totalPaid = (paymentDetails.cash || 0) + (paymentDetails.card || 0) + (paymentDetails.transfer || 0);
                 const difference = currentSale.total - totalPaid;
                 
                const errs = getPaymentErrors();
                const hasErr = !!errs.mixedTotal;
                return (
                  <div className={`p-3 rounded-lg ${
                    Math.abs(difference) < 0.01 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      Math.abs(difference) < 0.01 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {Math.abs(difference) < 0.01 
                        ? 'Pago completo' 
                        : errs.mixedTotal || `Falta: $${Math.abs(difference).toLocaleString()}`
                      }
                    </p>
                  </div>
                );
              })()}
             </div>
           )}

           {/* Card/Transfer Payment */}
           {(currentSale.paymentMethod === 'card' || currentSale.paymentMethod === 'transfer') && (
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
          Número de Referencia
               </label>
               {(() => {
                 const errs = getPaymentErrors();
                 const hasErr = !!errs.singleReference;
                 return (
                   <>
                     <input
                       type="text"
                       value={singlePaymentReference}
                       onChange={(e) => setSinglePaymentReference(e.target.value)}
                       className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasErr ? 'border-red-300' : 'border-gray-300'}`}
                       placeholder={currentSale.paymentMethod === 'card' ? 'Número de autorización' : 'Número de transferencia'}
                     />
                     {hasErr && (
                       <p className="mt-1 text-sm text-red-600">{errs.singleReference}</p>
                     )}
                   </>
                 );
               })()}
              </div>
           )}

           {/* Discount Reason (corporate) */}
           {currentSale.items.some(i => Number(i.discount) > 0) && (
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del descuento</label>
               {(() => {
                 const errs = getPaymentErrors();
                 const hasErr = !!errs.discountReason;
                 return (
                   <>
                     <select
                       value={discountReason}
                       onChange={(e) => setDiscountReason(e.target.value)}
                       className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasErr ? 'border-red-300' : 'border-gray-300'}`}
                     >
                       <option value="">Seleccione un motivo</option>
                       {CORPORATE_DISCOUNT_REASONS.map((r) => (
                         <option key={r} value={r}>{r}</option>
                       ))}
                     </select>
                     {hasErr && (
                       <p className="mt-1 text-sm text-red-600">{errs.discountReason}</p>
                     )}
                   </>
                 );
               })()}
             </div>
           )}

           {/* Notes */}
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Notas de la venta
             </label>
             <textarea
               value={currentSale.notes || ''}
               onChange={(e) => setCurrentSale(prev => ({ ...prev, notes: e.target.value }))}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               rows={3}
               placeholder="Notas adicionales (opcional)"
             />
            {currentSale.items.some(i => Number(i.discount) > 0) && (
              <p className="mt-1 text-xs text-gray-600">El motivo del descuento se registra arriba.</p>
            )}
           </div>

           {/* Action Buttons */}
           <div className="flex justify-end space-x-3 pt-4">
             <button
               onClick={() => setShowPaymentModal(false)}
               className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               Cancelar
             </button>
            {(() => {
              const errs = getPaymentErrors();
              const hasErrs = Object.keys(errs).length > 0;
              return (
                <button
                  data-testid="sales-complete-sale-button"
                  onClick={processSale}
                  disabled={processing || hasErrs || backendHealthMode !== 'ok'}
                  title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </div>
                  ) : (
                    'Confirmar Venta'
                  )}
                </button>
              );
            })()}
</div>
         </div>
       </Modal>

       {/* Sale Details Modal */}
       <Modal
         isOpen={showSaleDetails}
         onClose={() => setShowSaleDetails(false)}
         title="Detalles de Venta"
         size="lg"
       >
         {selectedSale && (
           <div className="space-y-6">
             {/* Sale Header */}
             <div className="bg-gray-50 p-4 rounded-lg">
               <div className="grid grid-cols-2 gap-4">
                 <div>
          <p className="text-sm text-gray-600">Número de Venta</p>
                   <p className="font-medium">{selectedSale.saleNumber || selectedSale.id?.slice(0, 8)}</p>
                 </div>
                 <div>
                   <p className="text-sm text-gray-600">Fecha</p>
                   <p className="font-medium">{new Date(selectedSale.saleDate || '').toLocaleString()}</p>
                 </div>
                 <div>
                   <p className="text-sm text-gray-600">Cliente</p>
                   <p className="font-medium">
                     {selectedSale.client 
                       ? `${selectedSale.client.firstName} ${selectedSale.client.lastName}`
                       : 'Cliente general'
                     }
                   </p>
                 </div>
                 <div>
                   <p className="text-sm text-gray-600">Estado</p>
                   <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                     selectedSale.status === 'completed' 
                       ? 'bg-green-100 text-green-800'
                       : selectedSale.status === 'pending'
                       ? 'bg-yellow-100 text-yellow-800'
                       : 'bg-red-100 text-red-800'
                   }`}>
                     {selectedSale.status === 'completed' && 'Completada'}
                     {selectedSale.status === 'pending' && 'Pendiente'}
                     {selectedSale.status === 'cancelled' && 'Cancelada'}
                   </span>
                 </div>
               </div>
             </div>

             {/* Sale Items */}
             <div>
               <h4 className="font-medium text-gray-900 mb-3">Productos</h4>
               <div className="space-y-2">
                 {selectedSale.items.map((item) => (
                   <div key={getStableKey(item.id, item.product?.id, item.product?.name, item.quantity, item.unitPrice)} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                     <div className="flex-1">
                       <p className="font-medium text-gray-900">{item.product.name}</p>
                       <p className="text-sm text-gray-600">
                         {item.quantity} x ${item.unitPrice.toLocaleString()}
                         {item.discount > 0 && ` (${item.discount}% desc.)`}
                       </p>
                     </div>
                     <div className="text-right">
                       <p className="font-medium text-gray-900">${item.total.toLocaleString()}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* Sale Totals */}
             <div className="bg-gray-50 p-4 rounded-lg">
               <div className="space-y-2">
                 <div className="flex justify-between">
                   <span className="text-gray-600">Subtotal:</span>
                   <span>${selectedSale.subtotal.toLocaleString()}</span>
                 </div>
                 {selectedSale.discountAmount > 0 && (
                   <div className="flex justify-between text-red-600">
                     <span>Descuento:</span>
                     <span>-${selectedSale.discountAmount.toLocaleString()}</span>
                   </div>
                 )}
                 <div className="flex justify-between">
                   <span className="text-gray-600">IVA:</span>
                   <span>${selectedSale.taxAmount.toLocaleString()}</span>
                 </div>
                 <div className="border-t pt-2">
                   <div className="flex justify-between font-bold text-lg">
                     <span>Total:</span>
                     <span className="text-green-600">${selectedSale.total.toLocaleString()}</span>
                   </div>
                 </div>
               </div>
             </div>

             {/* Payment Info */}
             <div>
              <h4 className="font-medium text-gray-900 mb-3">Información de Pago</h4>
               <div className="bg-gray-50 p-4 rounded-lg">
                 <div className="flex items-center mb-2">
                   {selectedSale.paymentMethod === 'cash' && <Banknote className="h-4 w-4 mr-2" />}
                   {selectedSale.paymentMethod === 'card' && <CreditCard className="h-4 w-4 mr-2" />}
                   {selectedSale.paymentMethod === 'transfer' && <Smartphone className="h-4 w-4 mr-2" />}
                   {selectedSale.paymentMethod === 'mixed' && <DollarSign className="h-4 w-4 mr-2" />}
                   <span className="font-medium">
                     {selectedSale.paymentMethod === 'cash' && 'Efectivo'}
                     {selectedSale.paymentMethod === 'card' && 'Tarjeta'}
                     {selectedSale.paymentMethod === 'transfer' && 'Transferencia'}
                     {selectedSale.paymentMethod === 'mixed' && 'Pago Mixto'}
                   </span>
                 </div>
                 
                 {selectedSale.paymentMethod === 'cash' && selectedSale.cashReceived && (
                   <div className="space-y-1 text-sm">
                     <div className="flex justify-between">
                       <span>Efectivo recibido:</span>
                       <span>${selectedSale.cashReceived.toLocaleString()}</span>
                     </div>
                     {selectedSale.change && selectedSale.change > 0 && (
                       <div className="flex justify-between">
                         <span>Cambio:</span>
                         <span>${selectedSale.change.toLocaleString()}</span>
                       </div>
                     )}
                   </div>
                 )}

                  {/* Referencias de pago si existen */}
                  {(selectedSale.cardReference || selectedSale.transferReference) && (
                    <div className="mt-2 space-y-1 text-sm">
                      {selectedSale.cardReference && (
                        <div className="flex justify-between">
                          <span>Autorización Tarjeta:</span>
                          <span className="font-mono">{selectedSale.cardReference}</span>
                        </div>
                      )}
                      {selectedSale.transferReference && (
                        <div className="flex justify-between">
                          <span>Referencia Transferencia:</span>
                          <span className="font-mono">{selectedSale.transferReference}</span>
                        </div>
                      )}
                    </div>
                  )}
               </div>
             </div>

             {/* Notes */}
             {selectedSale.notes && (
               <div>
                 <h4 className="font-medium text-gray-900 mb-2">Notas</h4>
                 <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedSale.notes}</p>
               </div>
             )}

             {/* Actions */}
             <div className="flex justify-end space-x-3 pt-4">
               <button
                 data-testid="sales-print-ticket-button"
                 onClick={() => printTicket(selectedSale.id!)}
                 disabled={backendHealthMode !== 'ok'}
                 title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
                 className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
               >
                 <Printer className="h-4 w-4 mr-2" />
                 Imprimir Ticket
               </button>
</div>
           </div>
         )}
       </Modal>

       {/* Barcode Scanner */}
       <BarcodeScanner
         isOpen={showMasterScanner}
         onClose={() => setShowMasterScanner(false)}
         onScan={handleMasterScan}
         title="Escáner Maestro (Guía/Vendedor/Producto)"
       />
       <BarcodeScanner
         isOpen={showScanner}
         onClose={() => setShowScanner(false)}
         onScan={handleScan}
         title="Escanear Código de Producto"
       />

        {/* Barcode Scanner - Guide */}
        <BarcodeScanner
          isOpen={showScannerGuide}
          onClose={() => setShowScannerGuide(false)}
          onScan={handleScanGuideEntity}
          title="Escanear Código de Guía"
        />

        {/* Barcode Scanner - Employee */}
        <BarcodeScanner
          isOpen={showScannerEmployee}
          onClose={() => setShowScannerEmployee(false)}
          onScan={handleScanEmployeeEntity}
          title="Escanear Código de Vendedor"
        />

        {/* Hardware Scanner Listener - Eclinepos EC-CD-8100 */}
        <HardwareScannerListener
          onScan={handleMasterScan}
          minLength={3}
          maxLength={128}
          timeout={50}
          triggerKeys={['Enter', 'Tab']}
          ignoreIfFocused={true}
        />
     </div>
   );
 };

 export default SalesPage;
