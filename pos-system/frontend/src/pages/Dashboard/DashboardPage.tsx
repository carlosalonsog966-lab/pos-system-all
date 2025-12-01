import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Eye,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  Gem,
  Bell,
  Filter,
  CreditCard,
  Smartphone
} from 'lucide-react';
import { Copy } from 'lucide-react';
import { ReportTest } from '@/components/ReportTest';

import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Legend
} from 'recharts';

import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { api, initializeApiBaseUrl, backendStatus, parseApiResponse, parseApiResponseWithSchema } from '@/lib/api';
import { z } from 'zod';
import { useClientsStore } from '@/store/clientsStore';
import Skeleton from '@/components/Common/Skeleton';
import Modal from '@/components/Modal';
import { buildUrlWithParams } from '@/utils/url';
import { copyUrlWithParams } from '@/utils/clipboard';
import { useDashboardUrlSync } from '@/hooks/useDashboardUrlSync';
import { getStableKey } from '@/lib/utils';

interface DashboardStats {
  // KPIs principales
  totalSales: number;
  totalRevenue: number;
  totalClients: number;
  activeClients: number;
  totalJewelry: number;
  lowStockJewelry: number;
  
  // Métricas del día
  todaySales: number;
  todayRevenue: number;
  todayTransactions: number;
  todayAverageTicket: number;
  
  // Métricas en tiempo real
  currentHourSales: number;
  currentHourRevenue: number;
  activeUsers: number;
  pendingOrders: number;
  
  // Comparaciones
  salesGrowth: number;
  revenueGrowth: number;
  clientGrowth: number;
  
  // Datos para gráficos
  recentSales: Array<{
    id: string;
    total: number;
    clientName?: string;
    createdAt: string;
    paymentMethod: string;
    items: number;
    cardReference?: string;
    transferReference?: string;
  }>;
  
  salesData: Array<{
    name: string;
    ventas: number;
    ingresos: number;
    transacciones: number;
    fecha: string;
  }>;
  
  revenueData: Array<{
    name: string;
    ingresos: number;
    meta: number;
    fecha: string;
  }>;
  
  hourlyData: Array<{
    hour: string;
    ventas: number;
    transacciones: number;
    promedio: number;
  }>;
  
  paymentMethodData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: number;
    category: string | { name?: string; [key: string]: any };
  }>;
  
  topClients: Array<{
    id: string;
    name: string;
    purchases: number;
    totalSpent: number;
    lastPurchase: string;
  }>;
  
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: string;
    action?: string;
  }>;
}

