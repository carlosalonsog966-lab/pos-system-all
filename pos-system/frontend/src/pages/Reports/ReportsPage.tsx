import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStableKey } from '@/lib/utils';
import {
  DocumentArrowDownIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShareIcon,
  ClockIcon,
  PresentationChartLineIcon,
  UserGroupIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { 
  Diamond, 
  RefreshCw, 
  BarChart3,
  LineChart,
  Activity,
  Target,
  Zap,
  AlertCircle,
  TrendingUp as TrendingUpLucide,
  DollarSign,
  Users,
  ShoppingBag,
  Eye,
  FileText
} from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { useOfflineStore } from '@/store/offlineStore';
import { api, parseApiResponse, parseApiResponseWithSchema, backendStatus } from '@/lib/api';
import { z } from 'zod';
import { DashboardMetrics } from './components/DashboardMetrics';
import { SalesCharts } from './components/SalesCharts';
import { InventoryCharts } from './components/InventoryCharts';
import { FinancialCharts } from './components/FinancialCharts';
import { JewelryCharts } from './components/JewelryCharts';
import LoadingSpinner from '@/components/Common/LoadingSpinner';

interface ReportData {
  salesByDay: Array<{ date: string; sales: number; revenue: number; transactions: number; customers: number }>;
  salesByCategory: Array<{ category: string; sales: number; revenue: number; transactions: number; growth: number }>;
  salesByHour: Array<{ hour: number; sales: number; revenue: number; transactions: number }>;
  salesByPaymentMethod: Array<{ method: string; amount: number; transactions: number; percentage: number }>;
  topProducts: Array<{ 
    id: string; 
    name: string; 
    quantity: number; 
    revenue: number; 
    category: string; 
    margin: number;
    growth: number;
  }>;
  topClients: Array<{ 
    id: string;
    name: string; 
    purchases: number; 
    revenue: number; 
    lastPurchase: string;
    segment: string;
    loyaltyPoints: number;
  }>;
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
    totalClients: number;
    newClients: number;
    returningClients: number;
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalProfit: number;
    profitMargin: number;
    conversionRate: number;
    customerRetention: number;
  };
  comparison: {
    salesGrowth: number;
    revenueGrowth: number;
    transactionGrowth: number;
    clientGrowth: number;
    profitGrowth: number;
    marginGrowth: number;
  };
  forecasting: {
    nextMonthSales: number;
    nextMonthRevenue: number;
    seasonalTrends: Array<{ month: string; predicted: number; confidence: number }>;
    recommendations: Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }>;
  };
  realTimeMetrics: {
    todaySales: number;
    todayTransactions: number;
    currentHourSales: number;
    activeUsers: number;
    pendingOrders: number;
    lowStockAlerts: number;
  };
}

// Esquema Zod flexible para datos crudos de reportes; permite variaciones y campos opcionales
const ReportDataRawSchema = z.object({
  salesByDay: z.array(z.any()).default([]),
  salesByCategory: z.array(z.any()).default([]),
  salesByHour: z.array(z.any()).default([]),
  salesByPaymentMethod: z.array(z.any()).default([]),
  topProducts: z.array(z.any()).default([]),
  topClients: z.array(z.any()).default([]),
  summary: z.object({}).passthrough().optional(),
  comparison: z.object({}).passthrough().optional(),
  forecasting: z.object({}).passthrough().optional(),
  realTimeMetrics: z.object({}).passthrough().optional(),
}).partial().passthrough();

