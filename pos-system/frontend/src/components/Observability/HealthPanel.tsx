import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHealth, fetchHealthMetrics, HealthPayload, HealthMetricsPayload } from "../../services/healthService";
import { fetchJobsHealth } from "../../services/jobsService";
import { api, initializeApiBaseUrl } from "../../lib/api";
import HealthStatus from "../Common/HealthStatus";
import ObservabilityChip from "../Common/ObservabilityChip";

function formatUptime(uptimeSec: number): string {
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default function HealthPanel() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [metrics, setMetrics] = useState<HealthMetricsPayload | null>(null);
  const [metricsWindowHours, setMetricsWindowHours] = useState<number>(() => {
    try { const v = localStorage.getItem('health:metricsWindowHours'); return v ? Number(v) : 24; } catch { return 24; }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    try { return localStorage.getItem('health:autoRefreshEnabled') !== '0'; } catch { return true; }
  });
  const [baseIntervalMs, setBaseIntervalMs] = useState<number>(() => {
    try { const v = localStorage.getItem('health:autoRefreshBaseMs'); return v ? Number(v) : 15000; } catch { return 15000; }
  });
  const [backoffMs, setBackoffMs] = useState<number>(15000); // base 15s, máx 5min
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [jobsHealth, setJobsHealth] = useState<any | null>(null);
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trends, setTrends] = useState<Record<string, number[]>>({});
  const [apiPingMs, setApiPingMs] = useState<number | null>(null);
  const [frontendEnvReport, setFrontendEnvReport] = useState<{ keys: Record<string, any>; baseURL: string; warnings: string[] }>({ keys: {}, baseURL: '', warnings: [] });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const HIST_API_KEY = 'observability:apiLatencyHistory';
  const HIST_DB_KEY = 'observability:dbLatencyHistory';

  type HistPoint = { ts: number; value: number };
  const readHist = (key: string): HistPoint[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((p: any) => p && typeof p.ts === 'number' && typeof p.value === 'number');
    } catch { return []; }
  };
  const writeHist = (key: string, point: HistPoint, maxPoints = 200) => {
    try {
      const arr = readHist(key);
      arr.push(point);
      while (arr.length > maxPoints) arr.shift();
      localStorage.setItem(key, JSON.stringify(arr));
    } catch { /* noop */ }
  };
  const summarizeHist = (arr: HistPoint[], windowMs = 24 * 60 * 60 * 1000) => {
    const now = Date.now();
    const recent = arr.filter(p => (now - p.ts) <= windowMs).map(p => p.value);
    if (!recent.length) return null as any;
    const sorted = [...recent].sort((a,b) => a-b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(sorted.reduce((s,v) => s+v, 0) / sorted.length);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    return { min, avg, p95, max, count: sorted.length };
  };

  const MAX_TREND_POINTS = 20;
  const updateTrends = (jh: any, extras?: { salesToday?: number; itemsToday?: number; dbLatencyMs?: number; apiPingMs?: number }) => {
    const updates: Record<string, number | undefined> = {
      intervalMs: Number(jh?.intervalMs),
      processingCount: Number(jh?.processingCount),
      pendingCount: Number(jh?.pendingCount),
      failedCount: Number(jh?.failedCount),
      queueP95: Number(jh?.queueAgeMsStats?.p95),
      procP95: Number(jh?.processingTimeMsStats?.p95),
      salesToday: extras?.salesToday,
      itemsToday: extras?.itemsToday,
      dbLatencyMs: extras?.dbLatencyMs,
      apiPingMs: extras?.apiPingMs,
    };
    setTrends((prev) => {
      const next: Record<string, number[]> = { ...prev };
      Object.entries(updates).forEach(([k, v]) => {
        if (v === undefined || !Number.isFinite(v)) return;
        const arr = next[k] ? next[k].slice() : [];
        arr.push(Number(v));
        if (arr.length > MAX_TREND_POINTS) arr.shift();
        next[k] = arr;
      });
      return next;
    });
  };

  function MiniTrend({ values, width = 48, height = 14, color = "#64748b", title }: { values: number[]; width?: number; height?: number; color?: string; title?: string }) {
    if (!values || values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / Math.max(values.length - 1, 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const lastY = height - ((values[values.length - 1] - min) / range) * height;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block align-middle" aria-label={title}>
        <polyline fill="none" stroke={color} strokeWidth="1" points={points} />
        <circle cx={width} cy={lastY} r="1.5" fill={color} />
      </svg>
    );
  }

  const refreshAll = useCallback(async () => {
    try {
      setRefreshing(true);
      const t0Ping = performance.now();
      let pingMs: number | null = null;
      try {
    await api.get('/health', { __suppressGlobalError: true } as any);
        pingMs = Math.round(performance.now() - t0Ping);
      } catch {
        pingMs = Math.round(performance.now() - t0Ping);
      }
      setApiPingMs(pingMs);
      writeHist(HIST_API_KEY, { ts: Date.now(), value: Number(pingMs || 0) });

      const [h, m, jh, dash] = await Promise.all([
        fetchHealth(),
        fetchHealthMetrics(metricsWindowHours),
        (async () => {
          try { return await fetchJobsHealth(); }
          catch { return { running: undefined, intervalMs: undefined }; }
        })(),
        (async () => {
          try {
            const resp = await api.get('/reports/dashboard', { params: { period: 'today' } } as any);
            return resp?.data || {};
          } catch {
            return {};
          }
        })()
      ]);
      setHealth(h);
      setMetrics(m);
      setJobsHealth(jh || null);
      const dbLatMs = Number((h as any)?.db?.latencyMs ?? (h as any)?.db?.latency);
      if (Number.isFinite(dbLatMs)) writeHist(HIST_DB_KEY, { ts: Date.now(), value: dbLatMs });
      // Derivar conteos de ventas/items del día desde dashboard
      try {
        const recentSalesArr = Array.isArray(dash?.data?.recentSales) ? dash.data.recentSales : (Array.isArray(dash?.recentSales) ? dash.recentSales : []);
        const today = new Date();
        const todayStr = today.toDateString();
        const todaySalesArr = recentSalesArr.filter((sale: any) => {
          const saleDate = new Date(sale?.date || sale?.createdAt);
          return saleDate.toDateString() === todayStr;
        });
        const computedTodaySales = Number(dash?.data?.todaySales ?? dash?.todaySales ?? todaySalesArr.length);
        const computedTodayItems = todaySalesArr.reduce((acc: number, s: any) => acc + Number(Array.isArray(s?.items) ? s.items.length : (s?.items ?? 0)), 0);
        const salesCount = Number.isFinite(computedTodaySales) ? computedTodaySales : 0;
        const itemsCount = Number.isFinite(computedTodayItems) ? computedTodayItems : 0;
        setTodaySalesCount(salesCount);
        setTodayItemsCount(itemsCount);
        updateTrends(jh, { salesToday: salesCount, itemsToday: itemsCount, dbLatencyMs: Number.isFinite(dbLatMs) ? dbLatMs : undefined, apiPingMs: Number.isFinite(pingMs || NaN) ? (pingMs as number) : undefined });
      } catch {
        updateTrends(jh, { dbLatencyMs: Number.isFinite(dbLatMs) ? dbLatMs : undefined, apiPingMs: Number.isFinite(pingMs || NaN) ? (pingMs as number) : undefined });
      }
      // Construir reporte de .env frontend
      try {
        const env = (import.meta as any).env || {};
        const warnings: string[] = [];
        const isProd = !!env.PROD;
        const useMocks = String(env.VITE_USE_MOCKS || '').toLowerCase() === 'true';
        const apiUrlEnv = env.VITE_API_URL || '';
        const baseURL = String((api as any)?.defaults?.baseURL || '');
        if (isProd && useMocks) warnings.push('VITE_USE_MOCKS=true en producción');
        if (isProd && !apiUrlEnv) warnings.push('VITE_API_URL no definido en producción');
        setFrontendEnvReport({
          keys: {
            VITE_API_URL: apiUrlEnv || null,
            VITE_USE_MOCKS: useMocks,
            VITE_APP_VERSION: env.VITE_APP_VERSION || null,
            VITE_RAYGUN_API_KEY: env.VITE_RAYGUN_API_KEY ? '***' : null,
            PROD: isProd,
          },
          baseURL,
          warnings,
        });
      } catch {}
    } finally {
      setRefreshing(false);
    }
  }, [metricsWindowHours]);

  const getThresholdVal = (key: string): number | undefined => {
    const local = localStorage.getItem(key);
    if (local !== null) {
      const n = Number(local);
      return Number.isFinite(n) ? n : undefined;
    }
    const envKey = `VITE_${key}`;
    const envVal = (import.meta as any).env?.[envKey];
    const n = Number(envVal);
    return Number.isFinite(n) ? n : undefined;
  };

  const setThresholdVal = (key: string, value: string) => {
    if (value === '') {
      localStorage.removeItem(key);
    } else {
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      localStorage.setItem(key, String(n));
    }
  };

  // Presets de umbrales locales
  const [presetName, setPresetName] = useState<string>('');
  const [presetNames, setPresetNames] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('observability:thresholdPreset:names') || '[]') || []; } catch { return []; }
  });

  const readCurrentOverrides = (): Record<string, number> => {
    const map: Record<string, number> = {};
    thresholdKeys.forEach(k => {
      [k.warnKey, k.critKey].forEach(key => {
        const v = localStorage.getItem(key);
        if (v !== null) {
          const n = Number(v);
          if (Number.isFinite(n)) map[key] = n;
        }
      });
    });
    return map;
  };

  const persistPresetNames = (names: string[]) => {
    setPresetNames(names);
    try { localStorage.setItem('observability:thresholdPreset:names', JSON.stringify(names)); } catch {}
  };

  const savePreset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const overrides = readCurrentOverrides();
    try {
      localStorage.setItem(`observability:thresholdPreset:${trimmed}`, JSON.stringify(overrides));
      const names = Array.from(new Set([...(presetNames || []), trimmed]));
      persistPresetNames(names);
    } catch {}
  };

  const loadPreset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const raw = localStorage.getItem(`observability:thresholdPreset:${trimmed}`);
      if (!raw) return;
      const obj = JSON.parse(raw);
      Object.entries(obj || {}).forEach(([key, val]) => {
        const n = Number(val);
        if (Number.isFinite(n)) localStorage.setItem(key, String(n));
      });
      refreshAll();
    } catch {}
  };

  const deletePreset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      localStorage.removeItem(`observability:thresholdPreset:${trimmed}`);
      const names = (presetNames || []).filter(n => n !== trimmed);
      persistPresetNames(names);
    } catch {}
  };

  const thresholdKeys = [
    { label: 'Intervalo', warnKey: 'JOBS_INTERVAL_WARN_MS', critKey: 'JOBS_INTERVAL_CRIT_MS', unit: 'ms' },
    { label: 'Procesando', warnKey: 'JOBS_PROCESSING_WARN_COUNT', critKey: 'JOBS_PROCESSING_CRIT_COUNT' },
    { label: 'Pendientes', warnKey: 'JOBS_PENDING_WARN_COUNT', critKey: 'JOBS_PENDING_CRIT_COUNT' },
    { label: 'Fallidos', warnKey: 'JOBS_FAILED_WARN_COUNT', critKey: 'JOBS_FAILED_CRIT_COUNT' },
    { label: 'Cola p95', warnKey: 'JOBS_QUEUEAGE_WARN_MS', critKey: 'JOBS_QUEUEAGE_CRIT_MS', unit: 'ms' },
    { label: 'Proc p95', warnKey: 'JOBS_PROCTIME_WARN_MS', critKey: 'JOBS_PROCTIME_CRIT_MS', unit: 'ms' },
    { label: 'Ventas (hoy)', warnKey: 'SALES_WARN_COUNT', critKey: 'SALES_CRIT_COUNT' },
    { label: 'Items (hoy)', warnKey: 'SALEITEMS_WARN_COUNT', critKey: 'SALEITEMS_CRIT_COUNT' },
    { label: 'DB latencia', warnKey: 'DB_LATENCY_WARN_MS', critKey: 'DB_LATENCY_CRIT_MS', unit: 'ms' },
    { label: 'API ping', warnKey: 'API_PING_WARN_MS', critKey: 'API_PING_CRIT_MS', unit: 'ms' },
  ];
  const [todaySalesCount, setTodaySalesCount] = useState<number>(0);
  const [todayItemsCount, setTodayItemsCount] = useState<number>(0);

  const load = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Asegurar baseURL y cargar salud, métricas con ventana, jobs y dashboard
      await initializeApiBaseUrl();
      const t0Ping = performance.now();
      let pingMs: number | null = null;
      try {
    await api.get('/health', { __suppressGlobalError: true } as any);
        pingMs = Math.round(performance.now() - t0Ping);
      } catch {
        pingMs = Math.round(performance.now() - t0Ping);
      }
      setApiPingMs(pingMs);
      writeHist(HIST_API_KEY, { ts: Date.now(), value: Number(pingMs || 0) });
      const [h, m, jh] = await Promise.all([
        fetchHealth(),
        fetchHealthMetrics(metricsWindowHours),
        (async () => { try { return await fetchJobsHealth(); } catch { return { running: undefined, intervalMs: undefined }; } })()
      ]);
      setHealth(h);
      setMetrics(m);
      // Conservar todos los campos expuestos por /jobs/health (pendientes/fallidos, stats p95)
      setJobsHealth(jh || null);
      const dbLatMs = Number((h as any)?.db?.latencyMs ?? (h as any)?.db?.latency);
      if (Number.isFinite(dbLatMs)) writeHist(HIST_DB_KEY, { ts: Date.now(), value: dbLatMs });
      // Dashboard para conteos rápidos de ventas/items del día
      // y alimentar tendencias para ventas/items

      try {
        const resp = await api.get('/reports/dashboard', { params: { period: 'today' } } as any);
        const raw = resp?.data || {};
        const recentSalesArr = Array.isArray(raw?.data?.recentSales) ? raw.data.recentSales : (Array.isArray(raw?.recentSales) ? raw.recentSales : []);
        const today = new Date();
        const todayStr = today.toDateString();
        const todaySalesArr = recentSalesArr.filter((sale: any) => {
          const saleDate = new Date(sale?.date || sale?.createdAt);
          return saleDate.toDateString() === todayStr;
        });
        const computedTodaySales = Number(raw?.data?.todaySales ?? raw?.todaySales ?? todaySalesArr.length);
        const computedTodayItems = todaySalesArr.reduce((acc: number, s: any) => acc + Number(Array.isArray(s?.items) ? s.items.length : (s?.items ?? 0)), 0);
        const salesCount = Number.isFinite(computedTodaySales) ? computedTodaySales : 0;
        const itemsCount = Number.isFinite(computedTodayItems) ? computedTodayItems : 0;
        setTodaySalesCount(salesCount);
        setTodayItemsCount(itemsCount);
        updateTrends(jh, { salesToday: salesCount, itemsToday: itemsCount, dbLatencyMs: Number.isFinite(dbLatMs) ? dbLatMs : undefined, apiPingMs: Number.isFinite(pingMs || NaN) ? (pingMs as number) : undefined });
      } catch {
        setTodaySalesCount(0);
        setTodayItemsCount(0);
        updateTrends(jh, { dbLatencyMs: Number.isFinite(dbLatMs) ? dbLatMs : undefined, apiPingMs: Number.isFinite(pingMs || NaN) ? (pingMs as number) : undefined });
      }
      // Construir reporte de .env frontend
      try {
        const env = (import.meta as any).env || {};
        const warnings: string[] = [];
        const isProd = !!env.PROD;
        const useMocks = String(env.VITE_USE_MOCKS || '').toLowerCase() === 'true';
        const apiUrlEnv = env.VITE_API_URL || '';
        const baseURL = String((api as any)?.defaults?.baseURL || '');
        if (isProd && useMocks) warnings.push('VITE_USE_MOCKS=true en producción');
        if (isProd && !apiUrlEnv) warnings.push('VITE_API_URL no definido en producción');
        setFrontendEnvReport({
          keys: {
            VITE_API_URL: apiUrlEnv || null,
            VITE_USE_MOCKS: useMocks,
            VITE_APP_VERSION: env.VITE_APP_VERSION || null,
            VITE_RAYGUN_API_KEY: env.VITE_RAYGUN_API_KEY ? '***' : null,
            PROD: isProd,
          },
          baseURL,
          warnings,
        });
      } catch {}
      setLastUpdated(new Date());
      return true;
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la salud del sistema");
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    // Sembrar tendencias desde historial persistido
    try {
      const apiHist = readHist(HIST_API_KEY);
      const dbHist = readHist(HIST_DB_KEY);
      setTrends(prev => ({
        ...prev,
        apiPingMs: apiHist.map(p => p.value),
        dbLatencyMs: dbHist.map(p => p.value),
      }));
    } catch { /* noop */ }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Auto-refresh con backoff y cancelación
    if (!autoRefresh) {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }
    const schedule = async () => {
      const ok = await load();
      // Ajuste de backoff según resultado
      setBackoffMs(prev => {
        const base = baseIntervalMs;
        const max = 5 * 60 * 1000;
        if (ok) return base;
        const next = Math.min(prev * 2, max);
        return next;
      });
      timerRef.current = window.setTimeout(schedule, ok ? baseIntervalMs : backoffMs);
    };
    timerRef.current = window.setTimeout(schedule, backoffMs);
    return () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [autoRefresh, baseIntervalMs]);

  const totals = useMemo(() => {
    const t = metrics?.totals || health?.metrics?.totals;
    return t || { info: 0, warning: 0, error: 0, exception: 0 };
  }, [metrics, health]);

  const severityRows = useMemo(() => {
    const raw = metrics?.countsBySeverity || health?.metrics?.countsBySeverity || [];
    const map = new Map<string, number>();
    raw.forEach(r => { if (r && r.severity) map.set(String(r.severity), Number(r.count || 0)); });
    const order = ["info", "warning", "error", "exception"] as const;
    return order.map(sev => ({ severity: sev as any, count: map.get(sev) ?? 0 }));
  }, [metrics, health]);

  const exportSnapshot = () => {
    if (!health) return;
    const tsSafe = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-snapshot-${tsSafe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportThresholds = () => {
    const out: Record<string, number> = {};
    thresholdKeys.forEach(({ warnKey, critKey }) => {
      const warn = localStorage.getItem(warnKey);
      const crit = localStorage.getItem(critKey);
      if (warn !== null) {
        const n = Number(warn); if (Number.isFinite(n)) out[warnKey] = n;
      }
      if (crit !== null) {
        const n = Number(crit); if (Number.isFinite(n)) out[critKey] = n;
      }
    });
    const tsSafe = new Date().toISOString().replace(/[:.]/g, "-");
    const payload = { type: "thresholds", createdAt: new Date().toISOString(), data: out };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-thresholds-${tsSafe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startImportThresholds = () => {
    importInputRef.current?.click();
  };

  const handleImportThresholdsFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data: Record<string, any> = parsed?.data || parsed;
      Object.entries(data || {}).forEach(([k, v]) => {
        if (typeof k === 'string' && (thresholdKeys.some(t => t.warnKey === k || t.critKey === k))) {
          const n = Number(v);
          if (Number.isFinite(n)) localStorage.setItem(k, String(n));
        }
      });
      // Re-montar el editor para que tome nuevos defaultValue
      setShowThresholdEditor(false);
      setTimeout(() => setShowThresholdEditor(true), 0);
    } catch (err) {
      console.error('Error importando umbrales:', err);
    }
  };

  const aggStatus = useMemo(() => {
    const dbOk = health?.db?.healthy === true;
    const cfgOk = health?.config?.ok === true;
    const degraded = Boolean(health?.degradation?.degraded || health?.sales?.degraded);
    if (!dbOk || !cfgOk) return { label: "Crítico", cls: "text-red-700 bg-red-50 border-red-200" };
    if (degraded) return { label: "Degradado", cls: "text-yellow-700 bg-yellow-50 border-yellow-200" };
    return { label: "OK", cls: "text-green-700 bg-green-50 border-green-200" };
  }, [health]);

  const goToObservabilitySeverity = (sev: "info" | "warning" | "error" | "exception") => {
    const wh = metrics?.windowHours ?? metricsWindowHours;
    navigate({ pathname: "/observability", search: `?severity=${sev}&windowHours=${wh}` });
  };

  const nextRefreshLabel = useMemo(() => {
    const ms = backoffMs;
    const secs = Math.round(ms / 1000);
    const isBackoff = ms > baseIntervalMs;
    return isBackoff ? `Retentando en ${secs}s` : `Próximo refresco en ${secs}s`;
  }, [backoffMs, baseIntervalMs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Salud del Sistema</h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-600" title={lastUpdated.toISOString()}>
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading && (
            <span className="inline-flex items-center text-xs px-2 py-1 rounded border text-blue-700 bg-blue-50 border-blue-200">
              <span className="w-3 h-3 mr-1 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              Cargando
            </span>
          )}
          <button onClick={load} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Refrescar</button>
          <button
            onClick={() => {
              setAutoRefresh(a => {
                const next = !a;
                try { localStorage.setItem('health:autoRefreshEnabled', next ? '1' : '0'); } catch {}
                return next;
              });
            }}
            className={`px-3 py-1 rounded ${autoRefresh ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-200 hover:bg-gray-300"}`}
            title="Activar/pausar auto-refresco"
          >{autoRefresh ? "Auto" : "Pausado"}</button>
          <select
            className="text-xs px-2 py-1 rounded border text-gray-700 bg-white"
            title="Intervalo base de auto-refresco"
            value={baseIntervalMs}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBaseIntervalMs(v);
              setBackoffMs(v);
              try { localStorage.setItem('health:autoRefreshBaseMs', String(v)); } catch {}
            }}
          >
            <option value={5000}>5s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
          <span className="text-[11px] text-gray-500" title="Estado de backoff">
            {nextRefreshLabel}
          </span>
          <button onClick={exportSnapshot} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Exportar JSON</button>
        </div>
      </div>

      <HealthStatus />

      {loading && (
        <div className="p-4 rounded bg-gray-50 border">Cargando salud...</div>
      )}
      {error && (
        <div className="p-4 rounded bg-red-50 border border-red-300 text-red-700">{error}</div>
      )}

      {!loading && !error && health && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Estado agregado</div>
            <div>
              <span className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded border ${aggStatus.cls}`} title="Agrega DB, Config y degradación">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aggStatus.label === "Crítico" ? "#dc2626" : aggStatus.label === "Degradado" ? "#d97706" : "#16a34a" }} />
                {aggStatus.label}
              </span>
              <div className="mt-2">
                {(() => {
                  const sev = (totals.error > 0 || totals.exception > 0) ? { label: "Crítico", cls: "text-red-700 bg-red-50 border-red-200", dot: "#dc2626" }
                    : totals.warning > 0 ? { label: "Warn", cls: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "#d97706" }
                    : { label: "OK", cls: "text-green-700 bg-green-50 border-green-200", dot: "#16a34a" };
                  return (
                    <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border ${sev.cls}`} title="Resumen de severidad en ventana">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sev.dot }} />
                      Severidad: {sev.label}
                      <span className="ml-2 text-gray-500">Info {totals.info} · Warn {totals.warning} · Err {totals.error} · Exc {totals.exception}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Resumen</div>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Versión:</span> {health?.version || "N/D"}</div>
              <div><span className="text-gray-500">Uptime:</span> {typeof health?.uptimeSec === 'number' ? formatUptime(health.uptimeSec) : "N/D"}</div>
              <div><span className="text-gray-500">Timestamp:</span> {health?.timestamp ? new Date(health.timestamp).toLocaleString() : "N/D"}</div>
              {health.degradation?.degraded && (
                <div className="mt-2">
                  <div className="inline-block px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Degradado</div>
                  <ul className="list-disc ml-5 mt-1 text-xs text-gray-700">
                    {health.degradation.causes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Base de Datos</div>
            <div className="text-sm space-y-1">
              <div className={health?.db?.healthy ? "text-green-700" : "text-red-700"}>
                {health?.db?.healthy ? "Conectada" : "Desconectada"}
              </div>
              {(() => {
                const lat = (typeof (health as any)?.db?.latencyMs === 'number') ? (health as any).db.latencyMs : (typeof (health as any)?.db?.latency === 'number' ? (health as any).db.latency : undefined);
                if (typeof lat !== 'number') return null;
                const dbHistSummary = summarizeHist(readHist(HIST_DB_KEY));
                return (
                  <div className="flex items-center gap-2">
                    <ObservabilityChip label="Latencia DB" value={lat} warnKey="DB_LATENCY_WARN_MS" critKey="DB_LATENCY_CRIT_MS" unit="ms" title="Latencia de base de datos" />
                    <MiniTrend values={trends.dbLatencyMs || []} title="Tendencia latencia DB" />
                    {dbHistSummary && (
                      <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200" title="Histórico 24h">
                        {`min ${dbHistSummary.min} · p95 ${dbHistSummary.p95} · max ${dbHistSummary.max}`}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const arr = readHist(HIST_DB_KEY);
                    try { navigator.clipboard.writeText(JSON.stringify(arr, null, 2)); } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  title="Copiar historial de latencia DB"
                >Exportar historial</button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">API</div>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Base URL:</span> {(api as any)?.defaults?.baseURL || 'N/D'}</div>
              <div className="flex items-center gap-2">
                <ObservabilityChip label="Ping" value={Number(apiPingMs || 0)} warnKey="API_PING_WARN_MS" critKey="API_PING_CRIT_MS" unit="ms" title="Latencia de ping API" />
                <MiniTrend values={trends.apiPingMs || []} title="Tendencia ping API" />
                {(() => {
                  const apiHistSummary = summarizeHist(readHist(HIST_API_KEY));
                  if (!apiHistSummary) return null;
                  return (
                    <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200" title="Histórico 24h">
                      {`min ${apiHistSummary.min} · p95 ${apiHistSummary.p95} · max ${apiHistSummary.max}`}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const arr = readHist(HIST_API_KEY);
                    try { navigator.clipboard.writeText(JSON.stringify(arr, null, 2)); } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  title="Copiar historial de ping API"
                >Exportar historial</button>
                <a
                  href={`${(api as any)?.defaults?.baseURL || ''}/api/meta/config?verbose=1&fields=db,validation,cors,ports`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                  title="Abrir validación .env backend"
                >Validación backend</a>
              </div>
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Configuración</div>
            <div className="text-sm space-y-1">
              <div className={health?.config?.ok ? "text-green-700" : "text-red-700"}>
                {health?.config?.ok ? "OK" : "Faltan claves"}
              </div>
              {!health?.config?.ok && health?.config?.missing?.length ? (
                <ul className="list-disc ml-5 mt-1 text-xs text-gray-700">
                  {health?.config?.missing?.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Módulos</div>
            <div className="mb-2 flex gap-2 items-center text-[11px]">
              <button
                onClick={() => refreshAll()}
                className={`px-2 py-0.5 rounded border ${refreshing ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                title="Refrescar métricas"
              >{refreshing ? 'Refrescando…' : 'Refrescar'}</button>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}${window.location.pathname}#/observability/health?windowHours=${metrics?.windowHours ?? metricsWindowHours}`;
                  try { await navigator.clipboard.writeText(url); } catch {}
                }}
                className="px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                title="Copiar enlace con ventana actual"
              >Copiar enlace</button>
              <button
                onClick={() => setShowThresholdEditor(s => !s)}
                className="px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                title="Editar umbrales locales"
              >{showThresholdEditor ? 'Ocultar umbrales' : 'Editar umbrales'}</button>
            </div>
            {showThresholdEditor && (
              <div className="mb-3 p-2 rounded border bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] text-gray-700">Umbrales locales (override). Vacío = usar variables de entorno.</div>
                  <div className="flex items-center gap-2">
                    <button onClick={exportThresholds} className="text-[11px] px-2 py-0.5 rounded border bg-gray-200 hover:bg-gray-300">Exportar umbrales</button>
                    <button onClick={startImportThresholds} className="text-[11px] px-2 py-0.5 rounded border bg-gray-200 hover:bg-gray-300">Importar umbrales</button>
                    <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportThresholdsFile(f); e.currentTarget.value = ""; }} />
                    <input
                      type="text"
                      className="text-[11px] px-2 py-0.5 rounded border"
                      placeholder="Nombre del preset"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      title="Nombre para guardar/cargar preset"
                    />
                    <button onClick={() => savePreset(presetName)} className="text-[11px] px-2 py-0.5 rounded border bg-gray-200 hover:bg-gray-300" title="Guardar preset">Guardar preset</button>
                    <select
                      className="text-[11px] px-2 py-0.5 rounded border"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      title="Seleccionar preset guardado"
                    >
                      <option value="">(Seleccionar preset)</option>
                      {presetNames.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button onClick={() => loadPreset(presetName)} className="text-[11px] px-2 py-0.5 rounded border bg-gray-200 hover:bg-gray-300" title="Cargar preset">Cargar</button>
                    <button onClick={() => deletePreset(presetName)} className="text-[11px] px-2 py-0.5 rounded border bg-gray-200 hover:bg-gray-300" title="Borrar preset">Borrar</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {thresholdKeys.map(k => (
                    <div key={`${k.warnKey}-${k.critKey}`} className="flex items-center gap-2 text-[12px]">
                      <span className="w-28 text-gray-600">{k.label}</span>
                      <label className="flex items-center gap-1">
                        <span className="text-gray-500">Warn</span>
                        <input
                          type="number"
                          className="w-24 px-1 py-0.5 border rounded"
                          defaultValue={getThresholdVal(k.warnKey) ?? ''}
                          placeholder={(import.meta as any).env?.[`VITE_${k.warnKey}`] ?? ''}
                          onBlur={(e) => { setThresholdVal(k.warnKey, e.target.value); refreshAll(); }}
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-gray-500">Crit</span>
                        <input
                          type="number"
                          className="w-24 px-1 py-0.5 border rounded"
                          defaultValue={getThresholdVal(k.critKey) ?? ''}
                          placeholder={(import.meta as any).env?.[`VITE_${k.critKey}`] ?? ''}
                          onBlur={(e) => { setThresholdVal(k.critKey, e.target.value); refreshAll(); }}
                        />
                      </label>
                      {k.unit && <span className="text-gray-500">{k.unit}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-sm space-y-1">
              <div>
            <span className="text-gray-500">Cola de trabajos:</span> {health?.modules?.jobQueue?.ok ? "OK" : "No disponible"}
                {typeof jobsHealth?.running === 'boolean' && (
                  <span
                    className={`ml-2 text-[11px] px-2 py-0.5 rounded border ${jobsHealth.running ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                    title="Estado del runner de Jobs"
                  >
                    Runner: {jobsHealth.running ? 'Activo' : 'Detenido'}
                  </span>
                )}
                {typeof jobsHealth?.intervalMs === 'number' && (
                  <span className="ml-2 inline-flex items-center gap-2">
                    <ObservabilityChip label="Intervalo" value={jobsHealth.intervalMs || 0} warnKey="JOBS_INTERVAL_WARN_MS" critKey="JOBS_INTERVAL_CRIT_MS" unit="ms" title="Intervalo del job runner" />
                    <MiniTrend values={trends.intervalMs || []} title="Tendencia intervalo" />
                    {typeof jobsHealth?.processingCount === 'number' && (
                      <>
                        <ObservabilityChip label="Procesando" value={Number(jobsHealth?.processingCount || 0)} warnKey="JOBS_PROCESSING_WARN_COUNT" critKey="JOBS_PROCESSING_CRIT_COUNT" title="Jobs en procesamiento" />
                        <MiniTrend values={trends.processingCount || []} title="Tendencia procesando" />
                      </>
                    )}
                    {typeof jobsHealth?.pendingCount === 'number' && (
                      <>
                        <ObservabilityChip label="Pendientes" value={Number(jobsHealth?.pendingCount || 0)} warnKey="JOBS_PENDING_WARN_COUNT" critKey="JOBS_PENDING_CRIT_COUNT" title="Jobs pendientes en cola" />
                        <MiniTrend values={trends.pendingCount || []} title="Tendencia pendientes" />
                      </>
                    )}
                    {typeof jobsHealth?.failedCount === 'number' && (
                      <>
                        <ObservabilityChip label="Fallidos" value={Number(jobsHealth?.failedCount || 0)} warnKey="JOBS_FAILED_WARN_COUNT" critKey="JOBS_FAILED_CRIT_COUNT" title="Jobs fallidos" />
                        <MiniTrend values={trends.failedCount || []} title="Tendencia fallidos" />
                      </>
                    )}
                    {typeof jobsHealth?.queueAgeMsStats?.p95 === 'number' && (
                      <>
                        <ObservabilityChip label="Cola p95" value={Number(jobsHealth?.queueAgeMsStats?.p95 || 0)} warnKey="JOBS_QUEUEAGE_WARN_MS" critKey="JOBS_QUEUEAGE_CRIT_MS" unit="ms" title="p95 de edad en cola" />
                        <MiniTrend values={trends.queueP95 || []} title="Tendencia cola p95" />
                      </>
                    )}
                    {typeof jobsHealth?.processingTimeMsStats?.p95 === 'number' && (
                      <>
                        <ObservabilityChip label="Proc p95" value={Number(jobsHealth?.processingTimeMsStats?.p95 || 0)} warnKey="JOBS_PROCTIME_WARN_MS" critKey="JOBS_PROCTIME_CRIT_MS" unit="ms" title="p95 de tiempo de proceso" />
                        <MiniTrend values={trends.procP95 || []} title="Tendencia proc p95" />
                      </>
                    )}
                  </span>
                )}
                <button
                  onClick={() => navigate({ pathname: "/observability", search: `?type=jobs&windowHours=${metrics?.windowHours ?? metricsWindowHours}` })}
                  className="ml-2 text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                  title="Ver Jobs en Observabilidad"
                >Ver</button>
              </div>
              <div>
            <span className="text-gray-500">Sistema de archivos:</span> {health?.modules?.filesystem?.ok ? "OK" : "No disponible"}
              </div>
              <div>
            <span className="text-gray-500">Almacenamiento offline:</span> {health?.modules?.offlineStorage?.ok ? "OK" : "No disponible"}
              </div>
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Inventario</div>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Tablas:</span> {health.inventory?.tablesExist ? "Presentes" : "N/D"}</div>
              {typeof health.inventory?.ledgerCount === "number" && (
                <div className="flex items-center gap-2">
                  <ObservabilityChip
                    label="Movimientos"
                    value={health.inventory?.ledgerCount || 0}
                    warnKey="LEDGER_WARN_COUNT"
                    critKey="LEDGER_CRIT_COUNT"
                    unit=""
                    title="Conteo de movimientos del ledger"
                  />
                  <button
                    onClick={() => navigate({ pathname: "/observability", search: `?type=inventory&windowHours=24` })}
                    className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    title="Ver Inventario en Observabilidad"
                  >Ver en Observabilidad</button>
                </div>
              )}
              {typeof health.inventory?.lowStockCount === "number" && (
                <div><span className="text-gray-500">Bajo stock:</span> {health.inventory?.lowStockCount}</div>
              )}
            </div>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Ventas</div>
            <div className="text-sm space-y-1">
              <div className={health.sales?.ok ? "text-green-700" : "text-yellow-700"}>
                {health.sales?.ok ? "OK" : health.sales?.degraded ? "Degradado" : "N/D"}
              </div>
              {health.sales?.message && (
                <div className="text-xs text-gray-700">{health.sales.message}</div>
              )}
              <div className="flex items-center gap-2">
                <ObservabilityChip label="Ventas (hoy)" value={todaySalesCount} warnKey="SALES_WARN_COUNT" critKey="SALES_CRIT_COUNT" title="Conteo de ventas del día" />
                <MiniTrend values={trends.salesToday || []} title="Tendencia ventas hoy" />
                <ObservabilityChip label="Items (hoy)" value={todayItemsCount} warnKey="SALEITEMS_WARN_COUNT" critKey="SALEITEMS_CRIT_COUNT" title="Conteo de items vendidos hoy" />
                <MiniTrend values={trends.itemsToday || []} title="Tendencia items hoy" />
              </div>
              <div>
                <button
                  onClick={() => navigate({ pathname: "/observability", search: `?type=sales&windowHours=24` })}
                  className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                  title="Ver Ventas en Observabilidad"
                >Ver en Observabilidad</button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded border bg-white lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Métricas de severidad ({metrics?.windowHours ?? metricsWindowHours}h)</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ventana</span>
                <select
                  className="text-xs px-2 py-1 rounded border text-gray-700 bg-white"
                  title="Ventana temporal para métricas de severidad"
                  value={metricsWindowHours}
                  onChange={async (e) => {
                    const v = Number(e.target.value);
                    setMetricsWindowHours(v);
                    try { localStorage.setItem('health:metricsWindowHours', String(v)); } catch {}
                    // Refrescar métricas con la nueva ventana sin esperar al ciclo de auto-refresh
                    try {
                      const m = await fetchHealthMetrics(v);
                      setMetrics(m);
                    } catch { /* noop */ }
                  }}
                >
                  <option value={1}>1h</option>
                  <option value={6}>6h</option>
                  <option value={12}>12h</option>
                  <option value={24}>24h</option>
                  <option value={48}>48h</option>
                  <option value={72}>72h</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mb-2">
              <button onClick={() => goToObservabilitySeverity("info")} className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-sm border border-blue-200 hover:bg-blue-100" title="Ver eventos info en Observabilidad">Info: {totals.info}</button>
              <button onClick={() => goToObservabilitySeverity("warning")} className="px-2 py-1 rounded bg-yellow-50 text-yellow-700 text-sm border border-yellow-200 hover:bg-yellow-100" title="Ver warnings en Observabilidad">Warning: {totals.warning}</button>
              <button onClick={() => goToObservabilitySeverity("error")} className="px-2 py-1 rounded bg-red-50 text-red-700 text-sm border border-red-200 hover:bg-red-100" title="Ver errores en Observabilidad">Error: {totals.error}</button>
              <button onClick={() => goToObservabilitySeverity("exception")} className="px-2 py-1 rounded bg-purple-50 text-purple-700 text-sm border border-purple-200 hover:bg-purple-100" title="Ver excepciones en Observabilidad">Exception: {totals.exception}</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Severidad</th>
                  <th className="py-1">Conteo</th>
                </tr>
              </thead>
              <tbody>
                {severityRows.map((row) => (
                  <tr key={row.severity} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => goToObservabilitySeverity(row.severity)} title={`Ver ${row.severity} en Observabilidad`}>
                    <td className="py-1 capitalize">{row.severity}</td>
                    <td className="py-1">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded border bg-white">
            <div className="font-medium mb-2">Error Budget</div>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Ventana:</span> {health?.errorBudget?.windowHours ?? "N/D"} h
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Warnings:</span> {health?.errorBudget?.warningCount ?? "N/D"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Errores:</span> {health?.errorBudget?.errorCount ?? "N/D"}
              </div>
              {(() => {
                const wh = Number((health?.errorBudget?.windowHours ?? 0));
                if (!Number.isFinite(wh) || wh <= 0) return null;
                const wph = (Number(health?.errorBudget?.warningCount ?? 0) / wh).toFixed(2);
                const eph = (Number(health?.errorBudget?.errorCount ?? 0) / wh).toFixed(2);
                return (
                  <div className="flex items-center gap-2" title="Tasa por hora dentro de la ventana">
                    <span className="text-[11px] px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200">Warnings/h: {wph}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">Errores/h: {eph}</span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2">
                {(() => {
                  const eb = health?.errorBudget || { windowHours: 0, warningCount: 0, errorCount: 0 };
                  const status = eb.errorCount > 0 ? { label: "Crítico", cls: "text-red-700 bg-red-50 border-red-200", dot: "#dc2626" }
                    : eb.warningCount > 0 ? { label: "Warn", cls: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "#d97706" }
                    : { label: "OK", cls: "text-green-700 bg-green-50 border-green-200", dot: "#16a34a" };
                  return (
                    <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border ${status.cls}`} title="Estado del presupuesto de errores">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.dot }} />
                      {status.label}
                    </span>
                  );
                })()}
                <button
                  onClick={() => navigate({ pathname: "/observability", search: `?severity=error&windowHours=${health?.errorBudget?.windowHours ?? metrics?.windowHours ?? metricsWindowHours}` })}
                  className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  title="Ver errores dentro de la ventana"
                >Ver errores</button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded border bg-white lg:col-span-3">
            <div className="font-medium mb-2">Frontend .env</div>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Base URL resuelta:</span> {frontendEnvReport.baseURL || 'N/D'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Claves:</span>
                <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">VITE_API_URL: {String(frontendEnvReport.keys.VITE_API_URL ?? 'N/D')}</span>
                <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">VITE_USE_MOCKS: {String(frontendEnvReport.keys.VITE_USE_MOCKS)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">VITE_APP_VERSION: {String(frontendEnvReport.keys.VITE_APP_VERSION ?? 'N/D')}</span>
                <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">RAYGUN: {frontendEnvReport.keys.VITE_RAYGUN_API_KEY ? 'SET' : 'N/D'}</span>
              </div>
              {frontendEnvReport.warnings?.length ? (
                <div className="text-xs">
                  <div className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-800">Advertencias</div>
                  <ul className="list-disc ml-5 mt-1 text-gray-700">
                    {frontendEnvReport.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-green-700">Sin advertencias de configuración frontend</div>
              )}
              <div>
                <button
                  onClick={async () => {
                    const payload = {
                      baseURL: frontendEnvReport.baseURL,
                      keys: frontendEnvReport.keys,
                      warnings: frontendEnvReport.warnings,
                    };
                    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  title="Copiar diagnóstico de .env"
                >Copiar diagnóstico</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