interface RealTimeMetrics {
  isLive: boolean;
  lastUpdate: string;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

interface DashboardFilters {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year';
  comparison: boolean;
  showAmounts: boolean;
}


//

// Constante para altura de gráficos en Tauri (previene flickering por recálculos)
const CHART_HEIGHT = 320;

type DashboardPageProps = { testMode?: boolean };
const DashboardPage: React.FC<DashboardPageProps> = ({ testMode = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { isOffline } = useOfflineStore();
  const { filters, setFilters, recentSalesFilters, setRecentSalesFilters, handleFilterChange } = useDashboardUrlSync();
  
  const [stats, setStats] = useState<DashboardStats>({
    // KPIs principales
    totalSales: 0,
    totalRevenue: 0,
    totalClients: 0,
    activeClients: 0,
    totalJewelry: 0,
    lowStockJewelry: 0,
    
    // Métricas del día
    todaySales: 0,
    todayRevenue: 0,
    todayTransactions: 0,
    todayAverageTicket: 0,
    
    // Métricas en tiempo real
    currentHourSales: 0,
    currentHourRevenue: 0,
    activeUsers: 0,
    pendingOrders: 0,
    
    // Comparaciones
    salesGrowth: 0,
    revenueGrowth: 0,
    clientGrowth: 0,
    
    // Datos para gráficos
    recentSales: [],
    salesData: [],
    revenueData: [],
    hourlyData: [],
    paymentMethodData: [],
    topProducts: [],
    topClients: [],
    alerts: []
  });
  
  const [loading, setLoading] = useState(!testMode);
  const [refreshing, setRefreshing] = useState(false);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics>({
    isLive: false,
    lastUpdate: new Date().toISOString(),
    connectionStatus: 'connected'
  });
  // Estado de salud del backend: ok, no_health (sin /health pero con endpoints públicos), down
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
  // Circuit breaker simple
  const [, setFailureCount] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(60000);
  
  // Estado para tracking de errores detallado
  const [errorInfo, setErrorInfo] = useState<{
    count: number;
    lastError: string | null;
    firstErrorTime: number | null;
  }>({
    count: 0,
    lastError: null,
    firstErrorTime: null
  });
  const cacheWarnShownRef = useRef<number>(0);

  // Filtros locales para "Ventas recientes"
  // Filtros de ventas recientes ahora los gestiona useDashboardUrlSync

  // Filtros: deben declararse antes de cualquier efecto que los use
  // Filtros principales del Dashboard ahora los gestiona useDashboardUrlSync

  // Efecto: sincronizar KPIs con cambios en el store de clientes
  useEffect(() => {
    const unsubscribe = useClientsStore.subscribe((state) => {
      try {
        const clients = state.clients || [];
        if (Array.isArray(clients)) {
          const activeCount = clients.filter((c: any) => !!c?.isActive).length;
          const totalCount = clients.length;
          const totalClientRevenue = clients.reduce(
            (sum: number, c: any) => sum + (Number(c?.totalPurchases) || 0),
            0
          );
          setStats((prev) => ({
            ...prev,
            activeClients: activeCount,
            totalClients: totalCount,
            totalRevenue: Number.isFinite(totalClientRevenue) ? totalClientRevenue : prev.totalRevenue,
          }));
          // Limpiar caché de todos los períodos para evitar mostrar datos obsoletos
          try {
            const key = (period: string) => `dashboard-cache:${period}`;
            ['today', 'week', 'month', 'quarter', 'year'].forEach(p => {
              try { localStorage.removeItem(key(p)); } catch {/* noop */}
            });
          } catch {/* noop */}
        }
      } catch {/* noop */}
    });
    return () => {
      try { unsubscribe(); } catch {/* noop */}
    };
  }, [filters.period]);
  // Evitar notificación duplicada cuando se abre el breaker
  const breakerNotifiedRef = React.useRef(false);
  // Controlar la carga inicial para evitar doble fetch al montar
  const hasMountedFiltersRef = React.useRef(false);
  
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  // Nota: mover auto-refresh debajo de la definición de fetchDashboardStats
  // para evitar cualquier captura prematura de variables en HMR.

  useEffect(() => {
    // Evitar doble llamada: la primera vez sólo marcamos como montado
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }
    // Actualizar cuando cambien los filtros
    if (testMode) return;
    fetchDashboardStats();
  }, [filters.period, testMode]);

  // Sincronización de filtros y URL/localStorage se maneja en useDashboardUrlSync
  // Cargar datos una vez tras montar y restaurar filtros
  useEffect(() => {
    if (testMode) return;
    fetchDashboardStats();
  }, [testMode]);

  // Suscribirse al estado del backend con helper centralizado
  useEffect(() => {
    if (testMode) return;
    const handler = (status: 'ok' | 'no_health' | 'down') => {
      setBackendHealthMode(status);
    };
    try {
      if (typeof (backendStatus as any)?.onStatus === 'function') {
        (backendStatus as any).onStatus(handler);
      }
      if (typeof (backendStatus as any)?.startPolling === 'function') {
        (backendStatus as any).startPolling(60000);
      }
  } catch (error) { console.warn('Error fetching products stats:', error); }
    return () => {
      try {
        if (typeof (backendStatus as any)?.offStatus === 'function') {
          (backendStatus as any).offStatus(handler);
        }
  } catch (error) { console.warn('Error fetching clients stats:', error); }
    };
  }, [testMode]);

  // Refrescar en tiempo real cuando se crea una venta desde cualquier lugar
  useEffect(() => {
    if (testMode) return;
    const onSaleCreated = () => {
      // Forzar refresh inmediato del dashboard
      fetchDashboardStats(true);
    };
    window.addEventListener('sale:created', onSaleCreated as EventListener);
    return () => {
      window.removeEventListener('sale:created', onSaleCreated as EventListener);
    };
  }, [testMode]);

  const fetchDashboardStats = async (isRefresh = false) => {
    if (testMode) {
      // En modo prueba, no realizar llamadas de red ni actualizar toasts
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      // Si el breaker está abierto y no es refresh manual, saltar intento
      if (!isRefresh && nextRetryAt && Date.now() < nextRetryAt) {
        setRealTimeMetrics(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
        return;
      }
      // Evitar llamadas si no hay autenticación
      if (!user) {
        setRealTimeMetrics(prev => ({
          ...prev,
          connectionStatus: 'disconnected'
        }));
        if (!isRefresh) {
          // Evitar actualizar otra UI durante render: notificar en microtarea
          setTimeout(() => {
            addNotification({
              type: 'info',
              title: 'Inicia sesión para ver datos reales',
              message: 'El dashboard requiere autenticación para cargar métricas del servidor.'
            });
          }, 0);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!isRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      setRealTimeMetrics(prev => ({
        ...prev,
        connectionStatus: 'connected'
      }));

      // Reintentos con backoff simple y uso de caché local cuando falle
      const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
      const DASHBOARD_CACHE_KEY = (period: string) => `dashboard-cache:${period}`;
      const readDashboardCache = (period: string): DashboardStats | null => {
        try {
          const raw = localStorage.getItem(DASHBOARD_CACHE_KEY(period));
          if (!raw) return null;
          
          const parsed = JSON.parse(raw);
          
          // Validar estructura básica
          if (!parsed || typeof parsed !== 'object') return null;
          
          // Validar campos requeridos
          const requiredFields = ['totalSales', 'totalRevenue', 'totalClients'];
          const hasAllFields = requiredFields.every(field => 
            typeof parsed[field] === 'number' && !isNaN(parsed[field])
          );
          
          if (!hasAllFields) {
            console.warn('Cache integrity check failed - removing corrupted data');
            localStorage.removeItem(DASHBOARD_CACHE_KEY(period));
            return null;
          }
          
          return parsed;
        } catch (error) {
          console.error('Error reading dashboard cache:', error);
          localStorage.removeItem(DASHBOARD_CACHE_KEY(period));
          return null;
        }
      };
      const writeDashboardCache = (period: string, data: DashboardStats) => {
        try {
          localStorage.setItem(DASHBOARD_CACHE_KEY(period), JSON.stringify(data));
  } catch (error) { console.warn('Error fetching sales stats:', error); }
      };

      let dashboardData: DashboardStats = {
        // KPIs principales
        totalSales: 0,
        totalRevenue: 0,
        totalClients: 0,
        activeClients: 0,
        totalJewelry: 0,
        lowStockJewelry: 0,

        // Métricas del día
        todaySales: 0,
        todayRevenue: 0,
        todayTransactions: 0,
        todayAverageTicket: 0,

        // Métricas en tiempo real
        currentHourSales: 0,
        currentHourRevenue: 0,
        activeUsers: 0,
        pendingOrders: 0,

        // Comparaciones
        salesGrowth: 0,
        revenueGrowth: 0,
        clientGrowth: 0,

        // Datos para gráficos
        recentSales: [],
        salesData: [],
        revenueData: [],
        hourlyData: [],
        paymentMethodData: [],
        topProducts: [],
        topClients: [],
        alerts: []
      };

      try {
        // Asegurar baseURL inicializada antes de llamar
        await initializeApiBaseUrl();

        // Intentar obtener datos de la API real con reintentos exponenciales
        const maxRetries = 2;
        let response: { data?: any } | undefined;
        
        // Timeout de protección para evitar cargas indefinidas
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de carga excedido (5s)')), 5000)
        );
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Usar Promise.race para limitar tiempo de carga
            const raceResult = await Promise.race([
              api.get('/reports/dashboard', {
                params: { period: filters.period },
                __suppressGlobalError: true as any,
                headers: { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' },
              } as any),
              timeoutPromise
            ]);
            response = raceResult as { data?: any };
            break;
          } catch (err: any) {
            const status = err?.response?.status;
            if (status === 401 || status === 403 || status === 429) throw err;
            if (attempt >= maxRetries) throw err;
            const delay = 1500 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
            await sleep(delay);
          }
        }

        if (response?.data) {
          const parsed = parseApiResponseWithSchema<Record<string, unknown>>(response.data, z.object({}).passthrough());
          if (!parsed.success) {
            throw new Error('API response not successful');
          }
          const backendData: Record<string, any> = (parsed.data ?? {}) as any;

          // Normalizaciones y cálculos seguros con fallbacks
          const salesDataArr = Array.isArray(backendData?.salesData) ? backendData.salesData : [];
          const revenueDataArr = Array.isArray(backendData?.revenueData) ? backendData.revenueData : [];
          const recentSalesArr = Array.isArray(backendData?.recentSales) ? backendData.recentSales : [];

          const today = new Date();
          const todayStr = today.toDateString();
          const todaySalesArr = recentSalesArr.filter((sale: any) => {
            const saleDate = new Date(sale?.date);
            return saleDate.toDateString() === todayStr;
          });

          const sum = (list: any[], key: string) => list.reduce((acc, item) => acc + Number(item?.[key] ?? 0), 0);

          const computedTotalSales = Number(backendData?.summary?.totalSales ?? backendData?.sales?.thisMonth ?? sum(salesDataArr, 'ventas'));
          const computedTotalRevenue = Number(
            backendData?.summary?.totalRevenue ??
            (sum(revenueDataArr, 'ingresos') || recentSalesArr.reduce((acc: number, s: any) => acc + Number(s?.total ?? 0), 0))
          );

          const computedTodayRevenue = todaySalesArr.reduce((acc: number, s: any) => acc + Number(s?.total ?? 0), 0);
          const computedTodaySales = Number(backendData?.realTimeMetrics?.todaySales ?? todaySalesArr.length);

          const salesGrowth = Number(backendData?.comparison?.salesGrowth ?? backendData?.sales?.growth?.daily ?? 0);
          const revenueGrowth = Number(backendData?.comparison?.revenueGrowth ?? backendData?.sales?.growth?.monthly ?? 0);

          // Mapear datos del backend al formato del frontend con valores coherentes
          dashboardData = {
            // KPIs principales
            totalSales: computedTotalSales,
            totalRevenue: computedTotalRevenue,
            totalClients: Number(backendData?.customers?.total ?? 0),
            activeClients: Number(backendData?.customers?.active ?? backendData?.customers?.total ?? 0),
            totalJewelry: Number(backendData?.inventory?.totalJewelry ?? 0),
            lowStockJewelry: Number(backendData?.inventory?.lowStockItems ?? 0),

            // Métricas del día
            todaySales: computedTodaySales,
            todayRevenue: computedTodayRevenue,
            todayTransactions: todaySalesArr.length,
            todayAverageTicket: computedTodaySales > 0 ? computedTodayRevenue / Math.max(1, computedTodaySales) : 0,

            // Métricas en tiempo real (sólo si hay datos)
            currentHourSales: computedTodaySales > 0 ? Math.floor(computedTodaySales / 8) : 0,
            currentHourRevenue: computedTodayRevenue > 0 ? Math.floor(computedTodayRevenue / 8) : 0,
            activeUsers: 1, // Usuario actual
            pendingOrders: 0, // Por implementar

            // Comparaciones
            salesGrowth,
            revenueGrowth,
            clientGrowth: Number(backendData?.customers?.newThisMonth ?? 0) > 0
              ? (Number(backendData?.customers?.newThisMonth ?? 0) / Math.max(1, Number(backendData?.customers?.total ?? 0) - Number(backendData?.customers?.newThisMonth ?? 0))) * 100
              : 0,

            // Datos para gráficos
            recentSales: recentSalesArr.map((sale: any) => ({
              id: String(sale?.id ?? ''),
              total: Number(sale?.total ?? 0),
              clientName: String(sale?.customerName ?? ''),
              createdAt: new Date(sale?.date ?? Date.now()).toISOString(),
              paymentMethod: String(sale?.paymentMethod ?? ''),
              items: Number(sale?.items ?? 1),
              cardReference: sale?.cardReference ?? sale?.paymentDetails?.cardReference ?? undefined,
              transferReference: sale?.transferReference ?? sale?.paymentDetails?.transferReference ?? undefined
            })),

            // Datos reales para gráficos del backend
            salesData: salesDataArr,
            revenueData: revenueDataArr,
            hourlyData: Array.isArray(backendData?.hourlyData) ? backendData.hourlyData : [],
            paymentMethodData: Array.isArray(backendData?.paymentMethodData) ? backendData.paymentMethodData : [],
            topProducts: Array.isArray(backendData?.topProducts) ? backendData.topProducts : [],
            topClients: Array.isArray(backendData?.customers?.topCustomers)
              ? backendData.customers.topCustomers.map((customer: any) => ({
                  id: String(customer?.id ?? ''),
                  name: String(customer?.name ?? ''),
                  purchases: Number(customer?.totalPurchases ?? 0),
                  totalSpent: Number(customer?.totalRevenue ?? 0),
                  lastPurchase: new Date().toISOString()
                }))
              : [],
            alerts: [] // Se generarán después con datos reales
          };

          // Sincronizar métricas con store local de clientes para reflejar cambios inmediatos
          try {
            const { clients } = useClientsStore.getState();
            if (Array.isArray(clients)) {
              const activeCount = clients.filter((c: any) => !!c?.isActive).length;
              const totalCount = clients.length;
              const totalClientRevenue = clients.reduce((sum: number, c: any) => sum + (Number(c?.totalPurchases) || 0), 0);
              dashboardData.activeClients = activeCount;
              dashboardData.totalClients = totalCount;
              // Ajustar ingresos con datos locales si existen
              if (!Number.isNaN(totalClientRevenue)) {
                dashboardData.totalRevenue = totalClientRevenue;
              }
            }
          } catch {/* noop */}

          // Persistir caché local para usar en modo degradado si falla luego
          writeDashboardCache(filters.period, dashboardData);
        } else {
          throw new Error('API response not successful');
        }
      } catch (apiError) {
        console.warn('Dashboard: usando caché por fallo temporal de API');
        // Fallback: usar la última versión en caché si existe para evitar pantalla vacía
        const cached = readDashboardCache(filters.period);
        if (cached) {
          dashboardData = cached;
          const nowWarn = Date.now();
          if (!cacheWarnShownRef.current || nowWarn - cacheWarnShownRef.current > 60000) {
            setTimeout(() => {
              addNotification({
                type: 'warning',
                title: 'Mostrando datos en caché',
                message: 'Se muestran métricas guardadas por un fallo temporal de la API'
              });
            }, 0);
            cacheWarnShownRef.current = nowWarn;
          }
        } else {
          throw apiError; // No hay caché, propagar
        }
      }
      
      setStats(dashboardData);
      
      setRealTimeMetrics(prev => ({
        ...prev,
        lastUpdate: new Date().toISOString(),
        connectionStatus: 'connected'
      }));
      // Resetear breaker al éxito
      setFailureCount(0);
      setNextRetryAt(null);
      breakerNotifiedRef.current = false;

      
      
      if (isRefresh) {
        setTimeout(() => {
          addNotification({
            type: 'success',
            title: 'Dashboard actualizado',
            message: 'Los datos se han actualizado correctamente'
          });
        }, 0);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setLastErrorMessage(errorMessage);
      
      // Actualizar tracking de errores detallado
      setErrorInfo(prev => {
        const now = Date.now();
        const newCount = prev.count + 1;
        const firstErrorTime = prev.firstErrorTime || now;
        const timeSinceFirstError = now - firstErrorTime;
        const minutes = Math.floor(timeSinceFirstError / 60000);
        
        // Notificar si hay problemas persistentes
        if (newCount >= 3 && !prev.firstErrorTime) {
          setTimeout(() => {
            addNotification({
              type: 'error',
              title: 'Problemas persistentes de conexión',
              message: `Llevamos ${newCount} intentos fallidos en ${minutes} minutos. Verifica tu conexión o contacta soporte.`
            });
          }, 0);
        }
        
        return {
          count: newCount,
          lastError: errorMessage,
          firstErrorTime: firstErrorTime
        };
      });
      
      setRealTimeMetrics(prev => ({
        ...prev,
        connectionStatus: 'disconnected'
      }));
      // Incrementar contador y abrir breaker si supera umbral
      setFailureCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          const cooldownMs = 30_000; // 30s
          setNextRetryAt(Date.now() + cooldownMs);
          setRealTimeMetrics((p) => ({ ...p, connectionStatus: 'reconnecting' }));
          if (!breakerNotifiedRef.current) {
            setTimeout(() => {
              addNotification({
                type: 'warning',
                title: 'Conexión inestable',
                message: 'Pausamos intentos por 30s para evitar saturar el servidor.'
              });
            }, 0);
            breakerNotifiedRef.current = true;
          }
        }
        return next;
      });
      
      // Evitar notificación de error si ya mostramos aviso de caché
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh configurable según el intervalo seleccionado
  useEffect(() => {
    if (testMode) return;
    
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;
    
    const scheduleNextUpdate = () => {
      if (isCancelled) return;
      
      timeoutId = setTimeout(() => {
        if (isCancelled) return;
        
        const now = Date.now();
        const canAttempt = !nextRetryAt || now >= nextRetryAt;
        
        if (realTimeMetrics.isLive && !isOffline && canAttempt) {
          fetchDashboardStats(true).catch(error => {
            if (!isCancelled) {
              console.error('Auto-refresh failed:', error);
            }
          });
        }
        
        scheduleNextUpdate(); // Programar siguiente actualización
      }, refreshInterval);
    };
    
    scheduleNextUpdate();
    
    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [realTimeMetrics.isLive, isOffline, nextRetryAt, refreshInterval, fetchDashboardStats, testMode]);

  const handleRefresh = useCallback(() => {
    fetchDashboardStats(true);
  }, []);

  const toggleRealTime = useCallback(() => {
    setRealTimeMetrics(prev => ({
      ...prev,
      isLive: !prev.isLive
    }));
  }, []);

  // `handleFilterChange` proviene de useDashboardUrlSync

  const resetFilters = useCallback(() => {
    try {
      localStorage.removeItem('dashboard_filters_v1');
  } catch (error) { console.warn('Error updating UI state in Dashboard:', error); }
    setFilters({ period: 'today', comparison: false, showAmounts: true });
    setTimeout(() => {
      addNotification({
        type: 'success',
        title: 'Filtros restablecidos',
        message: 'Se aplicaron los valores por defecto.'
      });
    }, 0);
  }, [addNotification]);

  // Lista filtrada para la tabla de "Ventas recientes"
  const filteredRecentSales = useMemo(() => {
    try {
      let list = stats.recentSales || [];
      if (recentSalesFilters.hasReference) {
        list = list.filter((s) => !!(s.cardReference || s.transferReference));
      }
      const q = (recentSalesFilters.referenceQuery || '').trim().toLowerCase();
      if (q) {
        list = list.filter((s) => {
          const card = String(s.cardReference || '').toLowerCase();
          const transf = String(s.transferReference || '').toLowerCase();
          return (card && card.includes(q)) || (transf && transf.includes(q));
        });
      }
      return list;
    } catch {
      return stats.recentSales || [];
    }
  }, [stats.recentSales, recentSalesFilters.hasReference, recentSalesFilters.referenceQuery]);

  // Utility functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getGrowthIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-blue-500" />;
    }
  };

  

  if (loading) {
    // Mostrar skeletons mientras carga el dashboard
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <Skeleton className="w-48 h-6 mb-2" variant="text" />
              <Skeleton className="w-72 h-4" variant="text" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-24 h-8" />
              <Skeleton className="w-24 h-8" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
          <div className="mt-4">
            <Skeleton className="w-64 h-3" variant="text" />
          </div>
        </div>

        {/* KPIs skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {['sales','revenue','clients','products'].map((label) => (
            <div key={`kpi-${label}`} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div>
                    <Skeleton className="w-24 h-4 mb-2" variant="text" />
                    <Skeleton className="w-20 h-5" />
                  </div>
                </div>
                <Skeleton className="w-14 h-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {['sales-trend','revenue-goal'].map((label) => (
            <div key={`chart-${label}`} className="bg-white rounded-lg shadow-sm border p-6">
              <Skeleton className="w-32 h-6 mb-4" />
              <Skeleton className="w-full h-64" />
            </div>
          ))}
        </div>

        {/* Recent sales skeleton */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <Skeleton className="w-40 h-6 mb-4" />
          {['row-1','row-2','row-3','row-4','row-5'].map((key) => (
            <div key={key} className="flex items-center justify-between py-3">
              <Skeleton className="w-40 h-4" variant="text" />
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-20 h-6" />
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-28 h-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8F8F8F] font-ui">Error al cargar las estadísticas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Real-time Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ¡Bienvenido, {user?.firstName || 'Usuario'}!
            </h1>
            <p className="text-gray-600 mt-1">
              Dashboard en tiempo real - {new Date().toLocaleDateString('es-CO', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                realTimeMetrics.connectionStatus === 'connected' ? 'bg-green-500' :
                realTimeMetrics.connectionStatus === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} title={`Estado de conexión: ${realTimeMetrics.connectionStatus}`} />
              <span className="text-sm text-gray-600 px-2 py-1 rounded border" title="Estado del servidor backend">
                {realTimeMetrics.connectionStatus === 'connected' ? 'Conectado' :
                 realTimeMetrics.connectionStatus === 'reconnecting' ? 'Reconectando' : 'Desconectado'}
              </span>
              {backendHealthMode === 'no_health' && (
                <span
                  data-testid="no-health-badge"
                  className="text-xs px-2 py-1 rounded border bg-yellow-50 text-yellow-700 border-yellow-200"
                  title="Servidor disponible sin endpoint de health; usando endpoints públicos"
                >
                  Servidor sin /health (operativo)
                </span>
              )}
            </div>

            {/* Real-time Toggle */}
            <button
              onClick={toggleRealTime}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                realTimeMetrics.isLive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={`Auto-refresh ${realTimeMetrics.isLive ? 'activo' : 'pausado'}`}
            >
              <Activity className="w-4 h-4" />
              {realTimeMetrics.isLive ? 'En Vivo' : 'Pausado'}
            </button>

            {/* Refresh interval selector */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border"
                title="Configura cada cuánto se actualiza automáticamente"
              >
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
                <option value={60000}>60s</option>
                <option value={120000}>120s</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || backendHealthMode === 'down'}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              title={backendHealthMode === 'down' ? 'Servidor no disponible: espera reconexión antes de refrescar.' : 'Forzar actualización ahora'}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            {/* Filters Button */}
            <button
              onClick={() => setShowFiltersModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Abrir filtros del Dashboard"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>

            {/* Reset Filters */}
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Restablecer filtros a valores por defecto"
            >
              <XCircle className="w-4 h-4" />
              Reset
            </button>

            {/* Copy Dashboard Link */}
            <button
              onClick={async () => {
                await copyUrlWithParams(location.pathname, location.search, undefined, addNotification, {
                  successMessage: 'URL con filtros del Dashboard',
                });
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Copiar enlace del Dashboard"
            >
              <Copy className="w-4 h-4" />
              Copiar enlace
            </button>
          </div>
        </div>

        {/* Last Update Info */}
        <div className="mt-4 text-xs text-gray-500">
          Última actualización: {new Date(realTimeMetrics.lastUpdate).toLocaleString('es-CO')}
        </div>

        {/* Estado degradado / caído del backend */}
        {backendHealthMode !== 'ok' && (
          <div className={`mt-3 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {backendHealthMode === 'down' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <span>
                  {backendHealthMode === 'down'
                    ? 'Servidor no disponible. El dashboard puede mostrar datos congelados.'
                    : 'Modo degradado: el servicio de salud del backend no está disponible.'}
                </span>
              </div>
              <div className="text-xs">
                {backendHealthMode === 'down'
                  ? 'Escrituras en páginas sensibles estarán deshabilitadas.'
                  : 'Escrituras críticas estarán deshabilitadas en Ventas.'}
              </div>
            </div>
          </div>
        )}

        {/* Panel de error con detalle */}
        {realTimeMetrics.connectionStatus === 'disconnected' && (
          <div className="mt-4 p-4 border rounded bg-red-50 border-red-200 text-red-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>Error al cargar datos del dashboard.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs rounded border bg-white"
                  onClick={() => setShowErrorDetails(v => !v)}
                >
                  {showErrorDetails ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
                <button
                  className="px-2 py-1 text-xs rounded border bg-white"
                  onClick={handleRefresh}
                >
                  Reintentar
                </button>
              </div>
            </div>
            {showErrorDetails && (
              <div className="mt-2 text-xs text-red-800">
                {lastErrorMessage || 'Sin detalles disponibles'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced KPIs with Growth Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Sales KPI */}
        <div className="bg-white rounded-lg shadow-sm border p-6" title="Ventas totales del período seleccionado">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Ventas Totales</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalSales)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(stats.salesGrowth)}
              <span className={`text-sm font-medium ${getGrowthColor(stats.salesGrowth)}`}>
                {formatPercentage(stats.salesGrowth)}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue KPI */}
        <div className="bg-white rounded-lg shadow-sm border p-6" title="Ingresos totales del período seleccionado">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filters.showAmounts ? formatCurrency(stats.totalRevenue) : '***'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(stats.revenueGrowth)}
              <span className={`text-sm font-medium ${getGrowthColor(stats.revenueGrowth)}`}>
                {formatPercentage(stats.revenueGrowth)}
              </span>
            </div>
          </div>
        </div>

        {/* Clients KPI */}
        <div className="bg-white rounded-lg shadow-sm border p-6" title="Número estimado de clientes activos">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Clientes Activos</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeClients)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getGrowthIcon(stats.clientGrowth)}
              <span className={`text-sm font-medium ${getGrowthColor(stats.clientGrowth)}`}>
                {formatPercentage(stats.clientGrowth)}
              </span>
            </div>
          </div>
        </div>

        {/* Products KPI */}
        <div className="bg-white rounded-lg shadow-sm border p-6" title="Total de joyas en stock; alerta por bajo inventario">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Gem className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Joyas Activas</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalJewelry)}</p>
              </div>
            </div>
            {stats.lowStockJewelry > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">{stats.lowStockJewelry}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Ventas de Hoy</p>
              <p className="text-3xl font-bold">{formatNumber(stats.todaySales)}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Ingresos de Hoy</p>
              <p className="text-3xl font-bold">
                {filters.showAmounts ? formatCurrency(stats.todayRevenue) : '***'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Transacciones</p>
              <p className="text-3xl font-bold">{formatNumber(stats.todayTransactions)}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Ticket Promedio</p>
              <p className="text-3xl font-bold">
                {filters.showAmounts ? formatCurrency(stats.todayAverageTicket) : '***'}
              </p>
            </div>
            <Target className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900" title="Ventas y transacciones por período">Tendencia de Ventas</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          {stats.salesData && stats.salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <ComposedChart data={stats.salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="ventas" fill="#3B82F6" name="Ventas" />
                <Line yAxisId="right" type="monotone" dataKey="transacciones" stroke="#10B981" strokeWidth={2} name="Transacciones" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Sin datos de ventas para el período seleccionado</p>
            </div>
          )}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Ingresos vs Meta</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          {stats.revenueData && stats.revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <AreaChart data={stats.revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="ingresos" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Ingresos" />
                <Line type="monotone" dataKey="meta" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" name="Meta" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Sin datos de ingresos para el período seleccionado</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods & Hourly Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Métodos de Pago</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          {stats.paymentMethodData && stats.paymentMethodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <RechartsPieChart>
                <Pie
                  data={stats.paymentMethodData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={(entry: any) => `${String(entry?.name ?? '')} ${String(entry?.percentage ?? '')}%`}
                >
                  {stats.paymentMethodData.map((entry) => (
                    <Cell key={getStableKey(entry.name, entry.value)} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Sin datos de métodos de pago</p>
            </div>
          )}
        </div>

        {/* Hourly Performance */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Rendimiento por Hora</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          {stats.hourlyData && stats.hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={stats.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ventas" fill="#3B82F6" name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Sin datos por hora para el período seleccionado</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Performers & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Productos Top</h3>
            <Star className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.topProducts && stats.topProducts.length > 0 ? (
              stats.topProducts.slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {typeof product.category === 'string'
                          ? product.category
                          : (product.category && (product.category as any).name)
                            ? (product.category as any).name
                            : 'Sin categoría'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{product.sales} ventas</p>
                    <p className="text-sm text-gray-500">
                      {filters.showAmounts ? formatCurrency(product.revenue) : '***'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No hay productos destacados</p>
                <p className="text-sm text-gray-500">Aún no se registran ventas suficientes</p>
              </div>
            )}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Alertas del Sistema</h3>
            <Bell className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {stats.alerts.length > 0 ? (
              stats.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.type === 'error' ? 'bg-red-50 border-red-200' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    alert.type === 'success' ? 'bg-green-50 border-green-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString('es-CO')}
                    </p>
                  </div>
                  {alert.action && (
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      {alert.action}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">No hay alertas activas</p>
                <p className="text-sm text-gray-500">Todos los sistemas funcionan correctamente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Ventas Recientes</h3>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Últimas 10 transacciones</span>
            <button
              onClick={async () => {
                const q = (recentSalesFilters.referenceQuery || '').trim();
                await copyUrlWithParams(
                  location.pathname,
                  location.search,
                  {
                    recentRef: recentSalesFilters.hasReference ? '1' : null,
                    recentQuery: q || null,
                  },
                  addNotification,
                  { successMessage: 'URL con filtros de ventas recientes' }
                );
              }}
              className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border"
              title="Copiar enlace con filtros"
            >
              <Copy className="w-4 h-4" />
              Copiar enlace
            </button>
          </div>
        </div>
        {/* Filtros de referencia para Ventas Recientes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <label className="inline-flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              className="mr-2 rounded border-gray-300"
              checked={recentSalesFilters.hasReference}
              onChange={(e) => setRecentSalesFilters((prev) => ({ ...prev, hasReference: e.target.checked }))}
            />
            Con referencia
          </label>
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Buscar referencia"
              value={recentSalesFilters.referenceQuery}
              onChange={(e) => setRecentSalesFilters((prev) => ({ ...prev, referenceQuery: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método de Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecentSales.length > 0 ? (
                filteredRecentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sale.clientName || 'Cliente General'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {filters.showAmounts ? formatCurrency(sale.total) : '***'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-800' :
                        sale.paymentMethod === 'card' ? 'bg-blue-100 text-blue-800' :
                        sale.paymentMethod === 'transfer' ? 'bg-purple-100 text-purple-800' :
                        sale.paymentMethod === 'mixed' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.paymentMethod === 'cash' ? 'Efectivo' :
                         sale.paymentMethod === 'card' ? 'Tarjeta' :
                         sale.paymentMethod === 'transfer' ? 'Transferencia' :
                         sale.paymentMethod === 'mixed' ? 'Mixto' : sale.paymentMethod}
                      </span>
                      {(sale.cardReference || sale.transferReference) && (
                        <div className="mt-1 text-xs text-gray-600">
                          {sale.cardReference && (
                            <span className="inline-flex items-center mr-2">
                              <CreditCard className="h-3 w-3 mr-1" />
                              <span className="font-mono">{String(sale.cardReference)}</span>
                            </span>
                          )}
                          {sale.transferReference && (
                            <span className="inline-flex items-center">
                              <Smartphone className="h-3 w-3 mr-1" />
                              <span className="font-mono">{String(sale.transferReference)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.items} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.createdAt).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No hay ventas recientes</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ReportTest Component for Phase 5 Testing */}
      <ReportTest />



      {/* Filters Modal */}
      {showFiltersModal && (
        <Modal
          isOpen={showFiltersModal}
          onClose={() => setShowFiltersModal(false)}
          title="Configurar Filtros"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período de Tiempo
              </label>
              <select
                value={filters.period}
                onChange={(e) => handleFilterChange({ period: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="today">Hoy</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mes</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Año</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Mostrar Comparación
              </label>
              <button
                onClick={() => handleFilterChange({ comparison: !filters.comparison })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  filters.comparison ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    filters.comparison ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Mostrar Montos
              </label>
              <button
                onClick={() => handleFilterChange({ showAmounts: !filters.showAmounts })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  filters.showAmounts ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    filters.showAmounts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowFiltersModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await copyUrlWithParams(
                    location.pathname,
                    location.search,
                    {
                      period: filters.period,
                      comparison: filters.comparison ? '1' : '0',
                      showAmounts: filters.showAmounts ? '1' : '0',
                    },
                    addNotification,
                    { successMessage: 'URL con filtros del Dashboard' }
                  );
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                title="Copiar enlace del Dashboard"
                type="button"
              >
                <Copy className="w-4 h-4" />
                Copiar enlace
              </button>
              <button
                onClick={() => {
                  setShowFiltersModal(false);
                  fetchDashboardStats();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DashboardPage;