// Normaliza el payload del backend para evitar campos indefinidos
function normalizeReportData(input: any): ReportData {
  const safeArray = (arr: any, defaultVal: any[] = []) => Array.isArray(arr) ? arr : defaultVal;

  const salesByDay = safeArray(input?.salesByDay).map((d: any) => ({
    date: String(d?.date ?? ''),
    sales: Number(d?.sales ?? 0),
    revenue: Number(d?.revenue ?? 0),
    transactions: Number(d?.transactions ?? 0),
    customers: Number(d?.customers ?? 0),
  }));

  const salesByCategory = safeArray(input?.salesByCategory).map((c: any) => ({
    category: String(c?.category ?? ''),
    sales: Number(c?.sales ?? 0),
    revenue: Number(c?.revenue ?? 0),
    transactions: Number(c?.transactions ?? 0),
    growth: Number(c?.growth ?? 0),
  }));

  const salesByHour = safeArray(input?.salesByHour).map((h: any) => ({
    hour: Number(h?.hour ?? 0),
    sales: Number(h?.sales ?? 0),
    revenue: Number(h?.revenue ?? 0),
    transactions: Number(h?.transactions ?? 0),
  }));

  const salesByPaymentMethod = safeArray(input?.salesByPaymentMethod).map((m: any) => ({
    method: String(m?.method ?? ''),
    amount: Number(m?.amount ?? 0),
    transactions: Number(m?.transactions ?? 0),
    percentage: Number(m?.percentage ?? 0),
  }));

  const topProducts = safeArray(input?.topProducts).map((p: any) => ({
    id: String(p?.id ?? ''),
    name: String(p?.name ?? ''),
    quantity: Number(p?.quantity ?? 0),
    revenue: Number(p?.revenue ?? 0),
    category: String(p?.category ?? ''),
    margin: Number(p?.margin ?? 0),
    growth: Number(p?.growth ?? 0),
  }));

  const topClients = safeArray(input?.topClients).map((c: any) => ({
    id: String(c?.id ?? ''),
    name: String(c?.name ?? ''),
    purchases: Number(c?.purchases ?? 0),
    revenue: Number(c?.revenue ?? 0),
    lastPurchase: String(c?.lastPurchase ?? ''),
    segment: String(c?.segment ?? ''),
    loyaltyPoints: Number(c?.loyaltyPoints ?? 0),
  }));

  const summary = {
    totalSales: Number(input?.summary?.totalSales ?? 0),
    totalRevenue: Number(input?.summary?.totalRevenue ?? 0),
    totalTransactions: Number(input?.summary?.totalTransactions ?? 0),
    averageTicket: Number(input?.summary?.averageTicket ?? 0),
    totalClients: Number(input?.summary?.totalClients ?? 0),
    newClients: Number(input?.summary?.newClients ?? 0),
    returningClients: Number(input?.summary?.returningClients ?? 0),
    totalProducts: Number(input?.summary?.totalProducts ?? 0),
    lowStockProducts: Number(input?.summary?.lowStockProducts ?? 0),
    outOfStockProducts: Number(input?.summary?.outOfStockProducts ?? 0),
    totalProfit: Number(input?.summary?.totalProfit ?? 0),
    profitMargin: Number(input?.summary?.profitMargin ?? 0),
    conversionRate: Number(input?.summary?.conversionRate ?? 0),
    customerRetention: Number(input?.summary?.customerRetention ?? 0),
  };

  const comparison = {
    salesGrowth: Number(input?.comparison?.salesGrowth ?? 0),
    revenueGrowth: Number(input?.comparison?.revenueGrowth ?? 0),
    transactionGrowth: Number(input?.comparison?.transactionGrowth ?? 0),
    clientGrowth: Number(input?.comparison?.clientGrowth ?? 0),
    profitGrowth: Number(input?.comparison?.profitGrowth ?? 0),
    marginGrowth: Number(input?.comparison?.marginGrowth ?? 0),
  };

  const forecasting = {
    nextMonthSales: Number(input?.forecasting?.nextMonthSales ?? 0),
    nextMonthRevenue: Number(input?.forecasting?.nextMonthRevenue ?? 0),
    seasonalTrends: safeArray(input?.forecasting?.seasonalTrends).map((s: any) => ({
      month: String(s?.month ?? ''),
      predicted: Number(s?.predicted ?? 0),
      confidence: Number(s?.confidence ?? 0),
    })),
    recommendations: safeArray(input?.forecasting?.recommendations).map((r: any) => ({
      type: String(r?.type ?? ''),
      message: String(r?.message ?? ''),
      priority: (r?.priority ?? 'low') as 'high' | 'medium' | 'low',
    })),
  };

  const realTimeMetrics = {
    todaySales: Number(input?.realTimeMetrics?.todaySales ?? 0),
    todayTransactions: Number(input?.realTimeMetrics?.todayTransactions ?? 0),
    currentHourSales: Number(input?.realTimeMetrics?.currentHourSales ?? 0),
    activeUsers: Number(input?.realTimeMetrics?.activeUsers ?? 0),
    pendingOrders: Number(input?.realTimeMetrics?.pendingOrders ?? 0),
    lowStockAlerts: Number(input?.realTimeMetrics?.lowStockAlerts ?? 0),
  };

  return {
    salesByDay,
    salesByCategory,
    salesByHour,
    salesByPaymentMethod,
    topProducts,
    topClients,
    summary,
    comparison,
    forecasting,
    realTimeMetrics,
  };
}
interface FilterState {
  dateRange: {
    startDate: string;
    endDate: string;
    preset: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  reportType: 'dashboard' | 'sales' | 'inventory' | 'financial' | 'jewelry' | 'customers' | 'comparative';
  groupBy: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  categories: string[];
  paymentMethods: string[];
  customerSegments: string[];
  priceRange: { min: number; max: number };
  includeReturns: boolean;
  includeDiscounts: boolean;
  compareWithPrevious: boolean;
  realTimeUpdates: boolean;
  agencyId?: string | null;
  guideId?: string | null;
  branchId?: string | null;
}

const ReportsPage: React.FC<{ testMode?: boolean }> = ({ testMode = false }) => {
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
  const [reportData, setReportData] = useState<ReportData | null>(
    testMode ? normalizeReportData({}) : null
  );
  const [loading, setLoading] = useState(!testMode);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(!testMode);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'charts' | 'table' | 'cards'>('charts');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue', 'sales', 'transactions']);
  const [lastAutoToastAt, setLastAutoToastAt] = useState<number>(0);
  const AUTO_TOAST_COOLDOWN_MS = 60000;

  // Memoizar las fechas iniciales para evitar recálculos
  const initialDates = useMemo(() => ({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  }), []);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      preset: 'month'
    },
    reportType: 'dashboard',
    groupBy: 'day',
    categories: [],
    paymentMethods: [],
    customerSegments: [],
    priceRange: { min: 0, max: 100000 },
    includeReturns: true,
    includeDiscounts: true,
    compareWithPrevious: true,
    realTimeUpdates: !testMode,
    agencyId: null,
    guideId: null,
    branchId: null
  });

  const { showSuccess, showError, showWarning } = useNotificationStore();
  const { isOffline } = useOfflineStore();

  // Memoizar las dependencias para evitar re-renders innecesios
  const memoizedFilters = useMemo(() => filters, [
    filters.dateRange.startDate,
    filters.dateRange.endDate,
    filters.reportType,
    filters.groupBy,
    filters.categories.join(','),
    filters.paymentMethods.join(','),
    filters.customerSegments.join(','),
    filters.priceRange.min,
    filters.priceRange.max,
    filters.includeReturns,
    filters.includeDiscounts,
    filters.compareWithPrevious,
    filters.realTimeUpdates,
    filters.agencyId,
    filters.guideId,
    filters.branchId
  ]);

  // Presets de fechas
  const datePresets = [
    { key: 'today', label: 'Hoy', days: 0 },
    { key: 'yesterday', label: 'Ayer', days: 1 },
    { key: 'week', label: 'Esta semana', days: 7 },
    { key: 'month', label: 'Este mes', days: 30 },
    { key: 'quarter', label: 'Este trimestre', days: 90 },
    { key: 'year', label: 'Este año', days: 365 }
  ];

  const fetchReportData = useCallback(async (options?: { source?: 'event' | 'auto' | 'initial' }) => {
    try {
      setLoading(true);
      // Asegurar baseURL del cliente API inicializada
        try { const { initializeApiBaseUrl } = await import('@/lib/api'); await initializeApiBaseUrl(); } catch (error) { console.warn('initializeApiBaseUrl failed in ReportsPage:', error); }
      
      const queryParams = new URLSearchParams({
        startDate: memoizedFilters.dateRange.startDate,
        endDate: memoizedFilters.dateRange.endDate,
        groupBy: memoizedFilters.groupBy,
        includeReturns: memoizedFilters.includeReturns.toString(),
        includeDiscounts: memoizedFilters.includeDiscounts.toString(),
        compareWithPrevious: memoizedFilters.compareWithPrevious.toString(),
        categories: memoizedFilters.categories.join(','),
        paymentMethods: memoizedFilters.paymentMethods.join(','),
        customerSegments: memoizedFilters.customerSegments.join(','),
        minPrice: memoizedFilters.priceRange.min.toString(),
        maxPrice: memoizedFilters.priceRange.max.toString()
      });

      if (memoizedFilters.agencyId) {
        queryParams.append('agencyId', memoizedFilters.agencyId);
      }
      if (memoizedFilters.guideId) {
        queryParams.append('guideId', memoizedFilters.guideId);
      }
      if (memoizedFilters.branchId) {
        queryParams.append('branchId', memoizedFilters.branchId);
      }

      let apiUrl = '';
      switch (memoizedFilters.reportType) {
        case 'sales':
          apiUrl = `/reports/sales?${queryParams}`;
          break;
        case 'inventory':
          apiUrl = `/reports/inventory?${queryParams}`;
          break;
        case 'financial':
          apiUrl = `/reports/income-statement?${queryParams}`;
          break;
        case 'jewelry':
          apiUrl = `/reports/top-products?${queryParams}`;
          break;
        case 'customers':
          apiUrl = `/reports/customers?${queryParams}`;
          break;
        case 'comparative':
          apiUrl = `/reports/movements?${queryParams}`;
          break;
        case 'dashboard':
        default:
          apiUrl = `/reports/dashboard?${queryParams}`;
          break;
      }
      
      // Sin fallback a localStorage: usar exclusivamente servidor local

      const headers = memoizedFilters.reportType === 'dashboard'
        ? {}
        : { 'x-cache-permit': '1', 'x-cache-ttl-ms': '180000' };
      const response = await api.get(apiUrl, { __suppressGlobalError: true, headers } as any);
      const parsed = parseApiResponseWithSchema<any>(response.data, ReportDataRawSchema);
      if (!parsed.success) {
        throw new Error(parsed.error || 'Respuesta de API no exitosa');
      }
      const data = normalizeReportData(parsed.data ?? {});
      setReportData(data);
      setLastUpdated(new Date());
      // Notificar actualización (toast) también en auto-refresh, con cooldown
      const source = options?.source || 'initial';
      try {
        if (source === 'auto') {
          const now = Date.now();
          if (now - lastAutoToastAt > AUTO_TOAST_COOLDOWN_MS) {
            showSuccess('Datos de reportes actualizados');
            setLastAutoToastAt(now);
          }
        } else {
          showSuccess('Datos de reportes actualizados');
        }
    } catch (error) { console.warn('Error generating report in ReportsPage:', error); }
      
      // Guardar en localStorage para uso offline
      localStorage.setItem('lastReportData', JSON.stringify(data));
      localStorage.setItem('lastReportTimestamp', new Date().toISOString());
      
    } catch (error) {
      console.error('Error fetching report data:', error);
      showError('Error al cargar los datos del reporte');
      
      // Intentar cargar datos guardados localmente
      const savedData = localStorage.getItem('lastReportData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setReportData(normalizeReportData(parsed));
        showWarning('Mostrando datos guardados localmente');
      } else {
        console.warn('No hay datos de reporte disponibles');
        showWarning('No hay datos de reporte disponibles');
      }
    } finally {
      setLoading(false);
    }
  }, [memoizedFilters, isOffline, showError, showWarning, lastAutoToastAt]);

  // Refrescar reportes inmediatamente cuando se crea una venta
  useEffect(() => {
    if (testMode) return;
    const onSaleCreated = () => {
      fetchReportData({ source: 'event' });
    };
    window.addEventListener('sale:created', onSaleCreated as EventListener);
    return () => {
      window.removeEventListener('sale:created', onSaleCreated as EventListener);
    };
  }, [fetchReportData, testMode]);



  // Configurar auto-refresh
  useEffect(() => {
    if (testMode) return;
    if (autoRefresh && memoizedFilters.realTimeUpdates) {
      const interval = setInterval(() => fetchReportData({ source: 'auto' }), 30000); // Cada 30 segundos
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, memoizedFilters.realTimeUpdates, fetchReportData, testMode]);

  // Cargar datos iniciales
  useEffect(() => {
    if (testMode) return;
    fetchReportData({ source: 'initial' });
  }, [fetchReportData, testMode]);

  // Aplicar preset de fecha
  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (preset) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'quarter':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 365);
        break;
    }

    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        preset: preset as any
      }
    }));
  };

  // Exportar reporte
  const exportReport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      setExporting(true);
      
      const exportData = {
        reportData,
        filters,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: 'Sistema POS',
          reportType: filters.reportType,
          dateRange: filters.dateRange
        }
      };

      const response = await api.post(
        '/reports/export',
        { format, data: exportData },
        { responseType: 'blob' }
      );

      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `reporte_${filters.reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

  showSuccess(`Reporte ${filters.reportType} exportado en formato ${format.toUpperCase()} - Período: ${filters.dateRange.startDate} a ${filters.dateRange.endDate}`, '');
    } catch (error) {
      console.error('Error exporting report:', error);
      showError('Error al exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  // Exportar gráfica como PNG (captura del frontend)
  const exportChartPNG = async () => {
    try {
      setExporting(true);
      const body = {
        chartType: String(filters.reportType || 'dashboard'),
        dateRange: filters.dateRange,
      };
      const response = await api.post('/reports/chart/png', body, { responseType: 'blob' });
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `grafica_${filters.reportType}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess(`Gráfica ${filters.reportType} exportada como PNG - Período: ${filters.dateRange.startDate} a ${filters.dateRange.endDate}`);
    } catch (error) {
      console.error('Error exporting chart PNG:', error);
      showError('Error al exportar la gráfica');
    } finally {
      setExporting(false);
    }
  };

  // Lista de sucursales para selector
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await api.get('/branches', { params: { isActive: true }, __suppressGlobalError: true } as any);
        const list: Array<{ id: string; name: string }> = (response.data?.data || response.data || [])
          .map((b: any) => ({ id: b.id, name: b.name }))
          .filter((b: any) => !!b.id && !!b.name);
        setBranches(list);
      } catch (error) {
        setBranches([]);
      }
    };
    fetchBranches();
  }, []);

  // Monitorear salud del backend y deshabilitar exportaciones en modo degradado/caído
  useEffect(() => {
    if (testMode) return;
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
  }, [testMode]);

  // Compartir reporte
  const shareReport = async () => {
    try {
      const shareData = {
        title: `Reporte ${filters.reportType} - ${filters.dateRange.startDate} a ${filters.dateRange.endDate}`,
        text: `Reporte generado desde el Sistema POS`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copiar al portapapeles
        await navigator.clipboard.writeText(shareData.url);
        showSuccess(`Enlace del reporte ${filters.reportType} copiado al portapapeles - Período: ${filters.dateRange.startDate} a ${filters.dateRange.endDate}`);
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      showError('Error al compartir el reporte');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="title-display text-3xl text-text-warm">Reportes Avanzados</h1>
            <p className="font-ui text-[#8F8F8F] mt-2">Análisis inteligente y métricas en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-3 text-gray-600">Cargando reportes avanzados...</span>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Error al cargar los datos del reporte</p>
        <button
          onClick={() => fetchReportData({ source: 'event' })}
          className="mt-4 btn-primary flex items-center gap-2 mx-auto"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con métricas en tiempo real */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="title-display text-3xl text-text-warm">Reportes Avanzados</h1>
          <p className="font-ui text-[#8F8F8F] mt-2">
            Análisis inteligente y métricas en tiempo real
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ClockIcon className="w-4 h-4" />
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </div>
            {isOffline && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <ExclamationTriangleIcon className="w-4 h-4" />
                Modo offline
              </div>
            )}
            {autoRefresh && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircleIcon className="w-4 h-4" />
                Auto-actualización activa
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Métricas en tiempo real */}
          <div className="hidden lg:flex items-center gap-4 bg-white rounded-lg px-4 py-2 border border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500">Hoy</p>
              <p className="text-lg font-bold text-green-600">{reportData?.realTimeMetrics?.todaySales || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Esta hora</p>
              <p className="text-lg font-bold text-blue-600">{reportData?.realTimeMetrics?.currentHourSales || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Alertas</p>
              <p className="text-lg font-bold text-red-600">{reportData?.realTimeMetrics?.lowStockAlerts || 0}</p>
            </div>
          </div>

          {/* Controles */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg border transition-colors ${
              autoRefresh 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
            title={autoRefresh ? 'Desactivar auto-actualización' : 'Activar auto-actualización'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-ghost px-4 py-2 text-sm flex items-center gap-2"
          >
            <FunnelIcon className="w-4 h-4" />
            Filtros
          </button>

          <button
            onClick={shareReport}
            className="btn-ghost px-4 py-2 text-sm flex items-center gap-2"
          >
            <ShareIcon className="w-4 h-4" />
            Compartir
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportReport('excel')}
              disabled={exporting || backendHealthMode !== 'ok'}
              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
              className="btn-ghost px-4 py-2 text-sm flex items-center gap-2"
              data-testid="reports-export-excel-button"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportChartPNG}
              disabled={exporting || backendHealthMode !== 'ok'}
              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
              className="btn-ghost px-4 py-2 text-sm flex items-center gap-2"
              data-testid="reports-export-png-button"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => exportReport('pdf')}
              disabled={exporting || backendHealthMode !== 'ok'}
              title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : undefined}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
              data-testid="reports-export-pdf-button"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              PDF
            </button>
          </div>
          {backendHealthMode !== 'ok' && (
            <div className={`mt-2 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>
                  {backendHealthMode === 'down'
                    ? 'Backend caído: exportaciones deshabilitadas temporalmente.'
                    : 'Backend degradado: exportaciones deshabilitadas temporalmente.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Filtros Avanzados</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {/* Rango de fechas */}
            <div className="space-y-3">
              <label className="block font-ui text-sm font-medium text-text-warm">
                Período
              </label>
              <div className="grid grid-cols-3 gap-2">
                {datePresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => applyDatePreset(preset.key)}
                    className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                      filters.dateRange.preset === preset.key
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={filters.dateRange.startDate}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, startDate: e.target.value, preset: 'custom' }
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={filters.dateRange.endDate}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, endDate: e.target.value, preset: 'custom' }
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Agrupación */}
            <div>
              <label htmlFor="groupBy" className="block font-ui text-sm font-medium text-text-warm mb-2">
                Agrupar por
              </label>
              <select
                id="groupBy"
                className="input-field"
                value={filters.groupBy}
                onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value as any }))}
              >
                <option value="hour">Hora</option>
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="quarter">Trimestre</option>
                <option value="year">Año</option>
              </select>
            </div>

            {/* Categorías */}
            <div>
              <label className="block font-ui text-sm font-medium text-text-warm mb-2">
                Categorías
              </label>
              <select
                multiple
                className="input-field h-24"
                value={filters.categories}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  categories: Array.from(e.target.selectedOptions, option => option.value)
                }))}
              >
                <option value="anillos">Anillos</option>
                <option value="collares">Collares</option>
                <option value="aretes">Aretes</option>
                <option value="pulseras">Pulseras</option>
                <option value="relojes">Relojes</option>
              </select>
            </div>

            {/* Agencia */}
            <div>
              <label className="block font-ui text-sm font-medium text-text-warm mb-2">
                Agencia (ID)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: agency_123"
                value={filters.agencyId ?? ''}
                onChange={(e) => setFilters(prev => ({ ...prev, agencyId: e.target.value || null }))}
              />
            </div>

            {/* Guía */}
            <div>
              <label className="block font-ui text-sm font-medium text-text-warm mb-2">
                Guía (ID)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: guide_456"
                value={filters.guideId ?? ''}
                onChange={(e) => setFilters(prev => ({ ...prev, guideId: e.target.value || null }))}
              />
            </div>

            {/* Sucursal */}
            <div>
              <label className="block font-ui text-sm font-medium text-text-warm mb-2">
                Sucursal
              </label>
              <select
                className="input-field"
                value={filters.branchId ?? ''}
                onChange={(e) => setFilters(prev => ({ ...prev, branchId: e.target.value || null }))}
              >
                <option value="">Todas</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Opciones adicionales */}
            <div className="space-y-3">
              <label className="block font-ui text-sm font-medium text-text-warm">
                Opciones
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.includeReturns}
                    onChange={(e) => setFilters(prev => ({ ...prev, includeReturns: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Incluir devoluciones</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.includeDiscounts}
                    onChange={(e) => setFilters(prev => ({ ...prev, includeDiscounts: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Incluir descuentos</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.compareWithPrevious}
                    onChange={(e) => setFilters(prev => ({ ...prev, compareWithPrevious: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Comparar con período anterior</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.realTimeUpdates}
                    onChange={(e) => setFilters(prev => ({ ...prev, realTimeUpdates: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Actualizaciones en tiempo real</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={() => setFilters({
                dateRange: {
                  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                  preset: 'month'
                },
                reportType: 'dashboard',
                groupBy: 'day',
                categories: [],
                paymentMethods: [],
                customerSegments: [],
                priceRange: { min: 0, max: 100000 },
                includeReturns: true,
                includeDiscounts: true,
                compareWithPrevious: true,
                realTimeUpdates: false,
                agencyId: null,
                guideId: null,
                branchId: null
              })}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Restablecer filtros
            </button>
            <button
              onClick={() => fetchReportData({ source: 'event' })}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
            >
              <ChartBarIcon className="w-4 h-4" />
              Aplicar filtros
            </button>
          </div>
        </div>
      )}

      {/* Pestañas de navegación mejoradas */}
      <div className="mb-8">
        <div className="border-b border-line-soft">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon, description: 'Vista general' },
              { id: 'sales', name: 'Ventas', icon: ArrowTrendingUpIcon, description: 'Análisis de ventas' },
              { id: 'inventory', name: 'Inventario', icon: CubeIcon, description: 'Stock y productos' },
              { id: 'financial', name: 'Financiero', icon: CurrencyDollarIcon, description: 'Ingresos y gastos' },
              { id: 'jewelry', name: 'Joyería', icon: Diamond, description: 'Análisis especializado' },
              { id: 'customers', name: 'Clientes', icon: UserGroupIcon, description: 'Segmentación' },
              { id: 'comparative', name: 'Comparativo', icon: PresentationChartLineIcon, description: 'Tendencias' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilters(prev => ({ ...prev, reportType: tab.id as any }));
                }}
                className={`group inline-flex flex-col items-center py-3 px-4 border-b-2 font-ui font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-gold text-text-warm'
                    : 'border-transparent text-[#8F8F8F] hover:text-text-warm hover:border-line-soft'
                }`}
              >
                <tab.icon
                  className={`h-5 w-5 mb-1 ${
                    activeTab === tab.id ? 'text-brand-gold' : 'text-[#8F8F8F] group-hover:text-text-warm'
                  }`}
                />
                <span>{tab.name}</span>
                <span className="text-xs text-gray-400 mt-1">{tab.description}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Controles de vista */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Vista:</span>
          <div className="flex items-center gap-2">
            {[
              { key: 'charts', label: 'Gráficos', icon: BarChart3 },
              { key: 'table', label: 'Tabla', icon: FileText },
              { key: 'cards', label: 'Tarjetas', icon: Eye }
            ].map((view) => (
              <button
                key={view.key}
                onClick={() => setViewMode(view.key as any)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  viewMode === view.key
                    ? 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <view.icon className="w-4 h-4" />
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Métricas:</span>
          <div className="flex items-center gap-2">
            {[
              { key: 'revenue', label: 'Ingresos', color: 'blue' },
              { key: 'sales', label: 'Ventas', color: 'green' },
              { key: 'transactions', label: 'Transacciones', color: 'purple' },
              { key: 'profit', label: 'Ganancia', color: 'orange' }
            ].map((metric) => (
              <label key={metric.key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMetrics(prev => [...prev, metric.key]);
                    } else {
                      setSelectedMetrics(prev => prev.filter(m => m !== metric.key));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{metric.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido de las pestañas */}
      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <DashboardMetrics
            data={{
              totalSales: reportData.summary.totalRevenue,
              totalRevenue: reportData.summary.totalRevenue,
              totalTransactions: reportData.summary.totalTransactions,
              averageTicket: reportData.summary.averageTicket,
              totalCustomers: reportData.summary.totalClients,
              activeCustomers: reportData.summary.totalClients,
              totalProducts: reportData.summary.totalProducts,
              salesGrowth: reportData.comparison.salesGrowth,
              revenueGrowth: reportData.comparison.revenueGrowth,
              transactionGrowth: reportData.comparison.transactionGrowth,
              ticketGrowth: 0,
              customerGrowth: reportData.comparison.clientGrowth,
              topProducts: reportData.topProducts,
              recentSales: reportData.salesByDay.slice(-5).map(day => ({
                id: day.date,
                total: day.revenue,
                date: day.date,
                customerName: undefined
              })),
              hourlySales: reportData.salesByHour,
              monthlySales: [],
              paymentMethods: reportData.salesByPaymentMethod,
              categoryDistribution: reportData.salesByCategory.map(cat => ({
                category: cat.category,
                value: cat.revenue,
                percentage: reportData.salesByCategory.length > 0 
                  ? Math.round((cat.revenue / reportData.salesByCategory.reduce((sum, c) => sum + c.revenue, 0)) * 100) 
                  : 0
              }))
            }}
          />
        )}

        {activeTab === 'sales' && (
          <SalesCharts
            salesData={{
              dailySales: reportData.salesByDay,
              monthlyTrend: [],
              paymentMethods: reportData.salesByPaymentMethod,
              hourlySales: reportData.salesByHour,
              categorySales: reportData.salesByCategory.map(cat => ({
                category: cat.category,
                sales: cat.sales,
                percentage: reportData.salesByCategory.length > 0 
                  ? Math.round((cat.sales / reportData.salesByCategory.reduce((sum, c) => sum + c.sales, 0)) * 100) 
                  : 0,
                transactions: cat.transactions
              }))
            }}
            topProducts={reportData.topProducts}
            movements={{
              totalMovements: reportData.summary.totalTransactions,
              salesMovements: reportData.summary.totalTransactions,
              purchaseMovements: 0,
              adjustmentMovements: 0
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryCharts
            inventoryData={{
              totalProducts: reportData.summary.totalProducts,
              // El valor de inventario no debe ser ingresos; si el backend no provee inventoryValue, evitar mostrar números engañosos
              totalValue: (reportData as any)?.summary?.inventoryValue ?? 0,
              lowStockProducts: reportData.summary.lowStockProducts,
              outOfStockProducts: reportData.summary.outOfStockProducts,
              categories: reportData.salesByCategory.map(cat => ({
                category: cat.category,
                products: cat.sales,
                // Evitar usar revenue como valor de inventario en este tab
                value: 0,
                averageStock: Math.floor(Math.random() * 100) + 10
              })),
              stockLevels: [],
              stockMovements: [],
              topValueProducts: reportData.topProducts.map(p => ({
                name: p.name,
                stock: p.quantity,
                // Evitar usar revenue como valor de inventario
                value: 0,
                category: p.category
              }))
            }}
          />
        )}

        {activeTab === 'financial' && (
          <FinancialCharts
            financialData={{
              totalRevenue: reportData.summary.totalRevenue,
              totalExpenses: reportData.summary.totalRevenue - reportData.summary.totalProfit,
              netProfit: reportData.summary.totalProfit,
              profitMargin: reportData.summary.profitMargin,
              cashFlow: [],
              monthlyProfitLoss: [],
              expenseCategories: [],
              paymentMethods: reportData.salesByPaymentMethod,
              dailyRevenue: reportData.salesByDay.map(day => ({
                date: day.date,
                revenue: day.revenue,
                transactions: day.transactions,
                averageTicket: day.transactions > 0 ? day.revenue / day.transactions : 0
              }))
            }}
            kpis={{
              revenueGrowth: reportData.comparison.revenueGrowth,
              profitGrowth: reportData.comparison.profitGrowth,
              expenseRatio: (reportData.summary.totalRevenue - reportData.summary.totalProfit) / reportData.summary.totalRevenue * 100,
              cashPosition: reportData.summary.totalProfit
            }}
          />
        )}

        {activeTab === 'jewelry' && (
          <JewelryCharts
            jewelryData={{
              salesByCategory: reportData.salesByCategory.map(cat => ({
                category: cat.category,
                sales: cat.sales,
                revenue: cat.revenue,
                units: cat.sales,
                avgPrice: cat.revenue / cat.sales
              })),
              salesByMetal: [],
              salesByPurity: [],
              salesByStone: [],
              salesByWeight: [],
              salesByPriceRange: [],
              salesByGender: [],
              salesByCollection: [],
              marginsByCategory: reportData.salesByCategory.map(cat => {
                const margin = 35 + Math.random() * 20;
                const cost = cat.revenue * (1 - margin / 100);
                return {
                  category: cat.category,
                  revenue: cat.revenue,
                  cost: cost,
                  margin: cat.revenue - cost,
                  marginPercent: margin
                };
              }),
              inventoryValue: [],
              seasonalTrends: [],
              caratAnalysis: [],
              ringSizeAnalysis: [],
              chainLengthAnalysis: [],
              topJewelry: reportData.topProducts.map(product => ({
                name: product.name,
                category: product.category,
                sales: product.quantity,
                revenue: product.revenue,
                units: product.quantity,
                metal: 'Oro', // Valor por defecto
                stone: undefined
              })),
              finishAnalysis: [],
              warrantyAnalysis: [],
              uniquePiecesAnalysis: {
                unique: { sales: 15, revenue: 125000, units: 15, avgPrice: 8333 },
                regular: { sales: 167, revenue: 400000, units: 167, avgPrice: 2395 }
              },
              platingAnalysis: [],
              weightPriceCorrelation: []
            }}
          />
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <UserGroupIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                    <p className="text-2xl font-bold text-gray-900">{reportData.summary.totalClients}</p>
                    <div className="flex items-center mt-1 text-green-600">
                      <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">+{reportData.comparison.clientGrowth.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">Nuevos Clientes</p>
                    <p className="text-2xl font-bold text-gray-900">{reportData.summary.newClients}</p>
                    <p className="text-sm text-gray-500 mt-1">Este período</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">Retención</p>
                    <p className="text-2xl font-bold text-gray-900">{reportData.summary.customerRetention.toFixed(1)}%</p>
                    <p className="text-sm text-gray-500 mt-1">Clientes recurrentes</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">Conversión</p>
                    <p className="text-2xl font-bold text-gray-900">{reportData.summary.conversionRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-500 mt-1">Tasa de conversión</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Clientes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Top Clientes</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compras</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingresos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segmento</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puntos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última compra</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.topClients.map((client) => (
                        <tr key={client.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{client.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{client.purchases}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              ${client.revenue.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              client.segment === 'VIP' ? 'bg-purple-100 text-purple-800' :
                              client.segment === 'Premium' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {client.segment}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{client.loyaltyPoints.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{client.lastPurchase}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comparative' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Métricas comparativas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {[
                { 
                  label: 'Ventas', 
                  current: reportData.summary.totalSales, 
                  growth: reportData.comparison.salesGrowth,
                  icon: ShoppingBag,
                  color: 'blue'
                },
                { 
                  label: 'Ingresos', 
                  current: reportData.summary.totalRevenue, 
                  growth: reportData.comparison.revenueGrowth,
                  icon: DollarSign,
                  color: 'green',
                  format: 'currency'
                },
                { 
                  label: 'Transacciones', 
                  current: reportData.summary.totalTransactions, 
                  growth: reportData.comparison.transactionGrowth,
                  icon: Activity,
                  color: 'purple'
                },
                { 
                  label: 'Clientes', 
                  current: reportData.summary.totalClients, 
                  growth: reportData.comparison.clientGrowth,
                  icon: Users,
                  color: 'orange'
                },
                { 
                  label: 'Ganancia', 
                  current: reportData.summary.totalProfit, 
                  growth: reportData.comparison.profitGrowth,
                  icon: TrendingUpLucide,
                  color: 'emerald',
                  format: 'currency'
                },
                { 
                  label: 'Margen', 
                  current: reportData.summary.profitMargin, 
                  growth: reportData.comparison.marginGrowth,
                  icon: Target,
                  color: 'indigo',
                  format: 'percentage'
                }
              ].map((metric) => (
                <div key={getStableKey(metric.label, metric.color, metric.format)} className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {metric.format === 'currency' 
                          ? `$${metric.current.toLocaleString()}`
                          : metric.format === 'percentage'
                          ? `${metric.current.toFixed(1)}%`
                          : metric.current.toLocaleString()
                        }
                      </p>
                    </div>
                    <div className={`w-12 h-12 bg-${metric.color}-500 rounded-lg flex items-center justify-center`}>
                      <metric.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className={`flex items-center mt-3 ${
                    metric.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.growth >= 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
                    )}
                    <span className="text-sm font-medium">
                      {metric.growth >= 0 ? '+' : ''}{metric.growth.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500 ml-2">vs período anterior</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Predicciones y recomendaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Predicciones
                  </h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ventas próximo mes</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {reportData.forecasting.nextMonthSales}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ingresos próximo mes</span>
                    <span className="text-lg font-semibold text-gray-900">
                      ${reportData.forecasting.nextMonthRevenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Tendencias estacionales</h4>
                    <div className="space-y-2">
                      {reportData.forecasting.seasonalTrends.map((trend) => (
                        <div key={getStableKey(trend.month, trend.predicted, trend.confidence)} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{trend.month}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              ${trend.predicted.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({trend.confidence}% confianza)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-500" />
                    Recomendaciones
                  </h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  {reportData.forecasting.recommendations.map((rec) => (
                    <div key={getStableKey(rec.type, rec.message, rec.priority)} className={`p-4 rounded-lg border-l-4 ${
                       rec.priority === 'high' ? 'border-red-400 bg-red-50' :
                       rec.priority === 'medium' ? 'border-yellow-400 bg-yellow-50' :
                       'border-blue-400 bg-blue-50'
                     }`}>
                       <div className="flex items-start gap-3">
                         <div className={`w-2 h-2 rounded-full mt-2 ${
                           rec.priority === 'high' ? 'bg-red-400' :
                           rec.priority === 'medium' ? 'bg-yellow-400' :
                           'bg-blue-400'
                         }`} />
                         <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`text-xs font-medium uppercase tracking-wide ${
                               rec.priority === 'high' ? 'text-red-700' :
                               rec.priority === 'medium' ? 'text-yellow-700' :
                               'text-blue-700'
                             }`}>
                               {rec.type}
                             </span>
                             <span className={`text-xs px-2 py-1 rounded-full ${
                               rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                               rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                               'bg-blue-100 text-blue-700'
                             }`}>
                               {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                             </span>
                           </div>
                           <p className="text-sm text-gray-700">{rec.message}</p>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>

             {/* Análisis de tendencias */}
             <div className="bg-white rounded-lg shadow-sm border border-gray-200">
               <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <LineChart className="w-5 h-5 text-purple-500" />
                   Análisis de Tendencias
                 </h3>
               </div>
               <div className="p-4 sm:p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                 <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Patrones de Venta</h4>
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                         <span className="text-sm text-gray-600">Mejor día de la semana</span>
                         <span className="text-sm font-medium text-gray-900">
                           {(() => {
                             try {
                               const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                               const best = [...reportData.salesByDay].sort((a,b) => b.revenue - a.revenue)[0];
                               if (!best) return 'Sin datos';
                               const d = new Date(best.date);
                               return dayNames[d.getDay()];
                             } catch {
                               return 'Sin datos';
                             }
                           })()}
                         </span>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm text-gray-600">Mejor hora del día</span>
                         <span className="text-sm font-medium text-gray-900">
                           {(() => {
                             try {
                               const best = [...reportData.salesByHour].sort((a,b) => b.revenue - a.revenue)[0];
                               if (!best) return 'Sin datos';
                               const h = Number((best as any).hour);
                               if (!Number.isFinite(h)) return 'Sin datos';
                               const start = String(h).padStart(2,'0') + ':00';
                               const end = String((h + 1) % 24).padStart(2,'0') + ':00';
                               return `${start} - ${end}`;
                             } catch {
                               return 'Sin datos';
                             }
                           })()}
                         </span>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm text-gray-600">Temporada alta</span>
                         <span className="text-sm font-medium text-gray-900">
                           {(() => {
                             try {
                               const trends = reportData.forecasting?.seasonalTrends || [];
                               const best = [...trends].sort((a,b) => b.predicted - a.predicted)[0];
                               return best?.month || 'Sin datos';
                             } catch {
                               return 'Sin datos';
                             }
                           })()}
                         </span>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm text-gray-600">Categoría más vendida</span>
                         <span className="text-sm font-medium text-gray-900">
                           {(() => {
                             try {
                               const best = [...reportData.salesByCategory].sort((a,b) => b.revenue - a.revenue)[0];
                               return best?.category || 'Sin datos';
                             } catch {
                               return 'Sin datos';
                             }
                           })()}
                         </span>
                       </div>
                     </div>
                   </div>
                   <div>
                     <h4 className="text-sm font-medium text-gray-900 mb-3">Oportunidades</h4>
                     <div className="space-y-3">
                       {(() => {
                         try {
                           const opportunities = [...reportData.salesByCategory]
                             .sort((a,b) => a.revenue - b.revenue)
                             .slice(0,3);
                           if (opportunities.length === 0) {
                             return <p className="text-sm text-gray-500">Sin datos suficientes para oportunidades</p>;
                           }
                           const colors = ['bg-green-400','bg-yellow-400','bg-blue-400'];
                           return opportunities.map((op, idx) => (
                             <div className="flex items-center gap-3" key={getStableKey(idx, Math.round(op.revenue))}>
                               <div className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                              <span className="text-sm text-gray-700">Potenciar {typeof op.category === 'string' ? op.category : (op as any)?.category?.name ?? '(Sin categoría)'} (ingresos ${Math.round(op.revenue).toLocaleString()})</span>
                             </div>
                           ));
                         } catch {
                           return <p className="text-sm text-gray-500">Sin datos suficientes para oportunidades</p>;
                         }
                       })()}
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
 };
 
export default ReportsPage; 
 
