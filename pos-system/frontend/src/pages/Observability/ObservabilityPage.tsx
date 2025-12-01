import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEvents, fetchMetrics, type EventRecord, type EventSeverity } from '@/services/observabilityService';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { api, initializeApiBaseUrl, backendStatus, type BackendStatus } from '@/lib/api';

type ObservabilityPageProps = { testMode?: boolean };

const severityColors: Record<EventSeverity, string> = {
  info: 'text-blue-700 bg-blue-50 border-blue-200',
  warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  error: 'text-red-700 bg-red-50 border-red-200',
  exception: 'text-purple-700 bg-purple-50 border-purple-200',
};

const ObservabilityPage: React.FC<ObservabilityPageProps> = ({ testMode = false }) => {
  const AUTO_REFRESH_INTERVAL_MS = 30000;
  // Ping activo de latencia de API
  const API_PING_INTERVAL_MS = 10000;
  // Ventana extendida de historial (por defecto 60 minutos)
  const HISTORY_WINDOW_MINUTES = Number(((import.meta as any).env?.VITE_OBS_HISTORY_MINUTES ?? 60));
  const HISTORY_POINTS = Math.max(5, Math.ceil((HISTORY_WINDOW_MINUTES * 60 * 1000) / AUTO_REFRESH_INTERVAL_MS));
  // Overrides locales de umbrales (perfil por ambiente)
  const [thresholdOverrides, setThresholdOverrides] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('observability:thresholdOverrides') || '{}') || {}; } catch { return {}; }
  });
  const thresholds = useMemo(() => ({
    LATENCY_WARN_MS: Number(((thresholdOverrides as any).LATENCY_WARN_MS ?? (import.meta as any).env?.VITE_HEALTH_LATENCY_WARN_MS ?? 250)),
    LATENCY_CRIT_MS: Number(((thresholdOverrides as any).LATENCY_CRIT_MS ?? (import.meta as any).env?.VITE_HEALTH_LATENCY_CRIT_MS ?? 1000)),
    JOBS_INTERVAL_WARN_MS: Number(((thresholdOverrides as any).JOBS_INTERVAL_WARN_MS ?? (import.meta as any).env?.VITE_JOBS_INTERVAL_WARN_MS ?? 120000)),
    JOBS_INTERVAL_CRIT_MS: Number(((thresholdOverrides as any).JOBS_INTERVAL_CRIT_MS ?? (import.meta as any).env?.VITE_JOBS_INTERVAL_CRIT_MS ?? 300000)),
    SALES_WARN_COUNT: Number(((thresholdOverrides as any).SALES_WARN_COUNT ?? (import.meta as any).env?.VITE_SALES_WARN_COUNT ?? NaN)),
    SALES_CRIT_COUNT: Number(((thresholdOverrides as any).SALES_CRIT_COUNT ?? (import.meta as any).env?.VITE_SALES_CRIT_COUNT ?? NaN)),
    SALEITEMS_WARN_COUNT: Number(((thresholdOverrides as any).SALEITEMS_WARN_COUNT ?? (import.meta as any).env?.VITE_SALEITEMS_WARN_COUNT ?? NaN)),
    SALEITEMS_CRIT_COUNT: Number(((thresholdOverrides as any).SALEITEMS_CRIT_COUNT ?? (import.meta as any).env?.VITE_SALEITEMS_CRIT_COUNT ?? NaN)),
    JOBS_FAILED_WARN_COUNT: Number(((thresholdOverrides as any).JOBS_FAILED_WARN_COUNT ?? (import.meta as any).env?.VITE_JOBS_FAILED_WARN_COUNT ?? NaN)),
    JOBS_FAILED_CRIT_COUNT: Number(((thresholdOverrides as any).JOBS_FAILED_CRIT_COUNT ?? (import.meta as any).env?.VITE_JOBS_FAILED_CRIT_COUNT ?? NaN)),
    JOBS_PENDING_WARN_COUNT: Number(((thresholdOverrides as any).JOBS_PENDING_WARN_COUNT ?? (import.meta as any).env?.VITE_JOBS_PENDING_WARN_COUNT ?? NaN)),
    JOBS_PENDING_CRIT_COUNT: Number(((thresholdOverrides as any).JOBS_PENDING_CRIT_COUNT ?? (import.meta as any).env?.VITE_JOBS_PENDING_CRIT_COUNT ?? NaN)),
    JOBS_QUEUEAGE_WARN_MS: Number(((thresholdOverrides as any).JOBS_QUEUEAGE_WARN_MS ?? (import.meta as any).env?.VITE_JOBS_QUEUEAGE_WARN_MS ?? NaN)),
    JOBS_QUEUEAGE_CRIT_MS: Number(((thresholdOverrides as any).JOBS_QUEUEAGE_CRIT_MS ?? (import.meta as any).env?.VITE_JOBS_QUEUEAGE_CRIT_MS ?? NaN)),
    JOBS_PROCTIME_WARN_MS: Number(((thresholdOverrides as any).JOBS_PROCTIME_WARN_MS ?? (import.meta as any).env?.VITE_JOBS_PROCTIME_WARN_MS ?? NaN)),
    JOBS_PROCTIME_CRIT_MS: Number(((thresholdOverrides as any).JOBS_PROCTIME_CRIT_MS ?? (import.meta as any).env?.VITE_JOBS_PROCTIME_CRIT_MS ?? NaN)),
    LEDGER_WARN_COUNT: Number(((thresholdOverrides as any).LEDGER_WARN_COUNT ?? (import.meta as any).env?.VITE_LEDGER_WARN_COUNT ?? NaN)),
    LEDGER_CRIT_COUNT: Number(((thresholdOverrides as any).LEDGER_CRIT_COUNT ?? (import.meta as any).env?.VITE_LEDGER_CRIT_COUNT ?? NaN)),
    IDEMPOTENCY_WARN_COUNT: Number(((thresholdOverrides as any).IDEMPOTENCY_WARN_COUNT ?? (import.meta as any).env?.VITE_IDEMPOTENCY_WARN_COUNT ?? NaN)),
    IDEMPOTENCY_CRIT_COUNT: Number(((thresholdOverrides as any).IDEMPOTENCY_CRIT_COUNT ?? (import.meta as any).env?.VITE_IDEMPOTENCY_CRIT_COUNT ?? NaN)),
  }), [thresholdOverrides]);
  const {
    LATENCY_WARN_MS,
    LATENCY_CRIT_MS,
    JOBS_INTERVAL_WARN_MS,
    JOBS_INTERVAL_CRIT_MS,
    SALES_WARN_COUNT,
    SALES_CRIT_COUNT,
    SALEITEMS_WARN_COUNT,
    SALEITEMS_CRIT_COUNT,
    JOBS_FAILED_WARN_COUNT,
    JOBS_FAILED_CRIT_COUNT,
    JOBS_PENDING_WARN_COUNT,
    JOBS_PENDING_CRIT_COUNT,
    JOBS_QUEUEAGE_WARN_MS,
    JOBS_QUEUEAGE_CRIT_MS,
    JOBS_PROCTIME_WARN_MS,
    JOBS_PROCTIME_CRIT_MS,
    LEDGER_WARN_COUNT,
    LEDGER_CRIT_COUNT,
    IDEMPOTENCY_WARN_COUNT,
    IDEMPOTENCY_CRIT_COUNT,
  } = thresholds;
  const TELEMETRY_URL = String(((import.meta as any).env?.VITE_TELEMETRY_URL ?? '') || '');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [pagination, setPagination] = useState<{ page?: number; limit?: number; total?: number; totalPages?: number } | undefined>(undefined);
  const [metrics, setMetrics] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  // Fuente de API (proxy vs directo)
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const apiSourceLabel = useMemo(() => {
    if (!apiBaseUrl) return '';
    return apiBaseUrl === '/api' ? 'API: proxy (/api)' : `API: ${apiBaseUrl}`;
  }, [apiBaseUrl]);
  // Salud del sistema
  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [integritySummary, setIntegritySummary] = useState<any>(null);
  const [endpointsMeta, setEndpointsMeta] = useState<any>(null);
  const [configMeta, setConfigMeta] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState<boolean>(false);
  const [showThresholds, setShowThresholds] = useState<boolean>(() => {
    try { return localStorage.getItem('observability:showThresholds') === '1'; } catch { return false; }
  });
  // Config: verbosity y campos
  const defaultConfigFields = 'env,cors,db,uploads,validation,envFlags';
  const [configVerbose, setConfigVerbose] = useState<boolean>(() => {
    try { return localStorage.getItem('observability:configVerbose') === '1'; } catch { return false; }
  });
  const [configFields, setConfigFields] = useState<string>(() => {
    try { return localStorage.getItem('observability:configFields') || defaultConfigFields; } catch { return defaultConfigFields; }
  });
  // Normalización de `fields`
  const allowedFieldsList = ['env','cors','db','uploads','validation','envFlags','config','paths','server'];
  const allowedFieldsSet = useMemo(() => new Set(allowedFieldsList), []);
  const normalizeFields = useCallback((value: string) => {
    const raw = String(value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const uniq: string[] = [];
    const invalid: string[] = [];
    for (const t of raw) {
      if (allowedFieldsSet.has(t)) {
        if (!uniq.includes(t)) uniq.push(t);
      } else {
        invalid.push(t);
      }
    }
    return { normalized: uniq.join(','), invalid };
  }, [allowedFieldsSet]);
  const { normalized: normalizedFields, invalid: invalidFields } = useMemo(() => normalizeFields(configFields), [configFields, normalizeFields]);
  // Salud consolidada de subsistemas
  const [inventoryHealth, setInventoryHealth] = useState<any>(null);
  const [jobsHealth, setJobsHealth] = useState<any>(null);
  const [offlineStatus, setOfflineStatus] = useState<any>(null);
  const [salesHealth, setSalesHealth] = useState<any>(null);
  const [inventoryMetrics, setInventoryMetrics] = useState<any>(null);
  // Contadores de fallos por subsistema
  const [inventoryFailures, setInventoryFailures] = useState<number>(0);
  const [salesFailures, setSalesFailures] = useState<number>(0);
  const [jobsFailures, setJobsFailures] = useState<number>(0);
  const [offlineFailures, setOfflineFailures] = useState<number>(0);
  // Timestamp y historial por subsistema
  const [subsystemsLastCheck, setSubsystemsLastCheck] = useState<number | null>(null);
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [jobsHistoryList, setJobsHistoryList] = useState<any[]>([]);
  const [offlineHistory, setOfflineHistory] = useState<any[]>([]);
  // Historial de latencia API
  const [apiLatencyHistory, setApiLatencyHistory] = useState<Array<{ timestamp: number; latencyMs: number; hadError?: boolean }>>([]);
  // Último fallo por subsistema
  const [inventoryLastError, setInventoryLastError] = useState<string | null>(null);
  const [salesLastError, setSalesLastError] = useState<string | null>(null);
  const [jobsLastError, setJobsLastError] = useState<string | null>(null);
  const [offlineLastError, setOfflineLastError] = useState<string | null>(null);
  // Verificación de archivos
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifError, setVerifError] = useState<string | null>(null);
  const [verifSummary, setVerifSummary] = useState<any>(null);

  // Filtros básicos
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | ''>('');
  const [limit, setLimit] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [windowHours, setWindowHours] = useState<number>(24);
  const [copyInfo, setCopyInfo] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'success' | 'error' | ''>('');
  // UI: colapsado de filtros y CSV detalles
  const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('observability:eventFiltersCollapsed') === '1'; } catch { return false; }
  });
  const [includeDetails, setIncludeDetails] = useState<boolean>(false);
  // Ventana por módulo para sparklines
  const [inventoryWindowPoints, setInventoryWindowPoints] = useState<number | null>(() => {
    try { const v = localStorage.getItem('observability:sparkWindowPoints:inventory'); return v ? Number(v) : null; } catch { return null; }
  });
  const [salesWindowPoints, setSalesWindowPoints] = useState<number | null>(() => {
    try { const v = localStorage.getItem('observability:sparkWindowPoints:sales'); return v ? Number(v) : null; } catch { return null; }
  });
  const [jobsWindowPoints, setJobsWindowPoints] = useState<number | null>(() => {
    try { const v = localStorage.getItem('observability:sparkWindowPoints:jobs'); return v ? Number(v) : null; } catch { return null; }
  });
  // Control de requests y backoff/telemetría
  const requestsRef = useRef<{ health?: AbortController; subsystems?: AbortController }>({});
  // extiende controladores para ping de latencia
  (requestsRef.current as any).latency = (requestsRef.current as any).latency;
  const errorCooldownRef = useRef<number>(0);
  const errorAttemptsRef = useRef<number>(0);
  const perSubsystemCooldownRef = useRef<Record<'inventory'|'sales'|'jobs'|'offline', number>>({ inventory: 0, sales: 0, jobs: 0, offline: 0 });
  const perSubsystemAttemptsRef = useRef<Record<'inventory'|'sales'|'jobs'|'offline', number>>({ inventory: 0, sales: 0, jobs: 0, offline: 0 });
  const telemetryRef = useRef<any[]>([]);
  const telemetryQueueRef = useRef<any[]>([]);
  const telemetrySendCooldownRef = useRef<number>(0);
  const telemetrySendAttemptsRef = useRef<number>(0);
  const [telemetryQueueCount, setTelemetryQueueCount] = useState<number>(0);
  const [telemetryLastSendStatus, setTelemetryLastSendStatus] = useState<''|'ok'|'error'>('');
  const [telemetryLastSendAt, setTelemetryLastSendAt] = useState<number>(0);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  // Control de tamaño de sparkline
  const [sparkSize, setSparkSize] = useState<'sm'|'md'|'lg'>(() => {
    try { return (localStorage.getItem('observability:sparklineSize') as any) || 'md'; } catch { return 'md'; }
  });
  // Estado de mocks (runtime override)
  const [mocksEnabled, setMocksEnabled] = useState<boolean>(() => {
    try {
      const ls = String(localStorage.getItem('observability:useMocks')).toLowerCase() === 'true';
      const envVal = String(((import.meta as any).env?.VITE_USE_MOCKS ?? '')).toLowerCase() === 'true';
      return ls || envVal;
    } catch {
      return String(((import.meta as any).env?.VITE_USE_MOCKS ?? '')).toLowerCase() === 'true';
    }
  });
  const sparkConf = useMemo(() => {
    switch (sparkSize) {
      case 'sm': return { width: 80, points: 10, height: 22 };
      case 'lg': return { width: 140, points: 25, height: 26 };
      case 'md':
      default: return { width: 100, points: 15, height: 24 };
    }
  }, [sparkSize]);
  // Ventana de puntos del sparkline (override opcional)
  const [sparkWindowPoints, setSparkWindowPoints] = useState<number | null>(() => {
    try { const v = localStorage.getItem('observability:sparkWindowPoints'); return v ? Number(v) : null; } catch { return null; }
  });
  const sparkPoints = useMemo(() => sparkWindowPoints || sparkConf.points, [sparkWindowPoints, sparkConf.points]);
  // Estado de backend y polling
  const [backendStatusVal, setBackendStatusVal] = useState<BackendStatus>('down');
  const [backendOverride, setBackendOverride] = useState<BackendStatus | null>(() => {
    try {
      const v = localStorage.getItem('observability:backendOverride');
      return v === 'ok' || v === 'no_health' || v === 'down' ? (v as BackendStatus) : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      backendStatus.startPolling(15000);
      const cb = (st: BackendStatus) => setBackendStatusVal(st);
      backendStatus.onStatus(cb);
      return () => backendStatus.offStatus(cb);
    } catch { /* noop */ }
  }, []);
  // Helper de cooldown por subsistema
  const getCooldownRemainingSec = useCallback((key: 'inventory'|'sales'|'jobs'|'offline') => {
    const until = perSubsystemCooldownRef.current[key] || 0;
    const now = Date.now();
    return until > now ? Math.ceil((until - now) / 1000) : 0;
  }, []);
  const exportHistoryCsv = useCallback((name: string, rows: Array<Record<string, any>>) => {
    try {
      const headers = Object.keys(rows[0] || {});
      const esc = (v: any) => {
        const s = v == null ? '' : String(v);
        // wrap in quotes and escape quotes
        const q = '"';
        return q + s.replace(/"/g, '""') + q;
      };
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc((r as any)[h])).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observability_${name}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  }, []);

  // Normaliza la respuesta de /inventory/health a campos planos esperados por la UI
  const normalizeInventoryHealth = useCallback((raw: any) => {
    if (!raw || typeof raw !== 'object') return raw;
    const tables = raw.tables || {};
    const counts = raw.counts || {};
    const ledgerCount = typeof raw.ledgerCount === 'number' ? raw.ledgerCount : Number(counts.stock_ledger ?? NaN);
    const idempotencyCount = typeof raw.idempotencyCount === 'number' ? raw.idempotencyCount : Number(counts.idempotency_records ?? NaN);
    const tablesExist = typeof raw.tablesExist === 'boolean'
      ? raw.tablesExist
      : (typeof tables.stock_ledger === 'boolean' && typeof tables.idempotency_records === 'boolean'
        ? (tables.stock_ledger && tables.idempotency_records)
        : undefined);
    return { ...raw, ledgerCount, idempotencyCount, tablesExist };
  }, []);

  // Restaurar historiales breves desde localStorage
  useEffect(() => {
    try {
      const i = localStorage.getItem('observability:inventoryHistory');
      const s = localStorage.getItem('observability:salesHistory');
      const j = localStorage.getItem('observability:jobsHistory');
      const o = localStorage.getItem('observability:offlineHistory');
      const a = localStorage.getItem('observability:apiLatencyHistory');
      if (i) setInventoryHistory(JSON.parse(i));
      if (s) setSalesHistory(JSON.parse(s));
      if (j) setJobsHistoryList(JSON.parse(j));
      if (o) setOfflineHistory(JSON.parse(o));
      if (a) setApiLatencyHistory(JSON.parse(a));
    } catch { /* noop */ }
  }, []);

  const exportTelemetryCsv = useCallback(() => {
    try {
      const rows = telemetryRef.current;
      if (!rows.length) return;
      const headers = ['ts','invLatency','salesLatency','jobsInterval','offlineStatus','hadError'];
      const csv = [headers.join(',')].concat(rows.map(r => [r.ts, r.invLatency, r.salesLatency, r.jobsInterval, JSON.stringify(r.offlineStatus), r.hadError ? 1 : 0].join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetria-${new Date().toISOString().replace(/[:]/g,'-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  }, []);

  const sendTelemetryNow = useCallback(async () => {
    if (!TELEMETRY_URL) return;
    const batch = telemetryQueueRef.current.slice(0, 50);
    if (!batch.length) return;
    try {
      const resp = await fetch(TELEMETRY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'observability', points: batch }), keepalive: true,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      telemetryQueueRef.current = telemetryQueueRef.current.slice(batch.length);
      setTelemetryQueueCount(telemetryQueueRef.current.length);
      try { localStorage.setItem('observability:telemetryQueue', JSON.stringify(telemetryQueueRef.current)); } catch {}
      setTelemetryLastSendStatus('ok');
      setTelemetryLastSendAt(Date.now());
    } catch {
      setTelemetryLastSendStatus('error');
      setTelemetryLastSendAt(Date.now());
    }
  }, []);

  // Sparkline simple (SVG)
  const Sparkline: React.FC<{ values: number[]; width?: number; height?: number; color?: string; className?: string; title?: string }>
    = ({ values, width = 120, height = 30, color = '#2563eb', className, title }) => {
    if (!values || values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = (max - min) || 1;
    const last = values[0];
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <title>{title || `Último: ${last} · Min: ${min} · Max: ${max}`}</title>
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [evt, met] = await Promise.all([
        fetchEvents({ type: typeFilter || undefined, severity: (severityFilter || undefined) as EventSeverity | undefined, limit, page, search: search || undefined, from: from || undefined, to: to || undefined }),
        fetchMetrics(from || to ? { from: from || undefined, to: to || undefined } : { windowHours }),
      ]);
      setEvents(evt.items || []);
      setPagination(evt.pagination);
      setMetrics(met || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar observabilidad');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, limit, page, search, from, to, windowHours]);

  const loadHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      // Cancelar request anterior en curso
      try { requestsRef.current.health?.abort(); } catch {}
      requestsRef.current.health = new AbortController();
      // Salud general
      const [healthResp, endpointsResp, configResp, integrityResp] = await Promise.all([
        api.get('/health', { __suppressGlobalError: true, signal: requestsRef.current.health.signal } as any).catch((e: any) => e?.response || { data: null, status: 0 }),
        api.get('/meta/endpoints', { params: { group: 'module' }, __suppressGlobalError: true, signal: requestsRef.current.health.signal } as any).catch((e: any) => e?.response || { data: null, status: 0 }),
        api.get('/meta/config', { params: (configVerbose ? { verbose: true } : { fields: normalizedFields }), __suppressGlobalError: true, signal: requestsRef.current.health.signal } as any).catch((e: any) => e?.response || { data: null, status: 0 }),
        api.get('/integrity/summary', { __suppressGlobalError: true, signal: requestsRef.current.health.signal } as any).catch((e: any) => e?.response || { data: null, status: 0 }),
      ]);
      const healthData = (healthResp?.data?.data || healthResp?.data || null);
      setHealth(healthData);
      const endpointsData = (endpointsResp?.data?.data || endpointsResp?.data || null);
      setEndpointsMeta(endpointsData);
      const integrityData = (integrityResp?.data?.data || integrityResp?.data || null);
      setIntegritySummary(integrityData);
      const cfgDataRaw = (configResp?.data?.data || configResp?.data || null);
      // Inyectar advertencias del frontend sobre variables de entorno clave
      try {
        const clientWarnings: string[] = [];
        const envObj = (import.meta as any).env || {};
        const addWarn = (msg: string) => clientWarnings.push(msg);
        const isNum = (v: any) => typeof v === 'number' && !Number.isNaN(v);
        const vLedgerWarn = Number(envObj?.VITE_LEDGER_WARN_COUNT ?? NaN);
        const vLedgerCrit = Number(envObj?.VITE_LEDGER_CRIT_COUNT ?? NaN);
        const vIdemWarn = Number(envObj?.VITE_IDEMPOTENCY_WARN_COUNT ?? NaN);
        const vIdemCrit = Number(envObj?.VITE_IDEMPOTENCY_CRIT_COUNT ?? NaN);
        const vSalesWarn = Number(envObj?.VITE_SALES_WARN_COUNT ?? NaN);
        const vSalesCrit = Number(envObj?.VITE_SALES_CRIT_COUNT ?? NaN);
        const vSaleItemsWarn = Number(envObj?.VITE_SALEITEMS_WARN_COUNT ?? NaN);
        const vSaleItemsCrit = Number(envObj?.VITE_SALEITEMS_CRIT_COUNT ?? NaN);
        const vJobsFailedWarn = Number(envObj?.VITE_JOBS_FAILED_WARN_COUNT ?? NaN);
        const vJobsFailedCrit = Number(envObj?.VITE_JOBS_FAILED_CRIT_COUNT ?? NaN);
        const vJobsPendingWarn = Number(envObj?.VITE_JOBS_PENDING_WARN_COUNT ?? NaN);
        const vJobsPendingCrit = Number(envObj?.VITE_JOBS_PENDING_CRIT_COUNT ?? NaN);
        const vJobsQueueAgeWarn = Number(envObj?.VITE_JOBS_QUEUEAGE_WARN_MS ?? NaN);
        const vJobsQueueAgeCrit = Number(envObj?.VITE_JOBS_QUEUEAGE_CRIT_MS ?? NaN);
        const vJobsProcTimeWarn = Number(envObj?.VITE_JOBS_PROCTIME_WARN_MS ?? NaN);
        const vJobsProcTimeCrit = Number(envObj?.VITE_JOBS_PROCTIME_CRIT_MS ?? NaN);
        if (!isNum(vLedgerWarn)) addWarn('Falta VITE_LEDGER_WARN_COUNT o no es numérico');
        if (!isNum(vLedgerCrit)) addWarn('Falta VITE_LEDGER_CRIT_COUNT o no es numérico');
        if (isNum(vLedgerWarn) && isNum(vLedgerCrit) && vLedgerWarn > vLedgerCrit) addWarn('VITE_LEDGER_WARN_COUNT debe ser ≤ VITE_LEDGER_CRIT_COUNT');
        if (!isNum(vIdemWarn)) addWarn('Falta VITE_IDEMPOTENCY_WARN_COUNT o no es numérico');
        if (!isNum(vIdemCrit)) addWarn('Falta VITE_IDEMPOTENCY_CRIT_COUNT o no es numérico');
        if (isNum(vIdemWarn) && isNum(vIdemCrit) && vIdemWarn > vIdemCrit) addWarn('VITE_IDEMPOTENCY_WARN_COUNT debe ser ≤ VITE_IDEMPOTENCY_CRIT_COUNT');
        if (!String(envObj?.VITE_API_URL || '').trim()) addWarn('Falta VITE_API_URL (base de API del frontend)');
        // Ventas
        if (!isNum(vSalesWarn)) addWarn('Falta VITE_SALES_WARN_COUNT o no es numérico');
        if (!isNum(vSalesCrit)) addWarn('Falta VITE_SALES_CRIT_COUNT o no es numérico');
        if (isNum(vSalesWarn) && isNum(vSalesCrit) && vSalesWarn > vSalesCrit) addWarn('VITE_SALES_WARN_COUNT debe ser ≤ VITE_SALES_CRIT_COUNT');
        if (!isNum(vSaleItemsWarn)) addWarn('Falta VITE_SALEITEMS_WARN_COUNT o no es numérico');
        if (!isNum(vSaleItemsCrit)) addWarn('Falta VITE_SALEITEMS_CRIT_COUNT o no es numérico');
        if (isNum(vSaleItemsWarn) && isNum(vSaleItemsCrit) && vSaleItemsWarn > vSaleItemsCrit) addWarn('VITE_SALEITEMS_WARN_COUNT debe ser ≤ VITE_SALEITEMS_CRIT_COUNT');
        // Jobs
        if (isNum(vJobsFailedWarn) && isNum(vJobsFailedCrit) && vJobsFailedWarn > vJobsFailedCrit) addWarn('VITE_JOBS_FAILED_WARN_COUNT debe ser ≤ VITE_JOBS_FAILED_CRIT_COUNT');
        if (isNum(vJobsPendingWarn) && isNum(vJobsPendingCrit) && vJobsPendingWarn > vJobsPendingCrit) addWarn('VITE_JOBS_PENDING_WARN_COUNT debe ser ≤ VITE_JOBS_PENDING_CRIT_COUNT');
        const mergedValidation = {
          ...(cfgDataRaw?.validation || {}),
          warnings: [
            ...(((cfgDataRaw?.validation || {}) as any).warnings || []),
            ...clientWarnings,
          ],
        };
        const mergedEnvFlags = {
          ...(cfgDataRaw?.envFlags || {}),
          VITE_LEDGER_WARN_COUNT: isNum(vLedgerWarn),
          VITE_LEDGER_CRIT_COUNT: isNum(vLedgerCrit),
          VITE_IDEMPOTENCY_WARN_COUNT: isNum(vIdemWarn),
          VITE_IDEMPOTENCY_CRIT_COUNT: isNum(vIdemCrit),
          VITE_API_URL: !!String(envObj?.VITE_API_URL || '').trim(),
          VITE_SALES_WARN_COUNT: isNum(vSalesWarn),
          VITE_SALES_CRIT_COUNT: isNum(vSalesCrit),
          VITE_SALEITEMS_WARN_COUNT: isNum(vSaleItemsWarn),
          VITE_SALEITEMS_CRIT_COUNT: isNum(vSaleItemsCrit),
          VITE_JOBS_FAILED_WARN_COUNT: isNum(vJobsFailedWarn),
          VITE_JOBS_FAILED_CRIT_COUNT: isNum(vJobsFailedCrit),
          VITE_JOBS_PENDING_WARN_COUNT: isNum(vJobsPendingWarn),
          VITE_JOBS_PENDING_CRIT_COUNT: isNum(vJobsPendingCrit),
          VITE_JOBS_QUEUEAGE_WARN_MS: isNum(vJobsQueueAgeWarn),
          VITE_JOBS_QUEUEAGE_CRIT_MS: isNum(vJobsQueueAgeCrit),
          VITE_JOBS_PROCTIME_WARN_MS: isNum(vJobsProcTimeWarn),
          VITE_JOBS_PROCTIME_CRIT_MS: isNum(vJobsProcTimeCrit),
        };
        setConfigMeta({ ...(cfgDataRaw || {}), validation: mergedValidation, envFlags: mergedEnvFlags });
      } catch {
        setConfigMeta(cfgDataRaw);
      }
      setConfigError(null);
    } catch (e) {
      // No bloquear UI por errores de salud
      setConfigError(e instanceof Error ? e.message : 'Error al cargar configuración');
    } finally {
      setHealthLoading(false);
    }
  }, [configVerbose, normalizedFields]);

  // Cargar salud de subsistemas (inventario, jobs, offline, ventas)
  const loadSubsystemHealth = useCallback(async () => {
    try {
      // Cancelar en curso y crear nuevo controlador
      try { requestsRef.current.subsystems?.abort(); } catch {}
      requestsRef.current.subsystems = new AbortController();
      const signal = requestsRef.current.subsystems.signal;
      const fetchWithError = async (path: string) => {
        try {
          const resp = await api.get(path, { __suppressGlobalError: true, signal } as any);
          const data = (resp?.data?.data ?? resp?.data ?? null);
          return { data, status: resp?.status ?? 200, error: null as string | null };
        } catch (e: any) {
          const status = e?.response?.status ?? 0;
          const code = e?.code ? String(e.code) : '';
          const msg = e?.message ? String(e.message) : 'Error de red/CORS/abortado';
          const reason = status ? `HTTP ${status}${code ? ` (${code})` : ''}` : (code ? code : msg);
          return { data: null, status, error: reason };
        }
      };

      // Si un subsistema está en cooldown, devolver el último estado local sin llamar al backend
      const nowTs = Date.now();
      const maybeFetch = async (key: 'inventory'|'sales'|'jobs'|'offline', path: string, lastLocal: any) => {
        if (perSubsystemCooldownRef.current[key] && nowTs < perSubsystemCooldownRef.current[key]) {
          return { data: lastLocal, status: 200, error: null as string | null };
        }
        return fetchWithError(path);
      };

      // Ejecutar en paralelo capturando errores
      const [inv, jobs, off, sales, invMetrics] = await Promise.all([
        maybeFetch('inventory', '/inventory/health', inventoryHealth),
        maybeFetch('jobs', '/jobs/health', jobsHealth),
        maybeFetch('offline', '/offline/status', offlineStatus),
        maybeFetch('sales', '/sales/health', salesHealth),
        // Métricas de inventario se omiten si inventario está en cooldown
        (perSubsystemCooldownRef.current.inventory && nowTs < perSubsystemCooldownRef.current.inventory)
          ? Promise.resolve({ data: inventoryMetrics, status: 200, error: null })
          : fetchWithError('/inventory/metrics'),
      ]);

      const invData = inv.data;
      const jobsData = jobs.data;
      const offData = off.data;
      const salData = sales.data;
      const invMetricsDataRaw = invMetrics.data;
      const invMetricsData = (() => {
        if (!invMetricsDataRaw) return null;
        if (typeof invMetricsDataRaw === 'number') return { last30DaysMovements: invMetricsDataRaw };
        if (typeof invMetricsDataRaw?.last30DaysMovements === 'number') return invMetricsDataRaw;
        if (typeof invMetricsDataRaw?.count30Days === 'number') return { last30DaysMovements: invMetricsDataRaw.count30Days };
        if (typeof invMetricsDataRaw?.count === 'number') return { last30DaysMovements: invMetricsDataRaw.count };
        return invMetricsDataRaw;
      })();

      const invNorm = normalizeInventoryHealth(invData);
      setInventoryHealth(invNorm);
      setJobsHealth(jobsData);
      setOfflineStatus(offData);
      setSalesHealth(salData);
      setInventoryMetrics(invMetricsData);
      // Registrar último error por subsistema
      setInventoryLastError(inv.error);
      setSalesLastError(sales.error);
      setJobsLastError(jobs.error);
      setOfflineLastError(off.error);

      // Telemetría de fallos por subsistema
      setInventoryFailures(prev => prev + (!invData ? 1 : 0));
      setSalesFailures(prev => prev + (!salData ? 1 : 0));
      setJobsFailures(prev => prev + (!jobsData ? 1 : 0));
      setOfflineFailures(prev => prev + (!offData ? 1 : 0));

      // Backoff global: si hubo errores, establecer cooldown exponencial
      const hadError = (!invData || !salData || !jobsData || !offData);
      if (hadError) {
        errorAttemptsRef.current = Math.min(errorAttemptsRef.current + 1, 6);
        const jitter = Math.floor(Math.random() * 500);
        const delay = Math.min(2000 * Math.pow(2, errorAttemptsRef.current - 1) + jitter, 60000);
        errorCooldownRef.current = Date.now() + delay;
      } else {
        errorAttemptsRef.current = 0;
        errorCooldownRef.current = 0;
      }

      // Backoff por subsistema (independiente)
      const setCooldown = (key: 'inventory'|'sales'|'jobs'|'offline', failed: boolean) => {
        if (failed) {
          const attempts = Math.min((perSubsystemAttemptsRef.current[key] ?? 0) + 1, 6);
          perSubsystemAttemptsRef.current[key] = attempts;
          const jitter = Math.floor(Math.random() * 400);
          const delay = Math.min(1500 * Math.pow(2, attempts - 1) + jitter, 45000);
          perSubsystemCooldownRef.current[key] = Date.now() + delay;
        } else {
          perSubsystemAttemptsRef.current[key] = 0;
          perSubsystemCooldownRef.current[key] = 0;
        }
      };
      setCooldown('inventory', !invData);
      setCooldown('sales', !salData);
      setCooldown('jobs', !jobsData);
      setCooldown('offline', !offData);

      // Timestamp del último chequeo
      const now = Date.now();
      setSubsystemsLastCheck(now);

      // Historial (ventana extendida) + persistencia en localStorage
      if (invNorm) {
        setInventoryHistory(prev => {
          const next = [{ timestamp: now, ...invNorm }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:inventoryHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      }
      if (salData) {
        setSalesHistory(prev => {
          const next = [{ timestamp: now, ...salData }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:salesHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      }
      if (jobsData) {
        setJobsHistoryList(prev => {
          const next = [{ timestamp: now, ...jobsData }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:jobsHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      }
      if (offData) {
        setOfflineHistory(prev => {
          const next = [{ timestamp: now, ...offData }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:offlineHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      }

      // Telemetría ligera local: guardar últimos 50 puntos
      try {
        const t = {
          ts: now,
          invLatency: Number(invData?.latencyMs ?? 0),
          salesLatency: Number(salData?.dbLatencyMs ?? 0),
          jobsInterval: Number(jobsData?.intervalMs ?? 0),
          offlineStatus: String(offData?.status ?? ''),
          hadError,
        };
        telemetryRef.current = [t, ...telemetryRef.current].slice(0, 50);
        telemetryQueueRef.current = [t, ...telemetryQueueRef.current].slice(0, 200);
        localStorage.setItem('observability:telemetry', JSON.stringify(telemetryRef.current));
        try { localStorage.setItem('observability:telemetryQueue', JSON.stringify(telemetryQueueRef.current)); } catch {}
        setTelemetryQueueCount(telemetryQueueRef.current.length);
      } catch {}
    } catch (_) {
      // Silenciar errores globales, ya que cada resp se maneja arriba
    }
  }, []);

  // Preferencia de autoRefresh persistida
  useEffect(() => {
    try {
      const saved = localStorage.getItem('observability:autoRefresh');
      if (saved === 'false') setAutoRefresh(false);
      else if (saved === 'true') setAutoRefresh(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (testMode) return;
    // Inicializar baseURL del API para que en preview use backend correcto
    (async () => {
      try { await initializeApiBaseUrl(); } catch { /* noop */ }
      try { setApiBaseUrl((api.defaults.baseURL as string) || ''); } catch { /* noop */ }
      loadData();
      loadHealth();
      loadSubsystemHealth();
    })();
  }, [loadData, loadHealth, testMode]);

  // Ping de latencia API cada 10s (independiente de auto-refresh)
  useEffect(() => {
    if (testMode) return;
    let mounted = true;
    const ping = async () => {
      const start = performance.now();
      try {
        // cancelar ping anterior si existe
        try { (requestsRef.current as any).latency?.abort(); } catch {}
        (requestsRef.current as any).latency = new AbortController();
        const signal = (requestsRef.current as any).latency.signal;
        await api.get('/health', { __suppressGlobalError: true, signal } as any);
        const ms = Math.round(performance.now() - start);
        if (!mounted) return;
        setApiLatencyHistory(prev => {
          const now = Date.now();
          const next = [{ timestamp: now, latencyMs: ms }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:apiLatencyHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {
        const ms = Math.round(performance.now() - start);
        if (!mounted) return;
        setApiLatencyHistory(prev => {
          const now = Date.now();
          const next = [{ timestamp: now, latencyMs: ms, hadError: true }, ...prev].slice(0, HISTORY_POINTS);
          try { localStorage.setItem('observability:apiLatencyHistory', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    };
    // primer ping inmediato y luego intervalo
    ping();
    const id = window.setInterval(ping, API_PING_INTERVAL_MS);
    return () => { mounted = false; clearInterval(id); try { (requestsRef.current as any).latency?.abort(); } catch {} };
  }, [testMode]);

  // Auto-refresh con respeto al cooldown
  const tick = useCallback(() => {
    if (Date.now() < errorCooldownRef.current) return;
    loadData();
    loadHealth();
    loadSubsystemHealth();
  }, [loadData, loadHealth, loadSubsystemHealth]);

  useEffect(() => {
    if (testMode || !autoRefresh) return;
    const id = window.setInterval(() => {
      tick();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick, testMode, autoRefresh]);

  // Abortar en desmontaje
  useEffect(() => {
    return () => {
      try { requestsRef.current.health?.abort(); } catch {}
      try { requestsRef.current.subsystems?.abort(); } catch {}
    };
  }, []);

  // Envío de telemetría al backend si está configurado
  useEffect(() => {
    if (!TELEMETRY_URL) return;
    const send = async () => {
      if (Date.now() < telemetrySendCooldownRef.current) return;
      const batch = telemetryQueueRef.current.slice(0, 50);
      if (!batch.length) return;
      try {
        const resp = await fetch(TELEMETRY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'observability', points: batch }),
          keepalive: true,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        telemetryQueueRef.current = telemetryQueueRef.current.slice(batch.length);
        telemetrySendAttemptsRef.current = 0;
        telemetrySendCooldownRef.current = 0;
        setTelemetryQueueCount(telemetryQueueRef.current.length);
        try { localStorage.setItem('observability:telemetryQueue', JSON.stringify(telemetryQueueRef.current)); } catch {}
        setTelemetryLastSendStatus('ok');
        setTelemetryLastSendAt(Date.now());
      } catch (e) {
        telemetrySendAttemptsRef.current = Math.min(telemetrySendAttemptsRef.current + 1, 6);
        const jitter = Math.floor(Math.random() * 800);
        const delay = Math.min(3000 * Math.pow(2, telemetrySendAttemptsRef.current - 1) + jitter, 90000);
        telemetrySendCooldownRef.current = Date.now() + delay;
        setTelemetryLastSendStatus('error');
        setTelemetryLastSendAt(Date.now());
      }
    };
    const id = window.setInterval(send, 60000);
    return () => clearInterval(id);
  }, []);

  // Restaurar telemetría y cola desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('observability:telemetry');
      const qraw = localStorage.getItem('observability:telemetryQueue');
      const arr = raw ? JSON.parse(raw) : [];
      const qarr = qraw ? JSON.parse(qraw) : [];
      if (Array.isArray(arr)) telemetryRef.current = arr.slice(0, 50);
      if (Array.isArray(qarr)) telemetryQueueRef.current = qarr.slice(0, 200);
      setTelemetryQueueCount(telemetryQueueRef.current.length);
    } catch {}
  }, []);

  // Indicador de cooldown restante
  useEffect(() => {
    const id = window.setInterval(() => {
      const rem = Math.max(0, errorCooldownRef.current - Date.now());
      setCooldownRemainingMs(rem);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => {
      const next = !prev;
      try { localStorage.setItem('observability:autoRefresh', String(next)); } catch {}
      return next;
    });
  }, []);

  const computeStats = useCallback((arr: any[], key: string) => {
    const values = arr.map(h => Number(h?.[key] ?? 0)).filter(v => !Number.isNaN(v));
    if (!values.length) return null as null | { min: number; max: number; trend: number };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const last = values[0];
    const prev = values[1] ?? last;
    const trend = last - prev;
    return { min, max, trend };
  }, []);

  // Cargar resumen de verificación con proxy en dev y fallback por API
  const loadVerificationSummary = useCallback(async () => {
    setVerifLoading(true);
    setVerifError(null);
    try {
      // 1) Intentar vía mismo origen (Vite proxy a /exports en dev)
      const relUrl = '/exports/verification-summary.json';
      try {
        const r1 = await fetch(relUrl, { headers: { 'Cache-Control': 'no-cache' } });
        if (r1.ok) {
          const data = await r1.json();
          setVerifSummary(data);
          return;
        }
      } catch {}

      // 2) Intentar vía URL absoluta del backend (Electron/prod con servidor propio)
      const base = api.defaults?.baseURL || '';
      let backendOrigin = '';
      try {
        if (base.startsWith('http')) {
          const u = new URL(base.replace(/\/api$/, ''));
          backendOrigin = u.origin;
        }
      } catch {}
      if (!backendOrigin) {
        const envApi = (import.meta as any).env?.VITE_API_URL as string | undefined;
        if (envApi) {
          try {
            const u = new URL(envApi.replace(/\/api$/, ''));
            backendOrigin = u.origin;
          } catch {}
        }
      }
      if (!backendOrigin) backendOrigin = 'http://localhost:5656';
      try {
        const absUrl = `${backendOrigin}/exports/verification-summary.json`;
        const r2 = await fetch(absUrl, { headers: { 'Cache-Control': 'no-cache' } });
        if (r2.ok) {
          const data = await r2.json();
          setVerifSummary(data);
          return;
        }
      } catch {}

      // 3) Fallback: consultar resumen calculado por API autenticada
      // Evita depender del archivo estático si hay restricciones de red/CORS
      const resp = await api.get('/files/integrity/scan');
      const result = resp?.data?.data || resp?.data || {};
      const s = result?.summary || {};
      setVerifSummary({
        counts: {
          total: Number(s?.total ?? 0),
          match: Number(s?.ok ?? 0),
          mismatch: Number(s?.mismatch ?? 0),
          missing: Number(s?.missing ?? 0),
          error: 0,
        },
        durationMs: Number(result?.durationMs ?? 0),
        timestamp: new Date().toISOString(),
      });
    } catch (e: unknown) {
      setVerifError((e as Error)?.message || 'No se pudo cargar el resumen');
    } finally {
      setVerifLoading(false);
    }
  }, []);

  // Ejecutar escaneo de integridad vía API autenticada
  const scanFilesIntegrity = useCallback(async () => {
    const t0 = Date.now();
    try {
      setVerifLoading(true);
      setVerifError(null);
      const resp = await api.get('/files/integrity/scan');
      const result = resp?.data?.data || resp?.data || {};
      const s = result?.summary || {};
      const durationMs = Date.now() - t0;
      setVerifSummary({
        counts: {
          total: Number(s?.total ?? 0),
          match: Number(s?.ok ?? 0),
          mismatch: Number(s?.mismatch ?? 0),
          missing: Number(s?.missing ?? 0),
          error: 0,
        },
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (e: unknown) {
      setVerifError((e as Error)?.message || 'No se pudo ejecutar el escaneo');
    } finally {
      setVerifLoading(false);
    }
  }, []);

  // Descargar reporte de integridad CSV (endpoint autenticado)
  const downloadIntegrityCsv = useCallback(async () => {
    try {
      const resp = await api.get('/files/integrity/export/csv', { responseType: 'blob' });
      const blob = new Blob([resp?.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const dispo = (resp as any)?.headers?.['content-disposition'] || '';
      const m = typeof dispo === 'string' ? dispo.match(/filename="?([^";]+)"?/i) : null;
      const filename = (m && m[1]) || `files_integrity_${new Date().toISOString().slice(0,10)}.csv`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      setVerifError((e as Error)?.message || 'No se pudo descargar el CSV');
    }
  }, []);

  // Descargar reporte de integridad PDF (endpoint autenticado)
  const downloadIntegrityPdf = useCallback(async () => {
    try {
      const resp = await api.get('/files/integrity/export/pdf', { responseType: 'blob' });
      const blob = new Blob([resp?.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const dispo = (resp as any)?.headers?.['content-disposition'] || '';
      const m = typeof dispo === 'string' ? dispo.match(/filename="?([^";]+)"?/i) : null;
      const filename = (m && m[1]) || `files_integrity_${new Date().toISOString().slice(0,10)}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      setVerifError((e as Error)?.message || 'No se pudo descargar el PDF');
    }
  }, []);

  // Descarga verificada directa por fileId
  const [fileIdInput, setFileIdInput] = useState<string>('');
  const [verifiedInfo, setVerifiedInfo] = useState<{ status: 'idle'|'downloading'|'done'|'error'; message?: string; match?: boolean; expected?: string; actual?: string; filename?: string }>({ status: 'idle' });
  const handleVerifiedDownload = useCallback(async () => {
    const id = fileIdInput.trim();
    if (!id) return;
    try {
      setVerifiedInfo({ status: 'downloading' });
      const { downloadVerified } = await import('@/services/filesService');
      const res = await downloadVerified(id);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `file_${id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setVerifiedInfo({
        status: 'done',
        match: !!res.integrity.match,
        expected: res.integrity.expected,
        actual: res.integrity.actual,
        filename: res.filename,
      });
    } catch (e: unknown) {
      setVerifiedInfo({ status: 'error', message: (e as Error)?.message || 'Fallo en descarga verificada' });
    }
  }, [fileIdInput]);

  useEffect(() => {
    // Cargar resumen al montar
    loadVerificationSummary();
    // Auto-actualizar cada 60s si está habilitado
    if (autoRefresh) {
      const id = window.setInterval(() => loadVerificationSummary(), 60000);
      return () => window.clearInterval(id);
    }
    return () => {};
  }, [autoRefresh, loadVerificationSummary]);

  const countsBySeverity = useMemo(() => metrics?.countsBySeverity || {}, [metrics]);
  const countsByTypeList: Array<{ type: string; count: number }> = useMemo(() => {
    const raw = metrics?.countsByType;
    if (Array.isArray(raw)) {
      return raw.map((x: any) => ({ type: String(x?.type ?? ''), count: Number(x?.count ?? 0) }))
        .filter((x) => x.type.length > 0);
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([type, count]) => ({ type, count: Number(count as any) }))
        .filter((x) => x.type.length > 0);
    }
    return [];
  }, [metrics]);
  const latestError: EventRecord | null = useMemo(() => metrics?.latestError || null, [metrics]);
  const latencyByRoute = useMemo(() => metrics?.latencyByRoute || [], [metrics]);

  // Orden y filtro para latencias por ruta
  const [latencySortKey, setLatencySortKey] = useState<'avgMs'|'p50Ms'|'p95Ms'|'p99Ms'|'count'>('p95Ms');
  const [latencySortDir, setLatencySortDir] = useState<'asc'|'desc'>('desc');
  const [latencyMethodFilter, setLatencyMethodFilter] = useState<string>('');
  const [latRouteFilter, setLatRouteFilter] = useState<string>('');
  const latencyMethods = useMemo(() => {
    const set = new Set<string>();
    for (const r of latencyByRoute) {
      if (r?.method) set.add(String(r.method));
    }
    return Array.from(set);
  }, [latencyByRoute]);
  const latencyRows = useMemo(() => {
    let rows = Array.isArray(latencyByRoute) ? [...latencyByRoute] : [];
    if (latencyMethodFilter) rows = rows.filter((r: any) => r.method === latencyMethodFilter);
    if (latRouteFilter) rows = rows.filter((r: any) => String(r.url || '').toLowerCase().includes(latRouteFilter.toLowerCase()));
    rows.sort((a: any, b: any) => {
      const va = Number(a?.[latencySortKey] ?? 0);
      const vb = Number(b?.[latencySortKey] ?? 0);
      return latencySortDir === 'asc' ? va - vb : vb - va;
    });
    return rows;
  }, [latencyByRoute, latencyMethodFilter, latRouteFilter, latencySortKey, latencySortDir]);

  // Paginación cliente para latencias por ruta
  const [latPage, setLatPage] = useState<number>(1);
  const [latLimit, setLatLimit] = useState<number>(10);
  const eventActiveFiltersCount = useMemo(() => {
    let c = 0;
    if (typeFilter) c++;
    if (severityFilter) c++;
    if (search) c++;
    if (from) c++;
    if (to) c++;
    if (windowHours !== 24) c++;
    if (limit !== 20) c++;
    return c;
  }, [typeFilter, severityFilter, search, from, to, windowHours, limit]);
  const eventFiltersTooltip = useMemo(() => {
    const parts: string[] = [];
    if (typeFilter) parts.push(`Tipo: ${typeFilter}`);
    if (severityFilter) parts.push(`Severidad: ${severityFilter}`);
    if (search) parts.push(`Búsqueda: ${search}`);
    if (from) parts.push(`Desde: ${from}`);
    if (to) parts.push(`Hasta: ${to}`);
    if (windowHours !== 24) parts.push(`Ventana: ${windowHours}h`);
    if (limit !== 20) parts.push(`Límite: ${limit}`);
    return parts.length ? `Usando: ${parts.join(', ')}` : 'Sin filtros activos';
  }, [typeFilter, severityFilter, search, from, to, windowHours, limit]);
  const latencyActiveFiltersCount = useMemo(() => {
    let c = 0;
    if (latencyMethodFilter) c++;
    if (latRouteFilter) c++;
    if (latencySortKey !== 'p95Ms') c++;
    if (latencySortDir !== 'desc') c++;
    if (latLimit !== 10) c++;
    return c;
  }, [latencyMethodFilter, latRouteFilter, latencySortKey, latencySortDir, latLimit]);
  const latencyFiltersTooltip = useMemo(() => {
    const parts: string[] = [];
    if (latencyMethodFilter) parts.push(`Método: ${latencyMethodFilter}`);
    if (latRouteFilter) parts.push(`Ruta: ${latRouteFilter}`);
    if (latencySortKey !== 'p95Ms') parts.push(`Orden: ${latencySortKey}`);
    if (latencySortDir !== 'desc') parts.push(`Dirección: ${latencySortDir}`);
    if (latLimit !== 10) parts.push(`Límite: ${latLimit}`);
    return parts.length ? `Usando: ${parts.join(', ')}` : 'Sin filtros activos';
  }, [latencyMethodFilter, latRouteFilter, latencySortKey, latencySortDir, latLimit]);
  const latTotalPages = useMemo(() => {
    const total = Array.isArray(latencyRows) ? latencyRows.length : 0;
    return Math.max(1, Math.ceil(total / latLimit));
  }, [latencyRows, latLimit]);
  const latPageRows = useMemo(() => {
    const start = (latPage - 1) * latLimit;
    return latencyRows.slice(start, start + latLimit);
  }, [latencyRows, latPage, latLimit]);

  // Leer sort/filtro de la URL al cargar
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sort = params.get('lat_sort');
      const dir = params.get('lat_dir');
      const meth = params.get('lat_method');
      const qLatRoute = params.get('lat_route');
      const qLatLimit = params.get('lat_limit');
      const qLatPage = params.get('lat_page');
      // Filtros de eventos
      const qType = params.get('type');
      const qSeverity = params.get('severity');
      const qLimit = params.get('limit');
      const qPage = params.get('page');
      const qSearch = params.get('search');
      const qFrom = params.get('from');
      const qTo = params.get('to');
      const qWin = params.get('windowHours');
      if (sort && ['avgMs','p50Ms','p95Ms','p99Ms','count'].includes(sort)) {
        setLatencySortKey(sort as 'avgMs'|'p50Ms'|'p95Ms'|'p99Ms'|'count');
      }
      if (dir && (dir === 'asc' || dir === 'desc')) {
        setLatencySortDir(dir as 'asc'|'desc');
      }
      if (meth) {
        setLatencyMethodFilter(meth);
      }
      if (qLatRoute) {
        setLatRouteFilter(qLatRoute);
      }
      if (qLatLimit) {
        const n = parseInt(qLatLimit);
        if (!Number.isNaN(n) && n > 0) setLatLimit(n);
      }
      if (qLatPage) {
        const n = parseInt(qLatPage);
        if (!Number.isNaN(n) && n > 0) setLatPage(n);
      }
      if (qType) setTypeFilter(qType);
      if (qSeverity && ['info','warning','error','exception'].includes(qSeverity)) {
        setSeverityFilter(qSeverity as EventSeverity);
      }
      if (qLimit) {
        const n = parseInt(qLimit);
        if (!Number.isNaN(n) && n > 0) setLimit(n);
      }
      if (qPage) {
        const n = parseInt(qPage);
        if (!Number.isNaN(n) && n > 0) setPage(n);
      }
      if (qSearch) setSearch(qSearch);
      if (qFrom) setFrom(qFrom);
      if (qTo) setTo(qTo);
      if (qWin) {
        const n = parseInt(qWin);
        if (!Number.isNaN(n)) setWindowHours(n);
      }
      // Si no hay parámetros en la URL, intentar cargar filtros desde localStorage
      const hadEventParams = ['type','severity','limit','page','search','from','to','windowHours'].some((k) => params.has(k));
      const hadLatencyParams = ['lat_sort','lat_dir','lat_method','lat_route','lat_limit','lat_page'].some((k) => params.has(k));
      if (!hadEventParams) {
        try {
          const raw = window.localStorage.getItem('obs_events_filters');
          if (raw) {
            const v = JSON.parse(raw || '{}');
            if (typeof v.type === 'string') setTypeFilter(v.type);
            if (typeof v.severity === 'string' && ['info','warning','error'].includes(v.severity)) setSeverityFilter(v.severity as EventSeverity);
            if (typeof v.limit === 'number' && v.limit > 0) setLimit(v.limit);
            if (typeof v.page === 'number' && v.page > 0) setPage(v.page);
            if (typeof v.search === 'string') setSearch(v.search);
            if (typeof v.from === 'string') setFrom(v.from);
            if (typeof v.to === 'string') setTo(v.to);
            if (typeof v.windowHours === 'number') setWindowHours(v.windowHours);
          }
        } catch {}
      }
      if (!hadLatencyParams) {
        try {
          const raw = window.localStorage.getItem('obs_latency_filters');
          if (raw) {
            const v = JSON.parse(raw || '{}');
            if (typeof v.latencySortKey === 'string' && ['avgMs','p50Ms','p95Ms','p99Ms','count'].includes(v.latencySortKey)) setLatencySortKey(v.latencySortKey as any);
            if (typeof v.latencySortDir === 'string' && (v.latencySortDir === 'asc' || v.latencySortDir === 'desc')) setLatencySortDir(v.latencySortDir);
            if (typeof v.latencyMethodFilter === 'string') setLatencyMethodFilter(v.latencyMethodFilter);
            if (typeof v.latRouteFilter === 'string') setLatRouteFilter(v.latRouteFilter);
            if (typeof v.latLimit === 'number' && v.latLimit > 0) setLatLimit(v.latLimit);
            if (typeof v.latPage === 'number' && v.latPage > 0) setLatPage(v.latPage);
          }
        } catch {}
      }
      // Preferencia de auto-actualización
      try {
        const rawAuto = window.localStorage.getItem('obs_auto_refresh');
        if (rawAuto === 'true' || rawAuto === 'false') {
          setAutoRefresh(rawAuto === 'true');
        }
      } catch {}
    } catch {}
  }, []);

  // Persistir sort/filtro en la URL cuando cambian
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      params.set('lat_sort', latencySortKey);
      params.set('lat_dir', latencySortDir);
      if (latencyMethodFilter) params.set('lat_method', latencyMethodFilter);
      else params.delete('lat_method');
      if (latRouteFilter) params.set('lat_route', latRouteFilter);
      else params.delete('lat_route');
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [latencySortKey, latencySortDir, latencyMethodFilter, latRouteFilter]);

  // Persistir filtros de eventos en la URL cuando cambian
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      if (typeFilter) params.set('type', typeFilter); else params.delete('type');
      if (severityFilter) params.set('severity', String(severityFilter)); else params.delete('severity');
      params.set('limit', String(limit));
      params.set('page', String(page));
      if (search) params.set('search', search); else params.delete('search');
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [typeFilter, severityFilter, limit, page, search]);

  // Persistir filtros de fecha/ventana en la URL cuando cambian
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      if (from) params.set('from', from); else params.delete('from');
      if (to) params.set('to', to); else params.delete('to');
      params.set('windowHours', String(windowHours));
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [from, to, windowHours]);

  // Persistir paginación de latencias en la URL cuando cambian
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      params.set('lat_limit', String(latLimit));
      params.set('lat_page', String(latPage));
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    } catch {}
  }, [latLimit, latPage]);

  // Persistir preferencia de auto-actualización
  useEffect(() => {
    try {
      window.localStorage.setItem('obs_auto_refresh', String(autoRefresh));
    } catch {}
  }, [autoRefresh]);

  // Persistir filtros de eventos en localStorage
  useEffect(() => {
    try {
      const payload = {
        type: typeFilter,
        severity: severityFilter,
        limit,
        page,
        search,
        from,
        to,
        windowHours,
      };
      window.localStorage.setItem('obs_events_filters', JSON.stringify(payload));
    } catch {}
  }, [typeFilter, severityFilter, limit, page, search, from, to, windowHours]);

  // Persistir filtros de latencia en localStorage
  useEffect(() => {
    try {
      const payload = {
        latencySortKey,
        latencySortDir,
        latencyMethodFilter,
        latRouteFilter,
        latLimit,
        latPage,
      };
      window.localStorage.setItem('obs_latency_filters', JSON.stringify(payload));
    } catch {}
  }, [latencySortKey, latencySortDir, latencyMethodFilter, latRouteFilter, latLimit, latPage]);

  // Asegurar que la página de latencia está dentro de rango cuando cambia el total
  useEffect(() => {
    setLatPage((p) => {
      const clamped = Math.min(Math.max(1, p), latTotalPages);
      return clamped;
    });
  }, [latTotalPages]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 border-b border-gray-200 py-2 px-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Observabilidad</h1>
          <p className="text-gray-600">Eventos y métricas del sistema (últimas 24h)</p>
          {TELEMETRY_URL && String(TELEMETRY_URL).trim() && (
            <a
              href={String(TELEMETRY_URL)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs mt-1 text-blue-700 hover:text-blue-800"
              title="Abrir Telemetría"
            >
              Ver Telemetría ↗
            </a>
          )}
        </div>
      <div className="flex items-center gap-3">
        {/* Selector de Perfil de Umbrales */}
        {(() => {
          const activeProfile = (() => {
            try {
              const o = thresholdOverrides || {};
              // Heurística simple para mostrar etiqueta cuando hay overrides
              return Object.keys(o || {}).length ? (localStorage.getItem('observability:thresholdProfile') || 'custom') : '';
            } catch { return ''; }
          })();
          const applyProfile = (profile: string) => {
            const PRESETS: Record<string, Record<string, number>> = {
              development: {
                SALES_WARN_COUNT: 10, SALES_CRIT_COUNT: 20,
                SALEITEMS_WARN_COUNT: 50, SALEITEMS_CRIT_COUNT: 100,
                JOBS_FAILED_WARN_COUNT: 2, JOBS_FAILED_CRIT_COUNT: 5,
                JOBS_PENDING_WARN_COUNT: 5, JOBS_PENDING_CRIT_COUNT: 15,
                JOBS_QUEUEAGE_WARN_MS: 2000, JOBS_QUEUEAGE_CRIT_MS: 5000,
                JOBS_PROCTIME_WARN_MS: 3000, JOBS_PROCTIME_CRIT_MS: 8000,
                LEDGER_WARN_COUNT: 1000, LEDGER_CRIT_COUNT: 2000,
                IDEMPOTENCY_WARN_COUNT: 2, IDEMPOTENCY_CRIT_COUNT: 10,
              },
              staging: {
                SALES_WARN_COUNT: 15, SALES_CRIT_COUNT: 30,
                SALEITEMS_WARN_COUNT: 75, SALEITEMS_CRIT_COUNT: 150,
                JOBS_FAILED_WARN_COUNT: 3, JOBS_FAILED_CRIT_COUNT: 8,
                JOBS_PENDING_WARN_COUNT: 8, JOBS_PENDING_CRIT_COUNT: 20,
                JOBS_QUEUEAGE_WARN_MS: 3000, JOBS_QUEUEAGE_CRIT_MS: 7000,
                JOBS_PROCTIME_WARN_MS: 4000, JOBS_PROCTIME_CRIT_MS: 9000,
                LEDGER_WARN_COUNT: 1500, LEDGER_CRIT_COUNT: 3000,
                IDEMPOTENCY_WARN_COUNT: 3, IDEMPOTENCY_CRIT_COUNT: 12,
              },
              production: {
                SALES_WARN_COUNT: 20, SALES_CRIT_COUNT: 40,
                SALEITEMS_WARN_COUNT: 100, SALEITEMS_CRIT_COUNT: 200,
                JOBS_FAILED_WARN_COUNT: 5, JOBS_FAILED_CRIT_COUNT: 12,
                JOBS_PENDING_WARN_COUNT: 10, JOBS_PENDING_CRIT_COUNT: 30,
                JOBS_QUEUEAGE_WARN_MS: 4000, JOBS_QUEUEAGE_CRIT_MS: 10000,
                JOBS_PROCTIME_WARN_MS: 5000, JOBS_PROCTIME_CRIT_MS: 12000,
                LEDGER_WARN_COUNT: 2000, LEDGER_CRIT_COUNT: 4000,
                IDEMPOTENCY_WARN_COUNT: 4, IDEMPOTENCY_CRIT_COUNT: 15,
              },
            };
            const next = PRESETS[profile] || {};
            setThresholdOverrides(next);
            try {
              localStorage.setItem('observability:thresholdOverrides', JSON.stringify(next));
              localStorage.setItem('observability:thresholdProfile', profile);
            } catch {}
          };
          const resetProfile = () => {
            setThresholdOverrides({});
            try {
              localStorage.removeItem('observability:thresholdOverrides');
              localStorage.removeItem('observability:thresholdProfile');
            } catch {}
          };
          return (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Perfil de umbrales</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={activeProfile || ''}
                onChange={(e) => applyProfile(e.target.value)}
              >
                <option value="">Por defecto (.env)</option>
                <option value="development">Desarrollo</option>
                <option value="staging">Staging</option>
                <option value="production">Producción</option>
              </select>
              {activeProfile && (
                <span className="text-xs px-2 py-1 rounded border bg-indigo-50 border-indigo-200 text-indigo-700" title="Overrides activos">
                  {activeProfile}
                </span>
              )}
              <button onClick={resetProfile} className="text-xs text-gray-600 hover:text-gray-800" title="Quitar overrides">Reset</button>
            </div>
          );
        })()}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-actualizar (30s)
        </label>
        <button
          onClick={loadData}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Actualizar
          </button>
            <button
              onClick={() => {
                const next = !mocksEnabled;
                setMocksEnabled(next);
                try { localStorage.setItem('observability:useMocks', next ? 'true' : 'false'); } catch {}
              }}
              className={`px-2 py-1 rounded-md text-xs border ${mocksEnabled ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
              title="Alternar mocks de API (runtime)"
            >
              Mocks {mocksEnabled ? 'ON' : 'OFF'}
            </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopyInfo('Enlace copiado');
              setCopyStatus('success');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            } catch {
              setCopyInfo('No se pudo copiar');
              setCopyStatus('error');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            }
          }}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
        >
          Copiar enlace
        </button>
        <button
          onClick={async () => {
            try {
              const state = {
                url: window.location.href,
                autoRefresh,
                events: {
                  type: typeFilter,
                  severity: severityFilter,
                  limit,
                  page,
                  search,
                  from,
                  to,
                  windowHours,
                },
                latency: {
                  latencySortKey,
                  latencySortDir,
                  latencyMethodFilter,
                  latRouteFilter,
                  latLimit,
                  latPage,
                },
              };
              const text = JSON.stringify(state, null, 2);
              await navigator.clipboard.writeText(text);
              setCopyInfo('Estado copiado');
              setCopyStatus('success');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            } catch {
              setCopyInfo('No se pudo copiar el estado');
              setCopyStatus('error');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            }
          }}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
          title="Copiar filtros actuales, URL y preferencias en JSON"
        >
          Copiar estado
        </button>
        <button
          onClick={() => {
            try {
              window.localStorage.removeItem('obs_events_filters');
              window.localStorage.removeItem('obs_latency_filters');
              // Resetear filtros de eventos
              setTypeFilter('');
              setSeverityFilter('');
              setLimit(20);
              setPage(1);
              setSearch('');
              setFrom('');
              setTo('');
              setWindowHours(24);
              // Resetear filtros de latencias
              setLatencySortKey('p95Ms');
              setLatencySortDir('desc');
              setLatencyMethodFilter('');
              setLatRouteFilter('');
              setLatLimit(10);
              setLatPage(1);
              setCopyInfo('Preferencias reiniciadas');
              setCopyStatus('success');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            } catch {
              setCopyInfo('No se pudieron reiniciar las preferencias');
              setCopyStatus('error');
              window.setTimeout(() => setCopyInfo(''), 2000);
              window.setTimeout(() => setCopyStatus(''), 2000);
            }
          }}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
          title="Borrar filtros guardados y restablecer a valores por defecto"
        >
          Resetear preferencias
        </button>
        {(() => {
          const subject = encodeURIComponent('Observabilidad - Estado');
          const topSlow = (latPageRows || []).slice(0, 3)
            .map((r: any) => `${r.method || ''} ${r.url}: p95 ${r.p95Ms ?? '-'}ms`)
            .join('\n');
          const sevSummary = `Info: ${countsBySeverity?.info || 0}, Warning: ${countsBySeverity?.warning || 0}, Error: ${countsBySeverity?.error || 0}`;
          const bodyRaw = `Link: ${window.location.href}\n\nSeveridad -> ${sevSummary}\n\nTop lentas (p95):\n${topSlow}`;
          const body = bodyRaw.replace(/\n/g, '\r\n');
          const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
          return (
            <>
              <a
                href={mailto}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border inline-block"
              >
                Compartir por email
              </a>
              <button
                onClick={async () => {
                  try {
                    const text = `Asunto: ${decodeURIComponent(subject)}\r\n\r\n${body}`;
                    await navigator.clipboard.writeText(text);
                    setCopyInfo('Contenido de email copiado');
                    setCopyStatus('success');
                    window.setTimeout(() => setCopyInfo(''), 2000);
                    window.setTimeout(() => setCopyStatus(''), 2000);
                  } catch {
                    setCopyInfo('No se pudo copiar el contenido');
                    setCopyStatus('error');
                    window.setTimeout(() => setCopyInfo(''), 2000);
                    window.setTimeout(() => setCopyStatus(''), 2000);
                  }
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
                title="Copiar el contenido del email como fallback"
              >
                Copiar contenido email
              </button>
            </>
          );
        })()}
        {copyInfo && (
          <span
            className={
              `text-xs px-2 py-1 rounded border ${
                copyStatus === 'success'
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : copyStatus === 'error'
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-gray-600 bg-gray-50 border-gray-200'
              }`
            }
          >
            {copyInfo}
          </span>
        )}
      </div>
      {/* Banner de misconfiguración de API */}
      {(!apiBaseUrl || String(apiBaseUrl).trim() === '') && (
        <div className="mt-2 px-3 py-2 rounded border text-yellow-800 bg-yellow-50 border-yellow-200 text-sm">
          Configuración de API ausente: define `VITE_API_BASE_URL` o utiliza el proxy `/api`.
        </div>
      )}
      {/* Banner de backend inalcanzable */}
      {(() => {
        const st = backendStatusVal;
        if (st === 'ok') return null;
        const cls = st === 'no_health' ? 'text-yellow-800 bg-yellow-50 border-yellow-200' : 'text-red-800 bg-red-50 border-red-200';
        const label = st === 'no_health' ? 'Backend sin health check' : 'Backend inalcanzable';
        return (
          <div className={`mt-2 px-3 py-2 rounded border ${cls} text-sm`}>
            {label}. Algunas operaciones podrían estar deshabilitadas temporalmente.
          </div>
        );
      })()}
      </div>

      {/* Salud del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Salud del backend</div>
            <button
              onClick={() => { loadHealth(); loadSubsystemHealth(); }}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
            >
              Refrescar
            </button>
          </div>
          {healthLoading && <LoadingSpinner size="sm" />}
          {!healthLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado</span>
                <span className={`px-2 py-1 rounded border ${health?.success !== false ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>{health?.success !== false ? 'OK' : 'ERROR'}</span>
              </div>
              {(() => {
                try {
                  const base = String(integritySummary?.exports?.base || '');
                  const writable = Boolean(integritySummary?.exports?.writable);
                  if (!base) return null;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Exportaciones (base)</span>
                        <span className="text-gray-900 font-mono text-xs" title={base}>{base}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Exportaciones (escribible)</span>
                        <span className={`px-2 py-1 rounded border ${writable ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>{writable ? 'OK' : 'ERROR'}</span>
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
              {health?.version && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Versión</span>
                  <span className="font-semibold text-gray-900">{String(health.version)}</span>
                </div>
              )}
              {typeof health?.uptimeSec === 'number' && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-semibold text-gray-900">{health.uptimeSec}s</span>
                </div>
              )}
              {health?.timestamp && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Servidor (hora)</span>
                  <span className="text-gray-900">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Base de datos</span>
                <span className={`px-2 py-1 rounded border ${((health?.db?.healthy ?? (health?.db?.status === 'ok')) ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200')}`}>{(health?.db?.healthy ?? (health?.db?.status === 'ok')) ? 'OK' : 'ERROR'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Validación de configuración</div>
          {healthLoading && <div className="text-xs text-gray-500">Cargando...</div>}
          {!healthLoading && (
            <div className="space-y-2 text-sm">
              {(() => {
                try {
                  const corsInfo = (configMeta as any)?.cors || null;
                  if (!corsInfo) return null;
                  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                  const backendUrl = String(corsInfo.frontendUrl || '');
                  let backendOrigin = '';
                  try { backendOrigin = backendUrl ? new URL(backendUrl).origin : ''; } catch { backendOrigin = backendUrl.replace(/\/+$/,''); }
                  const computed = Array.isArray(corsInfo.computedOrigins) ? corsInfo.computedOrigins : [];
                  const isAligned = !!(backendOrigin && currentOrigin && backendOrigin === currentOrigin);
                  const isAllowed = !!(currentOrigin && computed.includes(currentOrigin));
                  if (isAligned) return null; // No mostrar banner si está alineado
                  const colorClass = isAllowed ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200';
                  const title = isAllowed
                    ? 'Origen permitido por CORS, pero FRONTEND_URL no coincide'
                    : 'Origen actual no permitido por CORS';
                  const details = `Frontend: ${currentOrigin || '(desconocido)'} · Backend FRONTEND_URL: ${backendUrl || '(sin configurar)'}${computed.length ? ` · ComputedOrigins: ${computed.length}` : ''}`;
                  return (
                    <div className={`px-3 py-2 rounded border ${colorClass}`} title={details}>
                      <div className="font-semibold text-xs">{title}</div>
                      <div className="text-[11px]">{details}</div>
                    </div>
                  );
                } catch { return null; }
              })()}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Resultado</span>
                <span className={`px-2 py-1 rounded border ${((health?.config?.ok ?? (health?.config?.errors === 0)) ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200')}`}>{(health?.config?.ok ?? (health?.config?.errors === 0)) ? 'OK' : 'Revisar'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Errores</span>
                <span className="font-semibold text-gray-900">{Number(health?.config?.errors ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Warnings</span>
                <span className="font-semibold text-gray-900">{Number(health?.config?.warnings ?? 0)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setConfigExpanded((v) => !v)}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title={configExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                >
                  {configExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                </button>
                <label className="flex items-center gap-2 text-xs text-gray-700" title="Cuando está activo, se ignoran los campos seleccionados">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={configVerbose}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setConfigVerbose(v);
                      try { localStorage.setItem('observability:configVerbose', v ? '1' : '0'); } catch {}
                    }}
                  />
                  Verbose
                </label>
                {!configVerbose && (
                  <input
                    type="text"
                    value={configFields}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfigFields(v);
                      try { localStorage.setItem('observability:configFields', v); } catch {}
                    }}
                    placeholder="env,cors,db,uploads,validation,envFlags"
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border focus:outline-none focus:ring-1 focus:ring-blue-300"
                    title="Campos de /meta/config (coma-separados)"
                  />
                )}
                {!configVerbose && (
                  <select
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border"
                    title="Presets de fields"
                    onChange={(e) => {
                      const preset = e.target.value;
                      setConfigFields(preset);
                      try { localStorage.setItem('observability:configFields', preset); } catch {}
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Presets</option>
                    <option value={defaultConfigFields}>Básico</option>
                    <option value="env,config,envFlags">Sistema</option>
                    <option value="db,uploads">Almacenamiento</option>
                    <option value="env,cors">Red/CORS</option>
                    <option value="env,cors,db,uploads,validation,envFlags,config">Todo</option>
                  </select>
                )}
                {!configVerbose && (
                  <button
                    onClick={() => {
                      setConfigFields(defaultConfigFields);
                      try { localStorage.setItem('observability:configFields', defaultConfigFields); } catch {}
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                    title="Restaurar fields por defecto"
                  >
                    Reset
                  </button>
                )}
                {!configVerbose && (
                  <span
                    className="text-[11px] text-gray-600"
                    title={`Campos soportados: ${allowedFieldsList.join(', ')}. Los tokens inválidos serán ignorados.`}
                  >
                    Ayuda: campos soportados
                  </span>
                )}
                {!!(!configVerbose && invalidFields?.length) && (
                  <span className="text-[11px] text-yellow-700" title={`Ignorados: ${invalidFields.join(', ')}`}>({invalidFields.length} tokens ignorados)</span>
                )}
                {/* Indicador de alineación entre origen actual y FRONTEND_URL del backend */}
                {(() => {
                  try {
                    const corsInfo = (configMeta as any)?.cors || null;
                    if (!corsInfo) return null;
                    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                    const backendUrl = String(corsInfo.frontendUrl || '');
                    let backendOrigin = '';
                    try { backendOrigin = backendUrl ? new URL(backendUrl).origin : ''; } catch { backendOrigin = backendUrl.replace(/\/+$/,''); }
                    const computed = Array.isArray(corsInfo.computedOrigins) ? corsInfo.computedOrigins : [];
                    const isAligned = !!(backendOrigin && currentOrigin && backendOrigin === currentOrigin);
                    const isAllowed = !!(currentOrigin && computed.includes(currentOrigin));
                    const statusText = isAligned ? 'Alineado' : (isAllowed ? 'Permitido' : 'Desalineado');
                    const colorClass = isAligned
                      ? 'text-green-700 bg-green-50 border-green-200'
                      : (isAllowed ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200');
                    const tooltip = `Frontend: ${currentOrigin || '(desconocido)'} · Backend: ${backendUrl || '(sin configurar)'}${computed.length ? ` · ComputedOrigins: ${computed.length}` : ''}`;
                    return (
                      <span className={`text-xs px-2 py-1 rounded border ${colorClass}`} title={tooltip}>
                        URL {statusText}
                      </span>
                    );
                  } catch { return null; }
                })()}
                <button
                  onClick={() => {
                    try {
                      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                      const corsInfo = (configMeta as any)?.cors || null;
                      const computed = Array.isArray(corsInfo?.computedOrigins) ? corsInfo.computedOrigins : [];
                      const frontendUrl = String(corsInfo?.frontendUrl || '');
                      let frontendOrigin = '';
                      try { frontendOrigin = frontendUrl ? new URL(frontendUrl).origin : ''; } catch { frontendOrigin = frontendUrl.replace(/\/+$/,''); }
                      const host = typeof window !== 'undefined' ? (window.location.host || '') : '';
                      const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
                      const canSameOrigin = !!(currentOrigin && (computed.includes(currentOrigin) || (frontendOrigin && frontendOrigin === currentOrigin)));
                      const target = (isLocalHost || canSameOrigin) ? '/api' : (api.defaults.baseURL as string);
                      api.defaults.baseURL = target;
                      try { setApiBaseUrl(target || ''); } catch {}
                      // Forzar refresco de salud para reflejar cambios
                      loadSubsystemHealth();
                      loadHealth();
                    } catch {}
                  }}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Intentar alinear BASE_URL con el origen actual para evitar CORS"
                >
                  Arreglar BASE_URL/CORS
                </button>
                <button
                  onClick={() => {
                    try {
                      const payload = JSON.stringify(configMeta ?? { message: 'Sin datos de /meta/config' }, null, 2);
                      navigator.clipboard?.writeText(payload);
                      setCopyInfo('Configuración copiada');
                      setCopyStatus('success');
                      setTimeout(() => { setCopyInfo(''); setCopyStatus(''); }, 1500);
                    } catch (e) {
                      setCopyInfo('Error al copiar');
                      setCopyStatus('error');
                      setTimeout(() => { setCopyInfo(''); setCopyStatus(''); }, 1500);
                    }
                  }}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Copiar detalles de configuración"
                >
                  Copiar
                </button>
                <button
                  onClick={loadHealth}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Actualizar estado de configuración"
                >
                  Actualizar
                </button>
                {copyInfo && (
                  <span className={`text-xs ${copyStatus === 'success' ? 'text-green-700' : 'text-red-700'}`}>{copyInfo}</span>
                )}
              </div>
              {configError && (
                <div className="text-xs text-red-700">{configError}</div>
              )}
              {configExpanded && (
                <div className="mt-2 border rounded-md p-3 bg-gray-50 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-gray-600">Entorno</div>
                      <div className="text-gray-900 text-xs font-mono break-words">{String((configMeta?.env?.NODE_ENV ?? configMeta?.env?.nodeEnv ?? (import.meta as any)?.env?.MODE ?? '') || '(no especificado)')}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Servidor</div>
                      <div className="text-gray-900 text-xs font-mono break-words">
                        {(() => {
                          const host = String((configMeta?.env?.host ?? configMeta?.server?.host ?? 'localhost'));
                          const portVal = (configMeta?.env?.port ?? configMeta?.server?.port ?? '') as any;
                          const port = String(portVal || '');
                          const proto = String((configMeta?.env?.httpsEnabled ? 'https' : (configMeta?.server?.protocol ?? (configMeta?.server?.https ? 'https' : 'http'))));
                          return `${proto}://${host}${port ? ':' + port : ''}`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">CORS</div>
                      <div className="text-gray-900 text-xs font-mono break-words">{String((configMeta?.server?.cors?.enabled ? `enabled (${(configMeta?.server?.cors?.origin ?? '*')})` : 'disabled') || 'disabled')}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-600">Base de datos</div>
                      <div className="text-gray-900 text-xs font-mono break-words">{String((configMeta?.db?.dialect ?? configMeta?.database?.dialect ?? '') || '(desconocido)')}</div>
                      {(configMeta?.db?.storagePath || configMeta?.database?.storagePath) && (
                        <div className="text-[11px] text-gray-700 mt-1">{String(configMeta?.db?.storagePath ?? configMeta?.database?.storagePath)}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-600">Directorio de uploads</div>
                      <div className="text-[11px] text-gray-700 font-mono break-words">{String((configMeta?.paths?.uploadsDir ?? configMeta?.uploads?.dir ?? configMeta?.uploads?.basePath ?? '') || '(sin configurar)')}</div>
                    </div>
                  </div>
                  {configMeta?.envFlags && typeof configMeta.envFlags === 'object' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-gray-600">Flags de entorno</div>
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input type="checkbox" className="rounded" checked={!!showThresholds} onChange={(e) => { setShowThresholds(e.target.checked); try { localStorage.setItem('observability:showThresholds', e.target.checked ? '1' : '0'); } catch {} }} />
                          Mostrar umbrales
                        </label>
                      </div>
                      {(() => {
                        try {
                          const flags = configMeta.envFlags as Record<string, boolean>;
                          const criticalKeys = ['JWT_SECRET','FRONTEND_URL','PUBLIC_ORIGIN'];
                          const missing = criticalKeys.filter((k) => !flags[k]);
                          if (missing.length > 0) {
                            return (
                              <div className="mb-2 text-xs px-2 py-1 rounded border text-red-700 bg-red-50 border-red-200">
                                <span className="font-semibold">Configuración crítica faltante:</span>
                                <span className="ml-2 font-mono">{missing.join(', ')}</span>
                              </div>
                            );
                          }
                        } catch { /* noop */ }
                        return null;
                      })()}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {Object.keys(configMeta.envFlags).map((k) => {
                          const ok = !!(configMeta.envFlags as any)[k];
                          return (
                            <div key={`envflag-${k}`} className={`text-xs px-2 py-1 rounded border ${ok ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                              <span className="font-mono">{k}</span>
                              <span className="ml-2">{ok ? 'presente' : 'faltante'}</span>
                            </div>
                          );
                        })}
                      </div>
                      {showThresholds && (
                      <div className="mt-3">
                        <div className="text-gray-600 mb-1">Umbrales actuales</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Ventas</span>
                            <span className="ml-2">warn≥{Number(SALES_WARN_COUNT ?? NaN) || '—'} · crit≥{Number(SALES_CRIT_COUNT ?? NaN) || '—'}</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Items</span>
                            <span className="ml-2">warn≥{Number(SALEITEMS_WARN_COUNT ?? NaN) || '—'} · crit≥{Number(SALEITEMS_CRIT_COUNT ?? NaN) || '—'}</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Jobs Pend.</span>
                            <span className="ml-2">warn≥{Number(JOBS_PENDING_WARN_COUNT ?? NaN) || '—'} · crit≥{Number(JOBS_PENDING_CRIT_COUNT ?? NaN) || '—'}</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Jobs Fall.</span>
                            <span className="ml-2">warn≥{Number(JOBS_FAILED_WARN_COUNT ?? NaN) || '—'} · crit≥{Number(JOBS_FAILED_CRIT_COUNT ?? NaN) || '—'}</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Cola p95</span>
                            <span className="ml-2">warn≥{Number(JOBS_QUEUEAGE_WARN_MS ?? NaN) || '—'}ms · crit≥{Number(JOBS_QUEUEAGE_CRIT_MS ?? NaN) || '—'}ms</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Proc p95</span>
                            <span className="ml-2">warn≥{Number(JOBS_PROCTIME_WARN_MS ?? NaN) || '—'}ms · crit≥{Number(JOBS_PROCTIME_CRIT_MS ?? NaN) || '—'}ms</span>
                          </div>
                          <div className="px-2 py-1 rounded border bg-gray-50 text-gray-700">
                            <span className="font-mono">Inventario</span>
                            <span className="ml-2">mov warn≥{Number(LEDGER_WARN_COUNT ?? NaN) || '—'} · mov crit≥{Number(LEDGER_CRIT_COUNT ?? NaN) || '—'} · idem warn≥{Number(IDEMPOTENCY_WARN_COUNT ?? NaN) || '—'} · idem crit≥{Number(IDEMPOTENCY_CRIT_COUNT ?? NaN) || '—'}</span>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-600">Errores</div>
                      {Array.isArray(configMeta?.validation?.errors) && configMeta.validation.errors.length > 0 ? (
                        <ul className="text-[11px] text-red-700 list-disc list-inside space-y-0.5">
                          {configMeta.validation.errors.slice(0,10).map((msg: any, idx: number) => (
                            <li key={`cfg-err-${idx}`}>{String(msg)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-[11px] text-gray-600">Sin errores reportados</div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-600">Warnings</div>
                      {Array.isArray(configMeta?.validation?.warnings) && configMeta.validation.warnings.length > 0 ? (
                        <ul className="text-[11px] text-yellow-700 list-disc list-inside space-y-0.5">
                          {configMeta.validation.warnings.slice(0,10).map((msg: any, idx: number) => (
                            <li key={`cfg-warn-${idx}`}>{String(msg)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-[11px] text-gray-600">Sin warnings reportados</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Rutas expuestas</div>
          {healthLoading && <div className="text-xs text-gray-500">Cargando...</div>}
          {!healthLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold text-gray-900">{Number((endpointsMeta?.count ?? endpointsMeta?.routes?.length ?? endpointsMeta?.items?.length) ?? 0)}</span>
              </div>
              {endpointsMeta?.groups && (
                <div>
                  <div className="text-gray-600 mb-1">Por módulo</div>
                  <div className="space-y-1">
                    {(() => {
                      const raw = endpointsMeta.groups as any;
                      const items: Array<{ module: string; count: number }> = [];

                      if (Array.isArray(raw)) {
                        for (const g of raw) {
                          const moduleName = String((g?.module ?? g?.name ?? 'Desconocido'));
                          const count = Number((g?.count ?? g?.value ?? 0));
                          items.push({ module: moduleName, count });
                        }
                      } else if (raw && typeof raw === 'object') {
                        for (const [key, val] of Object.entries(raw)) {
                          let moduleName = String(key);
                          let count = 0;
                          if (typeof val === 'number') {
                              count = Number(val);
                          } else if (val && typeof val === 'object') {
                              moduleName = String((val as any).module ?? (val as any).name ?? key);
                              count = Number((val as any).count ?? (val as any).value ?? 0);
                          }
                          items.push({ module: moduleName, count });
                        }
                      }

                      return items.map(({ module, count }) => (
                        <div key={module} className="flex items-center justify-between">
                          <span className="text-gray-700">{module}</span>
                          <span className="text-gray-900 font-semibold">{count}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Panel salud consolidada */}
        <div className="bg-white border border-gray-200 rounded-md p-4 md:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Salud consolidada</div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSubsystemHealth}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Reintentar cargar salud de subsistemas"
            >
              Refrescar
            </button>
            <button
              onClick={toggleAutoRefresh}
              className={`px-2 py-1 rounded-md text-xs border ${autoRefresh ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
              title="Alternar auto-actualización"
            >
              Auto {autoRefresh ? 'ON' : 'OFF'}
            </button>
            {TELEMETRY_URL && (
              <>
                <button
                  onClick={sendTelemetryNow}
                  className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs hover:bg-blue-100 border border-blue-200"
                  title="Enviar telemetría ahora"
                >
                  Enviar telemetría
                </button>
                <button
                  onClick={exportTelemetryCsv}
                  className="px-2 py-1 bg-gray-50 text-gray-700 rounded-md text-xs hover:bg-gray-100 border"
                  title="Exportar telemetría a CSV"
                >
                  Exportar CSV
                </button>
              </>
            )}
          </div>
        </div>
        {/* Banner superior contextual por estado backend */}
        {(() => {
          const st = backendStatusVal;
          const show = !!st; // mostrar siempre que tengamos estado
          if (!show) return null;
          const cls = st === 'ok'
            ? 'text-green-900 bg-green-50 border-green-200'
            : st === 'no_health'
            ? 'text-yellow-900 bg-yellow-50 border-yellow-200'
            : 'text-red-900 bg-red-50 border-red-200';
          const label = st === 'ok' ? 'Backend UP' : st === 'no_health' ? 'Backend sin health check' : 'Backend DOWN';
          return (
            <div className={`mb-2 px-3 py-2 rounded border ${cls} text-sm flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{label}</span>
                {apiSourceLabel && (
                  <span className="text-xs text-gray-600">Fuente: {apiSourceLabel}</span>
                )}
                <span className="text-xs text-gray-600">Mocks: {mocksEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-700" title="Simular estado del backend para pruebas">
                  <span>Override:</span>
                  <select
                    className="px-2 py-1 bg-white text-gray-700 rounded-md text-xs border"
                    value={backendOverride ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const ov = v === '' ? null : (v as BackendStatus);
                      setBackendOverride(ov);
                      // Reflejar de inmediato el override en la UI para tests y coherencia
                      if (ov) {
                        try { setBackendStatusVal(ov); } catch {}
                      }
                      try { backendStatus.applyOverride(ov); } catch {}
                    }}
                  >
                    <option value="">Auto</option>
                    <option value="ok">UP</option>
                    <option value="no_health">NO-HEALTH</option>
                    <option value="down">DOWN</option>
                  </select>
                </label>
                <button
                  onClick={loadSubsystemHealth}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Reintentar cargar salud"
                >
                  Reintentar
                </button>
              </div>
            </div>
          );
        })()}
        {apiSourceLabel && (
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
            <span>{apiSourceLabel} · Mocks: {mocksEnabled ? 'ON' : 'OFF'} · Backend:</span>
            {(() => {
              const st = backendStatusVal;
              const cls = st === 'ok'
                ? 'text-green-700 bg-green-50 border-green-200'
                : st === 'no_health'
                ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                : 'text-red-700 bg-red-50 border-red-200';
              const label = st === 'ok' ? 'UP' : st === 'no_health' ? 'NO-HEALTH' : 'DOWN';
              return (
                <span className={`px-2 py-0.5 rounded border ${cls}`}>{label}</span>
              );
            })()}
          </div>
        )}
        <div className="text-xs text-gray-500 mb-1">
          Auto-actualización: {autoRefresh ? `Activa (${Math.round(AUTO_REFRESH_INTERVAL_MS/1000)}s)` : 'Inactiva'}
        </div>
        {cooldownRemainingMs > 0 && (
          <div className="text-xs text-yellow-700 mb-1">Cooldown global: {Math.ceil(cooldownRemainingMs/1000)}s</div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-gray-600" htmlFor="spark-size">Sparkline tamaño</label>
          <select id="spark-size" className="text-xs border rounded px-1 py-0.5" value={sparkSize} onChange={(e) => {
            const v = (e.target.value as 'sm'|'md'|'lg');
            setSparkSize(v);
            try { localStorage.setItem('observability:sparklineSize', v); } catch {}
          }}>
            <option value="sm">Chico</option>
            <option value="md">Medio</option>
            <option value="lg">Grande</option>
          </select>
          <label className="text-xs text-gray-600" htmlFor="spark-window">Ventana puntos</label>
          <select id="spark-window" className="text-xs border rounded px-1 py-0.5" value={sparkWindowPoints ?? ''} onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            setSparkWindowPoints(val);
            try { localStorage.setItem('observability:sparkWindowPoints', val ? String(val) : ''); } catch {}
          }}>
            <option value="">Auto</option>
            <option value="20">20</option>
            <option value="40">40</option>
            <option value="60">60</option>
            <option value="80">80</option>
            <option value="100">100</option>
          </select>
        </div>
        {TELEMETRY_URL && (
          <div className="text-xs text-gray-500 mb-2">Telemetría: cola {telemetryQueueCount} · último envío {telemetryLastSendAt ? new Date(telemetryLastSendAt).toLocaleTimeString() : '-'} · estado {telemetryLastSendStatus || '-'}</div>
        )}
        {subsystemsLastCheck && (
          <div className="text-xs text-gray-500 mb-2">
            Último chequeo: {new Date(subsystemsLastCheck).toLocaleString()}
          </div>
        )}
        {/* Resumen rápido de degradación y presupuesto de error */}
        {(() => {
          const h: any = health || {};
          const degradation = h?.degradation || null;
          const metrics = h?.metrics || null;
          const errorBudget = h?.errorBudget || null;
          const degOk = degradation ? !!degradation.ok : null;
          const causes = Array.isArray(degradation?.causes) ? degradation.causes : [];
          const totals = metrics?.totals || {};
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">Degradación</span>
                  <span className={`px-2 py-1 rounded border ${degOk === null ? 'text-gray-700 bg-gray-50 border-gray-200' : degOk ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>{degOk === null ? 'N/D' : degOk ? 'OK' : 'Degradado'}</span>
                </div>
                {causes.length > 0 ? (
                  <div className="text-xs text-gray-600">Causas: {causes.join(', ')}</div>
                ) : (
                  <div className="text-xs text-gray-500">Sin causas reportadas</div>
                )}
              </div>
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">Presupuesto de error</span>
                  <span className="text-xs text-gray-500">Ventana {errorBudget?.windowHours ?? metrics?.windowHours ?? 24}h</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Errores+Excepciones</span>
                    <span className="font-semibold text-gray-900">{Number(errorBudget?.errorCount ?? (totals.error || 0) + (totals.exception || 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Warnings</span>
                    <span className="font-semibold text-gray-900">{Number(errorBudget?.warningCount ?? (totals.warning || 0))}</span>
                  </div>
                </div>
              </div>
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">Severidades (24h)</span>
                  <button
                    className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                    onClick={() => {
                      try {
                        const data = metrics || {};
                        const payload = JSON.stringify(data, null, 2);
                        const blob = new Blob([payload], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `health-metrics-${Date.now()}.json`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 0);
                      } catch {}
                    }}
                    title="Exportar métricas"
                  >
                    Exportar JSON
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between"><span className="text-gray-600">Info</span><span className="font-semibold text-gray-900">{Number(totals.info || 0)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-600">Warning</span><span className="font-semibold text-gray-900">{Number(totals.warning || 0)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-600">Error</span><span className="font-semibold text-gray-900">{Number(totals.error || 0)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-600">Exception</span><span className="font-semibold text-gray-900">{Number(totals.exception || 0)}</span></div>
                </div>
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            {/* API (latencia) */}
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700" title="Fuente: /health">API</span>
                </div>
                <button
                  className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                  onClick={() => exportHistoryCsv('api', apiLatencyHistory)}
                  title={`Exportar historial (${apiLatencyHistory.length} filas)`}
                >
                  Exportar CSV
                </button>
                {(() => {
                  const last = apiLatencyHistory[0]?.latencyMs;
                  if (typeof last !== 'number') {
                    return <span className="px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200" title="No disponible">No disponible</span>;
                  }
                  const ok = backendStatusVal === 'ok' || backendStatusVal === 'no_health';
                  const crit = ok && last >= LATENCY_CRIT_MS;
                  const degraded = ok && last >= LATENCY_WARN_MS && last < LATENCY_CRIT_MS;
                  const cls = !ok
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : crit
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : degraded
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : 'text-green-700 bg-green-50 border-green-200';
                  const label = !ok ? 'ERROR' : crit ? 'Crítico' : degraded ? 'Degradado' : 'OK';
                  return <span className={`px-2 py-1 rounded border ${cls}`} title={`Latencia API: ${last}ms`}>{label}</span>;
                })()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Latencia API</span>
                  <span className="font-semibold text-gray-900">{Number(apiLatencyHistory[0]?.latencyMs ?? 0)}ms</span>
                </div>
                {apiLatencyHistory.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Tendencia</span>
                    {(() => {
                      const last = Number(apiLatencyHistory[0]?.latencyMs ?? 0);
                      const ok = backendStatusVal === 'ok' || backendStatusVal === 'no_health';
                      const crit = ok && last >= LATENCY_CRIT_MS;
                      const degraded = ok && last >= LATENCY_WARN_MS && last < LATENCY_CRIT_MS;
                      const color = !ok ? '#dc2626' : crit ? '#dc2626' : degraded ? '#d97706' : '#16a34a';
                      const points = sparkPoints;
                      const vals = apiLatencyHistory.slice(0, points).map(h => Number(h.latencyMs ?? 0)).reverse();
                      const lastV = vals.length ? vals[vals.length-1] : 0;
                      const min = vals.length ? Math.min(...vals) : 0;
                      const max = vals.length ? Math.max(...vals) : 0;
                      return (
                        <div title={`Último: ${lastV} · Min: ${min} · Max: ${max}`}>
                          <Sparkline
                            values={vals}
                            width={sparkConf.width}
                            height={sparkConf.height}
                            color={color}
                            className="ml-2"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const s = computeStats(apiLatencyHistory, 'latencyMs');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}ms`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Latencia mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max} ms</span>
                    </div>
                  );
                })()}
                {apiLatencyHistory.length > 1 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Historial reciente</div>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {apiLatencyHistory.slice(0,3).map((h, idx) => (
                        <li key={`api-h-${idx}`}>{new Date(h.timestamp).toLocaleTimeString()} · {Number(h.latencyMs ?? 0)}ms{h.hadError ? ' · error' : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {/* Inventario */}
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700" title="Fuente: /inventory/health">Inventario</span>
                  <label className="text-[11px] text-gray-600">Ventana</label>
                  <select
                    className="text-[11px] border rounded px-1 py-0.5"
                    value={inventoryWindowPoints ?? ''}
                    onChange={(e) => {
                      const n = e.target.value ? Number(e.target.value) : null;
                      setInventoryWindowPoints(n);
                      try { localStorage.setItem('observability:sparkWindowPoints:inventory', n ? String(n) : ''); } catch {}
                    }}
                  >
                    <option value="">Auto</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                    <option value="60">60</option>
                    <option value="80">80</option>
                    <option value="100">100</option>
                  </select>
                </div>
                {(() => {
                  const secs = getCooldownRemainingSec('inventory');
                  return secs > 0 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded border text-yellow-700 bg-yellow-50 border-yellow-200" title="Cooldown activo para inventario">Cooldown: {secs}s</span>
                  ) : null;
                })()}
                <button
                  className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                  onClick={() => exportHistoryCsv('inventario', inventoryHistory)}
                  title={`Exportar historial (${inventoryHistory.length} filas)`}
                >
                  Exportar CSV
                </button>
                {(() => {
                  if (!inventoryHealth) {
                    return <span className="px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200" title="No disponible">No disponible</span>;
                  }
                  const ok = (inventoryHealth?.tablesExist ?? (inventoryHealth?.success !== false)) === true;
                  const latency = Number(inventoryHealth?.latencyMs ?? 0);
                  const crit = ok && latency >= LATENCY_CRIT_MS;
                  const degraded = ok && latency >= LATENCY_WARN_MS && latency < LATENCY_CRIT_MS;
                  const cls = !ok
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : crit
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : degraded
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : 'text-green-700 bg-green-50 border-green-200';
                  const label = !ok ? 'ERROR' : crit ? 'Crítico' : degraded ? 'Degradado' : 'OK';
                  return <span className={`px-2 py-1 rounded border ${cls}`} title={`Tablas: ${String(inventoryHealth?.tablesExist ?? '-')}, Latencia: ${latency}ms`}>{label}</span>;
                })()}
                {(() => {
                  const t = (inventoryHealth?.tables || {}) as any;
                  const hasLedger = typeof t.stock_ledger === 'boolean' ? t.stock_ledger : undefined;
                  const hasIdem = typeof t.idempotency_records === 'boolean' ? t.idempotency_records : undefined;
                  const missing = (hasLedger === false) || (hasIdem === false);
                  if (!missing) return null;
                  const msgs: string[] = [];
                  if (hasLedger === false) msgs.push('Falta tabla stock_ledger');
                  if (hasIdem === false) msgs.push('Falta tabla idempotency_records');
                  const tip = msgs.join(' · ');
                  return (
                    <div className="text-[11px] px-2 py-1 rounded border text-yellow-700 bg-yellow-50 border-yellow-200" title={tip}>
                      {tip}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Latencia DB</span>
                  <span className="font-semibold text-gray-900">{Number(inventoryHealth?.latencyMs ?? 0)}ms</span>
                </div>
                {inventoryHistory.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Tendencia</span>
                    {(() => {
                      const latency = Number(inventoryHealth?.latencyMs ?? 0);
                      const ok = (inventoryHealth?.tablesExist ?? (inventoryHealth?.success !== false)) === true;
                      const crit = ok && latency >= LATENCY_CRIT_MS;
                      const degraded = ok && latency >= LATENCY_WARN_MS && latency < LATENCY_CRIT_MS;
                      const color = !ok ? '#dc2626' : crit ? '#dc2626' : degraded ? '#d97706' : '#16a34a';
                      const points = inventoryWindowPoints ?? sparkPoints;
                      const vals = inventoryHistory.slice(0, points).map(h => Number(h.latencyMs ?? 0)).reverse();
                      const last = vals.length ? vals[vals.length-1] : 0;
                      const min = vals.length ? Math.min(...vals) : 0;
                      const max = vals.length ? Math.max(...vals) : 0;
                      return (
                        <div title={`Último: ${last} · Min: ${min} · Max: ${max}`}>
                          <Sparkline
                            values={vals}
                            width={sparkConf.width}
                            height={sparkConf.height}
                            color={color}
                            className="ml-2"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const s = computeStats(inventoryHistory, 'latencyMs');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}ms`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Latencia mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max} ms</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Movimientos</span>
                  {(() => {
                    const count = Number(inventoryHealth?.ledgerCount ?? 0);
                    const hasWarn = typeof LEDGER_WARN_COUNT === 'number' && !Number.isNaN(LEDGER_WARN_COUNT);
                    const hasCrit = typeof LEDGER_CRIT_COUNT === 'number' && !Number.isNaN(LEDGER_CRIT_COUNT);
                    let cls = 'text-gray-900';
                    let labelTip = '';
                    if (hasCrit && count >= LEDGER_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                    else if (hasWarn && count >= LEDGER_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                    const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    return (
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip} · warn≥${SALES_WARN_COUNT} · crit≥${SALES_CRIT_COUNT}` : `Umbrales · warn≥${SALES_WARN_COUNT} · crit≥${SALES_CRIT_COUNT}`}>
                        {count}
                        {labelTip && (
                          <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>
                        )}
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  const s = computeStats(inventoryHistory, 'ledgerCount');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Movs mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Idempotencia</span>
                  {(() => {
                    const count = Number(inventoryHealth?.idempotencyCount ?? 0);
                    const hasWarn = typeof IDEMPOTENCY_WARN_COUNT === 'number' && !Number.isNaN(IDEMPOTENCY_WARN_COUNT);
                    const hasCrit = typeof IDEMPOTENCY_CRIT_COUNT === 'number' && !Number.isNaN(IDEMPOTENCY_CRIT_COUNT);
                    let cls = 'text-gray-900';
                    let labelTip = '';
                    if (hasCrit && count >= IDEMPOTENCY_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                    else if (hasWarn && count >= IDEMPOTENCY_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                    const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    return (
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip} · warn≥${SALEITEMS_WARN_COUNT} · crit≥${SALEITEMS_CRIT_COUNT}` : `Umbrales · warn≥${SALEITEMS_WARN_COUNT} · crit≥${SALEITEMS_CRIT_COUNT}`}>
                        {count}
                        {labelTip && (
                          <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>
                        )}
                      </span>
                    );
                  })()}
                </div>
                {typeof inventoryMetrics?.last30DaysMovements === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Movimientos 30d</span>
                    <span className="font-semibold text-gray-900">{Number(inventoryMetrics?.last30DaysMovements ?? 0)}</span>
                  </div>
                )}
                {inventoryHistory.length > 1 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Historial reciente</div>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {inventoryHistory.slice(0,3).map((h, idx) => (
                        <li key={`inv-h-${idx}`}>{new Date(h.timestamp).toLocaleTimeString()} · {Number(h.latencyMs ?? 0)}ms · {Number(h.ledgerCount ?? 0)} mov.</li>
                      ))}
                    </ul>
                  </div>
                )}
                {inventoryFailures > 0 && (
                  <div className="text-xs text-yellow-700">Fallos recientes: {inventoryFailures}</div>
                )}
                {inventoryLastError && (
                  <div className="text-xs text-red-700" title="Último fallo al consultar /inventory/health">Último fallo: {inventoryLastError}</div>
                )}
                <button
                  onClick={loadSubsystemHealth}
                  className="mt-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Reintentar salud inventario"
                >
                  Reintentar
                </button>
              </div>
            </div>
            {/* Ventas */}
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700" title="Fuente: /sales/health">Ventas</span>
                  <label className="text-[11px] text-gray-600">Ventana</label>
                  <select
                    className="text-[11px] border rounded px-1 py-0.5"
                    value={salesWindowPoints ?? ''}
                    onChange={(e) => {
                      const n = e.target.value ? Number(e.target.value) : null;
                      setSalesWindowPoints(n);
                      try { localStorage.setItem('observability:sparkWindowPoints:sales', n ? String(n) : ''); } catch {}
                    }}
                  >
                    <option value="">Auto</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                    <option value="60">60</option>
                    <option value="80">80</option>
                    <option value="100">100</option>
                  </select>
                </div>
                {(() => {
                  const secs = getCooldownRemainingSec('sales');
                  return secs > 0 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded border text-yellow-700 bg-yellow-50 border-yellow-200" title="Cooldown activo para ventas">Cooldown: {secs}s</span>
                  ) : null;
                })()}
                <button
                  className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                  onClick={() => exportHistoryCsv('ventas', salesHistory)}
                  title={`Exportar historial (${salesHistory.length} filas)`}
                >
                  Exportar CSV
                </button>
                {(() => {
                  if (!salesHealth) return <span className="px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200" title="No disponible">No disponible</span>;
                  const ok = salesHealth?.status === 'ok';
                  const latency = Number(salesHealth?.dbLatencyMs ?? 0);
                  const crit = ok && latency >= LATENCY_CRIT_MS;
                  const degraded = ok && latency >= LATENCY_WARN_MS && latency < LATENCY_CRIT_MS;
                  const cls = !ok
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : crit
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : degraded
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : 'text-green-700 bg-green-50 border-green-200';
                  const label = !ok ? 'ERROR' : crit ? 'Crítico' : degraded ? 'Degradado' : 'OK';
                  return <span className={`px-2 py-1 rounded border ${cls}`} title={`Estado: ${salesHealth?.status ?? '-'}, Latencia DB: ${latency}ms`}>{label}</span>;
                })()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Latencia DB</span>
                  <span className="font-semibold text-gray-900">{Number(salesHealth?.dbLatencyMs ?? 0)}ms</span>
                </div>
                {salesHistory.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Tendencia</span>
                    {(() => {
                      const latency = Number(salesHealth?.dbLatencyMs ?? 0);
                      const ok = String(salesHealth?.status || '') === 'ok';
                      const crit = ok && latency >= LATENCY_CRIT_MS;
                      const degraded = ok && latency >= LATENCY_WARN_MS && latency < LATENCY_CRIT_MS;
                      const color = !ok ? '#dc2626' : crit ? '#dc2626' : degraded ? '#d97706' : '#16a34a';
                      const points = salesWindowPoints ?? sparkPoints;
                      const vals = salesHistory.slice(0, points).map(h => Number(h.dbLatencyMs ?? 0)).reverse();
                      const last = vals.length ? vals[vals.length-1] : 0;
                      const min = vals.length ? Math.min(...vals) : 0;
                      const max = vals.length ? Math.max(...vals) : 0;
                      return (
                        <div title={`Último: ${last} · Min: ${min} · Max: ${max}`}>
                          <Sparkline
                            values={vals}
                            width={sparkConf.width}
                            height={sparkConf.height}
                            color={color}
                            className="ml-2"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const s = computeStats(salesHistory, 'dbLatencyMs');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}ms`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Latencia mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max} ms</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Ventas</span>
                  {(() => {
                    const count = Number(salesHealth?.salesCount ?? 0);
                    const hasWarn = typeof SALES_WARN_COUNT === 'number' && !Number.isNaN(SALES_WARN_COUNT);
                    const hasCrit = typeof SALES_CRIT_COUNT === 'number' && !Number.isNaN(SALES_CRIT_COUNT);
                    let cls = 'text-gray-900';
                    let labelTip = '';
                    if (hasCrit && count >= SALES_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                    else if (hasWarn && count >= SALES_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                    const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    return (
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip}` : ''}>
                        {count}
                        {labelTip && (
                          <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>
                        )}
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  const s = computeStats(salesHistory, 'salesCount');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Ventas mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Items</span>
                  {(() => {
                    const count = Number(salesHealth?.saleItemsCount ?? 0);
                    const hasWarn = typeof SALEITEMS_WARN_COUNT === 'number' && !Number.isNaN(SALEITEMS_WARN_COUNT);
                    const hasCrit = typeof SALEITEMS_CRIT_COUNT === 'number' && !Number.isNaN(SALEITEMS_CRIT_COUNT);
                    let cls = 'text-gray-900';
                    let labelTip = '';
                    if (hasCrit && count >= SALEITEMS_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                    else if (hasWarn && count >= SALEITEMS_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                    const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    return (
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip}` : ''}>
                        {count}
                        {labelTip && (
                          <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>
                        )}
                      </span>
                    );
                  })()}
                </div>
                {salesHistory.length > 1 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Historial reciente</div>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {salesHistory.slice(0,3).map((h, idx) => (
                        <li key={`sales-h-${idx}`}>{new Date(h.timestamp).toLocaleTimeString()} · {Number(h.dbLatencyMs ?? 0)}ms · {Number(h.salesCount ?? 0)} ventas</li>
                      ))}
                    </ul>
                  </div>
                )}
                {salesFailures > 0 && (
                  <div className="text-xs text-yellow-700">Fallos recientes: {salesFailures}</div>
                )}
                {salesLastError && (
                  <div className="text-xs text-red-700" title="Último fallo al consultar /sales/health">Último fallo: {salesLastError}</div>
                )}
                <button
                  onClick={loadSubsystemHealth}
                  className="mt-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Reintentar salud ventas"
                >
                  Reintentar
                </button>
              </div>
            </div>
            {/* Jobs */}
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                <span className="text-gray-700" title="Fuente: /jobs/health">Jobs</span>
                {(() => {
                  if (!jobsHealth) return null;
                  const qp95 = Number(jobsHealth?.queueAgeMsStats?.p95 ?? 0);
                  const pp95 = Number(jobsHealth?.processingTimeMsStats?.p95 ?? 0);
                  const clsByVal = (val: number, warn?: number, crit?: number) => {
                    if (typeof crit === 'number' && val >= crit) return 'text-red-700 bg-red-50 border-red-200';
                    if (typeof warn === 'number' && val >= warn) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    return 'text-gray-700 bg-gray-50 border-gray-200';
                  };
                  const warnQ = (typeof JOBS_QUEUEAGE_WARN_MS === 'number' && !Number.isNaN(JOBS_QUEUEAGE_WARN_MS)) ? JOBS_QUEUEAGE_WARN_MS : undefined;
                  const critQ = (typeof JOBS_QUEUEAGE_CRIT_MS === 'number' && !Number.isNaN(JOBS_QUEUEAGE_CRIT_MS)) ? JOBS_QUEUEAGE_CRIT_MS : undefined;
                  const warnP = (typeof JOBS_PROCTIME_WARN_MS === 'number' && !Number.isNaN(JOBS_PROCTIME_WARN_MS)) ? JOBS_PROCTIME_WARN_MS : undefined;
                  const critP = (typeof JOBS_PROCTIME_CRIT_MS === 'number' && !Number.isNaN(JOBS_PROCTIME_CRIT_MS)) ? JOBS_PROCTIME_CRIT_MS : undefined;
                  return (
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded border ${clsByVal(qp95, warnQ, critQ)}`} title={`Cola p95: ${qp95}ms · warn≥${warnQ ?? '—'} · crit≥${critQ ?? '—'}`}>Cola p95 {qp95}ms</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border ${clsByVal(pp95, warnP, critP)}`} title={`Proc p95: ${pp95}ms · warn≥${warnP ?? '—'} · crit≥${critP ?? '—'}`}>Proc p95 {pp95}ms</span>
                    </div>
                  );
                })()}
                  <label className="text-[11px] text-gray-600">Ventana</label>
                  <select
                    className="text-[11px] border rounded px-1 py-0.5"
                    value={jobsWindowPoints ?? ''}
                    onChange={(e) => {
                      const n = e.target.value ? Number(e.target.value) : null;
                      setJobsWindowPoints(n);
                      try { localStorage.setItem('observability:sparkWindowPoints:jobs', n ? String(n) : ''); } catch {}
                    }}
                  >
                    <option value="">Auto</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                    <option value="60">60</option>
                    <option value="80">80</option>
                    <option value="100">100</option>
                  </select>
                </div>
                {(() => {
                  const secs = getCooldownRemainingSec('jobs');
                  return secs > 0 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded border text-yellow-700 bg-yellow-50 border-yellow-200" title="Cooldown activo para jobs">Cooldown: {secs}s</span>
                  ) : null;
                })()}
                <button
                  className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                  onClick={() => exportHistoryCsv('jobs', jobsHistoryList)}
                  title={`Exportar historial (${jobsHistoryList.length} filas)`}
                >
                  Exportar CSV
                </button>
                {(() => {
                  if (!jobsHealth) return <span className="px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200" title="No disponible">No disponible</span>;
                  const running = jobsHealth?.running === true;
                  const interval = Number(jobsHealth?.intervalMs ?? 0);
                  const crit = running && interval >= JOBS_INTERVAL_CRIT_MS;
                  const degraded = running && interval >= JOBS_INTERVAL_WARN_MS && interval < JOBS_INTERVAL_CRIT_MS;
                  const cls = !running
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : crit
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : degraded
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : 'text-green-700 bg-green-50 border-green-200';
                  const label = !running ? 'Detenido' : crit ? 'Crítico' : degraded ? 'Degradado' : 'Activo';
                  return <span className={`px-2 py-1 rounded border ${cls}`} title={`Running: ${String(running)}, Intervalo: ${interval}ms`}>{label}</span>;
                })()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Intervalo</span>
                  <span className="font-semibold text-gray-900">{Number(jobsHealth?.intervalMs ?? 0)}ms</span>
                </div>
                {(() => {
                  const pending = Number(jobsHealth?.pendingCount ?? 0);
                  const hasWarn = typeof JOBS_PENDING_WARN_COUNT === 'number' && !Number.isNaN(JOBS_PENDING_WARN_COUNT);
                  const hasCrit = typeof JOBS_PENDING_CRIT_COUNT === 'number' && !Number.isNaN(JOBS_PENDING_CRIT_COUNT);
                  let cls = 'text-gray-900';
                  let labelTip = '';
                  if (hasCrit && pending >= JOBS_PENDING_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                  else if (hasWarn && pending >= JOBS_PENDING_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                  const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Pendientes</span>
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip} · warn≥${JOBS_PENDING_WARN_COUNT} · crit≥${JOBS_PENDING_CRIT_COUNT}` : `Umbrales · warn≥${JOBS_PENDING_WARN_COUNT} · crit≥${JOBS_PENDING_CRIT_COUNT}`}>
                        {pending}
                        {labelTip && (<span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>)}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Procesando</span>
                  <span className="font-semibold text-gray-900">{Number(jobsHealth?.processingCount ?? 0)}</span>
                </div>
                {(() => {
                  const failed = Number(jobsHealth?.failedCount ?? 0);
                  const hasWarn = typeof JOBS_FAILED_WARN_COUNT === 'number' && !Number.isNaN(JOBS_FAILED_WARN_COUNT);
                  const hasCrit = typeof JOBS_FAILED_CRIT_COUNT === 'number' && !Number.isNaN(JOBS_FAILED_CRIT_COUNT);
                  let cls = 'text-gray-900';
                  let labelTip = '';
                  if (hasCrit && failed >= JOBS_FAILED_CRIT_COUNT) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                  else if (hasWarn && failed >= JOBS_FAILED_WARN_COUNT) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                  const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Fallidos</span>
                      <span className={`font-semibold ${cls}`} title={labelTip ? `Estado: ${labelTip} · warn≥${JOBS_FAILED_WARN_COUNT} · crit≥${JOBS_FAILED_CRIT_COUNT}` : `Umbrales · warn≥${JOBS_FAILED_WARN_COUNT} · crit≥${JOBS_FAILED_CRIT_COUNT}`}>
                        {failed}
                        {labelTip && (<span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>)}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const p95 = Number(jobsHealth?.queueAgeMsStats?.p95 ?? 0);
                  const hasWarn = typeof JOBS_QUEUEAGE_WARN_MS === 'number' && !Number.isNaN(JOBS_QUEUEAGE_WARN_MS);
                  const hasCrit = typeof JOBS_QUEUEAGE_CRIT_MS === 'number' && !Number.isNaN(JOBS_QUEUEAGE_CRIT_MS);
                  let cls = 'text-gray-900';
                  let labelTip = '';
                  if (hasCrit && p95 >= JOBS_QUEUEAGE_CRIT_MS) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                  else if (hasWarn && p95 >= JOBS_QUEUEAGE_WARN_MS) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                  const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                  return (
                    <div className="flex items-center justify-between" title={`p95: ${p95}ms · min ${Number(jobsHealth?.queueAgeMsStats?.min ?? 0)} · max ${Number(jobsHealth?.queueAgeMsStats?.max ?? 0)}`}>
                      <span className="text-gray-600">Edad cola (p95)</span>
                      <span className={`font-semibold ${cls}`}>
                        {p95}ms
                        {labelTip && (<span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>)}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const p95 = Number(jobsHealth?.processingTimeMsStats?.p95 ?? 0);
                  const hasWarn = typeof JOBS_PROCTIME_WARN_MS === 'number' && !Number.isNaN(JOBS_PROCTIME_WARN_MS);
                  const hasCrit = typeof JOBS_PROCTIME_CRIT_MS === 'number' && !Number.isNaN(JOBS_PROCTIME_CRIT_MS);
                  let cls = 'text-gray-900';
                  let labelTip = '';
                  if (hasCrit && p95 >= JOBS_PROCTIME_CRIT_MS) { cls = 'text-red-700'; labelTip = 'Crítico'; }
                  else if (hasWarn && p95 >= JOBS_PROCTIME_WARN_MS) { cls = 'text-yellow-700'; labelTip = 'Warn'; }
                  const chipCls = labelTip === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                  return (
                    <div className="flex items-center justify-between" title={`p95: ${p95}ms · min ${Number(jobsHealth?.processingTimeMsStats?.min ?? 0)} · max ${Number(jobsHealth?.processingTimeMsStats?.max ?? 0)}`}>
                      <span className="text-gray-600">Proc. (p95)</span>
                      <span className={`font-semibold ${cls}`}>
                        {p95}ms
                        {labelTip && (<span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{labelTip}</span>)}
                      </span>
                    </div>
                  );
                })()}
                {jobsHistoryList.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Tendencia</span>
                    {(() => {
                      const running = jobsHealth?.running === true;
                      const interval = Number(jobsHealth?.intervalMs ?? 0);
                      const crit = running && interval >= JOBS_INTERVAL_CRIT_MS;
                      const degraded = running && interval >= JOBS_INTERVAL_WARN_MS && interval < JOBS_INTERVAL_CRIT_MS;
                      const color = !running ? '#dc2626' : crit ? '#dc2626' : degraded ? '#d97706' : '#16a34a';
                      const points = jobsWindowPoints ?? sparkPoints;
                      const vals = jobsHistoryList.slice(0, points).map(h => Number(h.intervalMs ?? 0)).reverse();
                      const last = vals.length ? vals[vals.length-1] : 0;
                      const min = vals.length ? Math.min(...vals) : 0;
                      const max = vals.length ? Math.max(...vals) : 0;
                      return (
                        <div title={`Último: ${last} · Min: ${min} · Max: ${max}`}>
                          <Sparkline
                            values={vals}
                            width={sparkConf.width}
                            height={sparkConf.height}
                            color={color}
                            className="ml-2"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const s = computeStats(jobsHistoryList, 'intervalMs');
                  if (!s) return null;
                  const trendLabel = `${s.trend > 0 ? '+' : ''}${s.trend}ms`;
                  return (
                    <div className="flex items-center justify-between" title={`mín ${s.min} · máx ${s.max} · tendencia ${trendLabel}`}>
                      <span className="text-gray-600">Intervalo mín/máx</span>
                      <span className="font-semibold text-gray-900">{s.min} / {s.max} ms</span>
                    </div>
                  );
                })()}
                {jobsHistoryList.length > 1 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Historial reciente</div>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {jobsHistoryList.slice(0,3).map((h, idx) => (
                        <li key={`jobs-h-${idx}`}>{new Date(h.timestamp).toLocaleTimeString()} · {(h.running ? 'Activo' : 'Detenido')} · {Number(h.intervalMs ?? 0)}ms</li>
                      ))}
                    </ul>
                  </div>
                )}
                {jobsFailures > 0 && (
                  <div className="text-xs text-yellow-700">Fallos recientes: {jobsFailures}</div>
                )}
                {jobsLastError && (
                  <div className="text-xs text-red-700" title="Último fallo al consultar /jobs/health">Último fallo: {jobsLastError}</div>
                )}
                <button
                  onClick={loadSubsystemHealth}
                  className="mt-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                  title="Reintentar salud jobs"
                >
                  Reintentar
                </button>
              </div>
            </div>
            {/* Offline */}
            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700" title="Fuente: /offline/status">Offline</span>
                {offlineStatus ? (
                  (() => {
                    const online = offlineStatus?.status === 'online';
                    const storageOk = !!offlineStatus?.storage?.available;
                    const backupsEnabled = !!offlineStatus?.backups?.enabled;
                    const degraded = online && (!storageOk || !backupsEnabled);
                    const cls = online
                      ? (degraded ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-green-700 bg-green-50 border-green-200')
                      : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                    const label = online ? (degraded ? 'Online (alerta)' : 'Online') : 'Offline';
                    const tip = `Online: ${String(online)}, Storage: ${String(storageOk)}, Backups: ${String(backupsEnabled)}`;
                    return <span className={`px-2 py-1 rounded border ${cls}`} title={tip}>{label}</span>;
                  })()
                ) : (
                  <span className="px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200">No disponible</span>
                )}
              </div>
                {offlineStatus && (
                  <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Almacenamiento</span>
                    <span className={`px-2 py-1 rounded border ${((offlineStatus?.storage?.available) ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200')}`}>{(offlineStatus?.storage?.available) ? 'OK' : 'ERROR'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Respaldos</span>
                    <span className={`px-2 py-1 rounded border ${((offlineStatus?.backups?.enabled) ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200')}`}>{(offlineStatus?.backups?.enabled) ? 'Habilitado' : 'Deshabilitado'}</span>
                  </div>
                  {offlineHistory.length > 1 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Historial reciente</div>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {offlineHistory.slice(0,3).map((h, idx) => (
                          <li key={`off-h-${idx}`}>{new Date(h.timestamp).toLocaleTimeString()} · {(h.status ?? 'offline')} · {(h.storage?.available ? 'almacenamiento OK' : 'almacenamiento ERROR')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {offlineFailures > 0 && (
                    <div className="text-xs text-yellow-700">Fallos recientes: {offlineFailures}</div>
                  )}
                  {offlineLastError && (
                    <div className="text-xs text-red-700" title="Último fallo al consultar /offline/status">Último fallo: {offlineLastError}</div>
                  )}
                  <button
                    onClick={loadSubsystemHealth}
                    className="mt-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                    title="Reintentar salud offline"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4" data-testid="section-files-verification">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-700">Verificación de archivos</div>
              <button
                onClick={scanFilesIntegrity}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs hover:bg-blue-200 border border-blue-200"
                title="Ejecutar escaneo de integridad"
                data-testid="btn-scan-integrity"
              >
                Escanear ahora
              </button>
            </div>
            <button
              onClick={loadVerificationSummary}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Actualizar estado"
              data-testid="btn-refresh-verif-summary"
            >
              Actualizar
            </button>
          </div>
          {verifLoading && <div className="text-xs text-gray-500">Cargando...</div>}
          {!verifLoading && verifError && (
            <div className="flex items-center gap-3">
              <div className="text-xs text-red-600">{verifError}</div>
              <button
                onClick={loadVerificationSummary}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
                title="Reintentar cargar resumen"
              >
                Reintentar
              </button>
            </div>
          )}
          {!verifLoading && !verifError && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado</span>
                {(() => {
                  const c = verifSummary?.counts || {};
                  const ok = Number(c.mismatch || 0) === 0 && Number(c.missing || 0) === 0 && Number(c.error || 0) === 0;
                  const cls = ok ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200';
                  const label = ok ? 'OK' : 'ALERT';
                  return <span className={`font-semibold px-2 py-1 rounded border ${cls}`}>{label}</span>;
                })()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.counts?.total ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Coincidencias</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.counts?.match ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Discrepancias</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.counts?.mismatch ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Perdidos</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.counts?.missing ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Errores</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.counts?.error ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tiempo</span>
                  <span className="font-semibold text-gray-900">{Number(verifSummary?.durationMs ?? 0)} ms</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Última ejecución</span>
                <span className="font-mono text-gray-900 text-xs">{String(verifSummary?.timestamp || '')}</span>
              </div>
              {(() => {
                const problems = Number(verifSummary?.counts?.mismatch || 0) + Number(verifSummary?.counts?.missing || 0) + Number(verifSummary?.counts?.error || 0);
                return (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={downloadIntegrityCsv}
                      className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-700 hover:bg-gray-200"
                      title={backendStatusVal !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Descargar reporte CSV'}
                      disabled={backendStatusVal !== 'ok'}
                      data-testid="btn-download-integrity-csv"
                    >
                      Descargar CSV
                    </button>
                    <button
                      onClick={downloadIntegrityPdf}
                      className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-700 hover:bg-gray-200"
                      title={backendStatusVal !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Descargar reporte PDF'}
                      disabled={backendStatusVal !== 'ok'}
                      data-testid="btn-download-integrity-pdf"
                    >
                      Descargar PDF
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      <input
                        type="text"
                        className="text-xs px-2 py-1 border rounded w-40"
                        placeholder="ID de archivo"
                        value={fileIdInput}
                        onChange={(e) => setFileIdInput(e.target.value)}
                        data-testid="input-file-id"
                      />
                      <button
                        onClick={handleVerifiedDownload}
                        className="text-xs px-2 py-1 rounded border bg-green-100 text-green-700 hover:bg-green-200"
                        title={backendStatusVal !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Descargar verificado'}
                        disabled={backendStatusVal !== 'ok' || !fileIdInput.trim() || verifiedInfo.status === 'downloading'}
                        data-testid="btn-download-verified"
                      >
                        {verifiedInfo.status === 'downloading' ? 'Descargando...' : 'Descargar verificado'}
                      </button>
                    </div>
                    {verifiedInfo.status === 'done' && (
                      <span className={`text-[11px] px-2 py-1 rounded border ${verifiedInfo.match ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}
                        title={`expected=${verifiedInfo.expected || '-'} actual=${verifiedInfo.actual || '-'}`}
                      >
                        Integridad: {verifiedInfo.match ? 'OK' : 'NO coincide'}
                      </span>
                    )}
                    {verifiedInfo.status === 'error' && (
                      <span className="text-[11px] text-red-700" title="Error en descarga verificada">{verifiedInfo.message}</span>
                    )}
                    {problems > 0 && (
                      <span className="text-[11px] text-red-700" title="Cantidad de discrepancias detectadas">{`Discrepancias: ${problems}`}</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-700">Filtros de eventos</div>
            {eventActiveFiltersCount > 0 && (
              <span className="text-xs px-2 py-1 rounded border text-blue-700 bg-blue-50 border-blue-200" title={eventFiltersTooltip}>{`Filtros activos: ${eventActiveFiltersCount}`}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                try {
                  setTypeFilter('');
                  setSeverityFilter('');
                  setLimit(20);
                  setPage(1);
                  setSearch('');
                  setFrom('');
                  setTo('');
                  setWindowHours(24);
                } catch {}
              }}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Restablecer filtros de eventos y rango de tiempo"
            >
              Limpiar filtros
            </button>
            <button
              onClick={() => {
                setFiltersCollapsed(prev => {
                  const next = !prev;
                  try { localStorage.setItem('observability:eventFiltersCollapsed', next ? '1' : '0'); } catch {}
                  return next;
                });
              }}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Ocultar/mostrar filtros"
            >
              {filtersCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
            </button>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-600">Preset</span>
              {[1,12,24].map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    const now = new Date();
                    const fromDate = new Date(now.getTime() - h * 3600 * 1000);
                    setFrom(fromDate.toISOString());
                    setTo(now.toISOString());
                    setWindowHours(h);
                  }}
                  className="px-2 py-1 bg-gray-50 text-gray-700 rounded-md text-xs hover:bg-gray-100 border"
                  title={`Ventana ${h}h`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-7 gap-3 ${filtersCollapsed ? 'hidden' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <input
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              placeholder="p.ej. HEALTH_CHECK, RATE_LIMIT"
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Severidad</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter((e.target.value as EventSeverity | ''))}
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="exception">Exception</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Límite</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="texto en mensaje, tipo o contexto"
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Página</label>
            <div className="mt-1 flex items-center gap-2">
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={(pagination?.page || page) <= 1}
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700">{pagination?.page ?? page}</span>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage((p) => (pagination?.totalPages ? Math.min(p + 1, pagination.totalPages) : p + 1))}
                disabled={!!pagination?.totalPages && (pagination?.page ?? page) >= (pagination?.totalPages || 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ventana (horas)</label>
            <select
              value={windowHours}
              onChange={(e) => setWindowHours(parseInt(e.target.value) || 24)}
              className="mt-1 w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              {[1, 6, 12, 24, 48, 168].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Usado si no se establece Desde/Hasta</p>
          </div>
        </div>
      </div>

      {/* Métricas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Por severidad</div>
          <div className="space-y-2">
            {(['info','warning','error','exception'] as EventSeverity[]).map((sev) => (
              <button
                key={sev}
                onClick={() => {
                  setSeverityFilter(sev);
                  setPage(1);
                }}
                className="w-full flex items-center justify-between px-2 py-1 rounded border text-gray-700 bg-gray-50 hover:bg-gray-100"
                title={`Filtrar por severidad: ${sev}`}
              >
                <span className="text-gray-600 capitalize">{sev}</span>
                <span className="font-semibold text-gray-900">{countsBySeverity?.[sev] || 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Por tipo</div>
          <div className="space-y-2">
            {countsByTypeList.length === 0 && (
              <div className="text-gray-500 text-sm">Sin datos</div>
            )}
            {countsByTypeList.map(({ type, count }) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                className="w-full flex items-center justify-between px-2 py-1 rounded border text-gray-700 bg-gray-50 hover:bg-gray-100"
                title={`Filtrar por tipo: ${type}`}
              >
                <span className="text-gray-600">{type}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Último error</div>
          {latestError ? (
            <div className={`border rounded-md p-3 text-sm ${severityColors['error']}`}>
              <div className="font-semibold">{latestError.type}</div>
              <div className="text-gray-700 break-words">{latestError.message || '(sin mensaje)'}</div>
              <div className="text-gray-500 mt-1">{latestError.createdAt ? new Date(latestError.createdAt).toLocaleString() : ''}</div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No hay errores recientes</div>
          )}
        </div>
      </div>

      {/* Tabla de eventos */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-700">Eventos recientes</div>
            {eventActiveFiltersCount > 0 && (
              <span className="text-xs px-2 py-1 rounded border text-blue-700 bg-blue-50 border-blue-200" title={eventFiltersTooltip}>{`Filtros activos: ${eventActiveFiltersCount}`}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                try {
                  setTypeFilter('');
                  setSeverityFilter('');
                  setLimit(20);
                  setPage(1);
                  setSearch('');
                  setFrom('');
                  setTo('');
                  setWindowHours(24);
                } catch {}
              }}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Restablecer filtros de eventos"
            >
              Limpiar filtros
            </button>
            <label className="flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
              />
              Incluir detalles
            </label>
            <button
              onClick={() => {
                try {
                  const headers = includeDetails
                    ? ['id','createdAt','type','severity','message','context','userId','details']
                    : ['id','createdAt','type','severity','message','context','userId'];
                  const rows = events.map(ev => {
                    const ctx = typeof ev.context === 'string' ? ev.context : ev.context ? JSON.stringify(ev.context) : '';
                    const base = [ev.id ?? '', ev.createdAt ?? '', ev.type ?? '', ev.severity ?? '', (ev.message ?? '').replace(/\n/g,' '), ctx.replace(/\n/g,' '), ev.userId ?? ''];
                    if (includeDetails) {
                      const details = JSON.stringify((ev as any)?.details ?? {});
                      base.push(details.replace(/\n/g,' '));
                    }
                    return base;
                  });
                  const csv = [headers.join(','), ...rows.map(r => r.map(v => {
                    const s = String(v ?? '');
                    const needsQuote = /[",\n]/.test(s);
                    return needsQuote ? '"' + s.replace(/"/g, '""') + '"' : s;
                  }).join(','))].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `events_${new Date().toISOString().slice(0,19)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('CSV export error', err);
                }
              }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 border"
            >
              Exportar CSV
            </button>
            {loading && <LoadingSpinner size="sm" />}
          </div>
        </div>
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
        )}
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severidad</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mensaje</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contexto</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm text-gray-500">Sin eventos</td>
                </tr>
              )}
              {events.map((ev) => {
                const sev: EventSeverity = (ev.severity || 'info') as EventSeverity;
                const ctxText = typeof ev.context === 'string'
                  ? ev.context
                  : ev.context
                  ? JSON.stringify(ev.context)
                  : '';
                const rowKey = String(ev.id) + String(ev.createdAt);
                const isExpanded = !!expandedRows[rowKey];
                return (
                  <React.Fragment key={rowKey}>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{ev.type}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-block px-2 py-1 rounded border ${severityColors[sev]}`}>{sev}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 break-words">{ev.message || ''}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 break-words max-w-[24rem]">{ctxText}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        <button
                          onClick={() => setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border rounded"
                        >
                          {isExpanded ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-4 py-2 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <div className="text-gray-500">Usuario</div>
                              <div className="text-gray-900 font-mono">{String(ev.userId ?? '')}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Contexto</div>
                              <div className="text-gray-900 break-words font-mono">{ctxText || '(vacío)'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Origen</div>
                              <div className="text-gray-900 break-words font-mono">{String((ev as any)?.source ?? '')}</div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-gray-500 text-xs mb-1">Detalles</div>
                            <pre className="text-[11px] leading-[1.2rem] p-2 bg-white border rounded overflow-auto max-h-64">
{JSON.stringify((ev as any)?.details ?? {}, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latencias por ruta */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-700">Latencia por ruta</div>
            {latencyActiveFiltersCount > 0 && (
              <span className="text-xs px-2 py-1 rounded border text-blue-700 bg-blue-50 border-blue-200" title={latencyFiltersTooltip}>{`Filtros activos: ${latencyActiveFiltersCount}`}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                try {
                  setLatencyMethodFilter('');
                  setLatRouteFilter('');
                  setLatencySortKey('p95Ms');
                  setLatencySortDir('desc');
                  setLatLimit(10);
                  setLatPage(1);
                } catch {}
              }}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              title="Restablecer filtros y paginación de latencias"
            >
              Limpiar filtros
            </button>
            <label className="text-xs text-gray-600">Método</label>
            <select
              value={latencyMethodFilter}
              onChange={(e) => setLatencyMethodFilter(e.target.value)}
              className="text-sm rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {latencyMethods.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Buscar ruta</label>
              <input
                value={latRouteFilter}
                onChange={(e) => setLatRouteFilter(e.target.value)}
                placeholder="/api, /ventas, etc."
                className="text-sm rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Límite</label>
              <select
                value={latLimit}
                onChange={(e) => setLatLimit(parseInt(e.target.value) || 10)}
                className="text-sm rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Página</label>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50 text-xs"
                onClick={() => setLatPage((p) => Math.max(1, p - 1))}
                disabled={latPage <= 1}
              >
                ◀
              </button>
              <span className="text-xs text-gray-700">{latPage}/{latTotalPages}</span>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50 text-xs"
                onClick={() => setLatPage((p) => Math.min(latTotalPages, p + 1))}
                disabled={latPage >= latTotalPages}
              >
                ▶
              </button>
              <button
                onClick={() => {
                  try {
                    const headers = ['url','method','count','avgMs','p50Ms','p95Ms','p99Ms'];
                    const rows = (latencyRows || []).map((r: any) => [
                      String(r.url || ''),
                      String(r.method || ''),
                      String(r.count ?? ''),
                      String(r.avgMs ?? ''),
                      String(r.p50Ms ?? ''),
                      String(r.p95Ms ?? ''),
                      String(r.p99Ms ?? ''),
                    ]);
                    const csv = [headers.join(','), ...rows.map(r => r.map(v => {
                      const s = String(v ?? '');
                      const needsQuote = /[",\n]/.test(s);
                      return needsQuote ? '"' + s.replace(/"/g, '""') + '"' : s;
                    }).join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `latency_${new Date().toISOString().slice(0,19)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('CSV export error (latency)', err);
                  }
                }}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 border"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perfil</th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => setLatencySortKey((k) => (k === 'count' ? (latencySortDir === 'asc' ? setLatencySortDir('desc') : setLatencySortDir('asc'), 'count') : (setLatencySortDir(k === latencySortKey && latencySortDir === 'desc' ? 'asc' : 'desc'), 'count')))}
                >
                  Requests {latencySortKey === 'count' ? (latencySortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => { setLatencySortKey('avgMs'); setLatencySortDir(latencySortKey === 'avgMs' && latencySortDir === 'desc' ? 'asc' : 'desc'); }}
                >
                  Avg (ms) {latencySortKey === 'avgMs' ? (latencySortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => { setLatencySortKey('p50Ms'); setLatencySortDir(latencySortKey === 'p50Ms' && latencySortDir === 'desc' ? 'asc' : 'desc'); }}
                >
                  p50 (ms) {latencySortKey === 'p50Ms' ? (latencySortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => { setLatencySortKey('p95Ms'); setLatencySortDir(latencySortKey === 'p95Ms' && latencySortDir === 'desc' ? 'asc' : 'desc'); }}
                >
                  p95 (ms) {latencySortKey === 'p95Ms' ? (latencySortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => { setLatencySortKey('p99Ms'); setLatencySortDir(latencySortKey === 'p99Ms' && latencySortDir === 'desc' ? 'asc' : 'desc'); }}
                >
                  p99 (ms) {latencySortKey === 'p99Ms' ? (latencySortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {latencyRows?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-sm text-gray-500">Sin datos</td>
                </tr>
              )}
              {latPageRows?.map((row: any) => (
                <tr key={`${row.method || ''} ${row.url}`}>
                  <td className="px-4 py-2 text-sm text-gray-700 break-words">{row.url}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.method || ''}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <div
                      className="w-24"
                      title={`p50: ${row.p50Ms ?? '-'}ms | p95: ${row.p95Ms ?? '-'}ms | p99: ${row.p99Ms ?? '-'}ms`}
                    >
                      <div className="h-2 bg-blue-200" style={{ width: `${Math.min(100, Math.round((((row.p50Ms || 0) / Math.max(1, (latPageRows || []).reduce((m: number, r: any) => Math.max(m, r?.p99Ms || r?.p95Ms || r?.avgMs || 0), 0))) * 100)))}%` }} />
                      <div className="h-2 bg-yellow-200 mt-0.5" style={{ width: `${Math.min(100, Math.round((((row.p95Ms || 0) / Math.max(1, (latPageRows || []).reduce((m: number, r: any) => Math.max(m, r?.p99Ms || r?.p95Ms || r?.avgMs || 0), 0))) * 100)))}%` }} />
                      <div className="h-2 bg-red-300 mt-0.5" style={{ width: `${Math.min(100, Math.round((((row.p99Ms || 0) / Math.max(1, (latPageRows || []).reduce((m: number, r: any) => Math.max(m, r?.p99Ms || r?.p95Ms || r?.avgMs || 0), 0))) * 100)))}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.count}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.avgMs}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.p50Ms ?? ''}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.p95Ms}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{row.p99Ms ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ObservabilityPage;
