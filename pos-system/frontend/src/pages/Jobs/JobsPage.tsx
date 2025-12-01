import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { backendStatus } from '@/lib/api';
import { fetchJobs, fetchJobsHealth, enqueueJob, retryJob, type JobRecord, type JobStatus } from '@/services/jobsService';
import LoadingSpinner from '@/components/Common/LoadingSpinner';
import { useNotificationStore } from '@/store/notificationStore';

type JobsPageProps = { testMode?: boolean };

const statusBadgeClass = (s: JobStatus) => {
  switch (s) {
    case 'completed': return 'bg-green-100 text-green-700 border border-green-200';
    case 'failed': return 'bg-red-100 text-red-700 border border-red-200';
    case 'processing': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'queued': default: return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  }
};

const JobsPage: React.FC<JobsPageProps> = ({ testMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [health, setHealth] = useState<{ running?: boolean; intervalMs?: number }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<'createdAt' | 'updatedAt' | 'status' | 'type' | 'attempts'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { showSuccess, showError } = useNotificationStore();
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');

  // Parámetros para jobs
  // Actualizar precios
  const [rateOroAmarillo, setRateOroAmarillo] = useState<number>(3000);
  const [rateOroBlanco, setRateOroBlanco] = useState<number>(3000);
  const [rateOroRosa, setRateOroRosa] = useState<number>(3000);
  const [ratePlata925, setRatePlata925] = useState<number>(80);
  const [rateAcero, setRateAcero] = useState<number>(25);
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(1.25);
  const [priceCategory, setPriceCategory] = useState<string>('');
  const [priceMetals, setPriceMetals] = useState<string[]>([]);
  const [scheduledAtPrice, setScheduledAtPrice] = useState<string>('');

  // Imprimir etiquetas en lote
  const [labelsLimit, setLabelsLimit] = useState<number>(20);
  const [labelsCategory, setLabelsCategory] = useState<string>('');
  const [scheduledAtLabels, setScheduledAtLabels] = useState<string>('');

  // Reporte de cierre diario
  const [closingDate, setClosingDate] = useState<string>(''); // YYYY-MM-DD
  const [scheduledAtClosing, setScheduledAtClosing] = useState<string>('');

  const loadHealth = async () => {
    try {
      const h = await fetchJobsHealth();
      setHealth({ running: h.running, intervalMs: h.intervalMs });
    } catch {}
  };

  const loadJobs = async (targetPage?: number) => {
    try {
      setLoading(true);
      setError(null);
      const currentPage = typeof targetPage === 'number' ? targetPage : page;
      const { jobs, pagination } = await fetchJobs({ type: typeFilter || undefined, status: (statusFilter || undefined) as JobStatus | undefined, limit, page: currentPage });
      const items = Array.isArray(jobs) ? jobs : [];
      setJobs(items);
      if (pagination && typeof pagination.total === 'number') {
        setPagination(pagination);
      } else {
        setPagination({ page: currentPage, limit, total: items.length, totalPages: 1 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (testMode) return;
    loadHealth();
    loadJobs(1);
  }, [testMode]);

  // Monitorear salud del backend y deshabilitar acciones sensibles en modo degradado/caído
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

  useEffect(() => {
    if (testMode || !autoRefresh) return;
    const id = window.setInterval(() => {
      loadJobs();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, testMode]);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) { if (j?.type) set.add(String(j.type)); }
    return Array.from(set);
  }, [jobs]);

  const statusStats = useMemo(() => {
    const stats = { queued: 0, processing: 0, completed: 0, failed: 0 } as Record<JobStatus, number>;
    for (const j of jobs) { if (j?.status && stats[j.status] !== undefined) stats[j.status]++; }
    return stats;
  }, [jobs]);

  const sortedJobs = useMemo(() => {
    const list = [...jobs];
    const statusOrder: Record<JobStatus, number> = { queued: 0, processing: 1, completed: 2, failed: 3 };
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case 'createdAt':
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          av = new Date(a.updatedAt).getTime();
          bv = new Date(b.updatedAt).getTime();
          break;
        case 'status':
          av = statusOrder[a.status];
          bv = statusOrder[b.status];
          break;
        case 'type':
          // Comparar como strings de forma segura
          const avStr = String(a.type ?? '');
          const bvStr = String(b.type ?? '');
          return avStr.localeCompare(bvStr) * (sortDir === 'asc' ? 1 : -1);
        case 'attempts':
          av = a.attempts;
          bv = b.attempts;
          break;
      }
      const comp = av < (bv as number) ? -1 : av > (bv as number) ? 1 : 0;
      return comp * (sortDir === 'asc' ? 1 : -1);
    });
    return list;
  }, [jobs, sortKey, sortDir]);

  const toggleSort = (key: 'createdAt' | 'updatedAt' | 'status' | 'type' | 'attempts') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleRetry = async (id: string) => {
    try {
      const res = await retryJob(id);
      if (res.success) {
        showSuccess(`Job ID: ${id} reintentado exitosamente - Tipo: ${res.job?.type || 'desconocido'}`);
        loadJobs();
      } else {
        showError(res.error || 'No se pudo reintentar');
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al reintentar');
    }
  };

  const handleEnqueueEcho = async () => {
    try {
      const res = await enqueueJob({ type: 'echo', payload: { message: 'Hola desde UI' } });
      if (res.success) {
        const echoMsg = (res.job?.payload as any)?.message || 'Hola desde UI';
        showSuccess(`Job echo encolado exitosamente - Mensaje: ${echoMsg}`);
        loadJobs();
      } else {
        showError(res.error || 'No se pudo encolar');
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al encolar');
    }
  };

  const handleEnqueuePriceUpdate = async () => {
    try {
      const res = await enqueueJob({
        type: 'prices.update.daily',
        payload: {
          // Valores configurables desde la UI
          rates: {
            'Oro Amarillo': rateOroAmarillo,
            'Oro Blanco': rateOroBlanco,
            'Oro Rosa': rateOroRosa,
            'Plata 925': ratePlata925,
            'Acero Inoxidable': rateAcero,
          },
          markupMultiplier,
          category: priceCategory || undefined,
          metals: priceMetals && priceMetals.length ? priceMetals : undefined,
        },
        scheduledAt: scheduledAtPrice ? new Date(scheduledAtPrice).toISOString() : null,
      });
      if (res.success) {
        showSuccess(`Job de actualización de precios encolado exitosamente - Metales: ${priceMetals.join(', ') || 'todos'} - Categoría: ${priceCategory || 'todas'}`, '');
        loadJobs();
      } else {
        showError(res.error || 'No se pudo encolar la actualización');
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al encolar actualización de precios');
    }
  };

  const handleEnqueueBulkLabels = async () => {
    try {
      const res = await enqueueJob({
        type: 'labels.print.bulk',
        payload: {
          limit: labelsLimit || undefined,
          category: labelsCategory || undefined,
        },
        scheduledAt: scheduledAtLabels ? new Date(scheduledAtLabels).toISOString() : null,
      });
      if (res.success) {
        showSuccess(`Job de impresión de etiquetas en lote encolado exitosamente - Límite: ${labelsLimit} - Categoría: ${labelsCategory || 'todas'}`);
        loadJobs();
      } else {
        showError(res.error || 'No se pudo encolar la impresión en lote');
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al encolar impresión en lote');
    }
  };

  const handleEnqueueDailyClosing = async () => {
    try {
      const res = await enqueueJob({
        type: 'closing.daily.report',
        payload: {
          date: closingDate || undefined,
        },
        scheduledAt: scheduledAtClosing ? new Date(scheduledAtClosing).toISOString() : null,
      });
      if (res.success) {
        showSuccess(`Job de reporte de cierre diario encolado exitosamente - Fecha: ${closingDate || 'hoy'}`);
        loadJobs();
      } else {
        showError(res.error || 'No se pudo encolar el reporte');
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al encolar reporte de cierre');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Jobs</h1>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded ${health.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${health.running ? 'bg-green-600' : 'bg-red-600'}`} />
            {health.running ? 'Worker activo' : 'Worker inactivo'}
          </span>
          {typeof health.intervalMs === 'number' && (
            <span className="text-xs text-gray-500">{health.intervalMs} ms</span>
          )}
          <button
            onClick={() => loadJobs()}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={backendHealthMode !== 'ok'}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Actualizar'}
          >Actualizar</button>
          <button
            onClick={handleEnqueueEcho}
            className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            disabled={backendHealthMode !== 'ok' && !testMode}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Encolar echo'}
            data-testid="jobs.run"
          >Encolar echo</button>
          <button
            onClick={handleEnqueuePriceUpdate}
            className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            disabled={backendHealthMode !== 'ok' && !testMode}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Actualizar precios diarios'}
          >Actualizar precios diarios</button>
          <button
            onClick={handleEnqueueBulkLabels}
            className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
            disabled={backendHealthMode !== 'ok' && !testMode}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Imprimir etiquetas en lote'}
          >Imprimir etiquetas en lote</button>
          <button
            onClick={handleEnqueueDailyClosing}
            className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700"
            disabled={backendHealthMode !== 'ok' && !testMode}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Reporte cierre diario'}
          >Reporte cierre diario</button>
          <label className="ml-2 text-sm text-gray-600 flex items-center gap-2">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
      </div>
      {/* Banner de estado degradado/caído */}
      {backendHealthMode !== 'ok' && (
        <div className={`mt-3 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>
                {backendHealthMode === 'down'
                  ? 'Servidor no disponible. Escrituras/encolados deshabilitados temporalmente.'
                  : 'Modo degradado: escrituras/encolados deshabilitados temporalmente.'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Formularios para encolar con parámetros */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Precios diarios */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Actualizar precios diarios</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Oro Amarillo (x gr)</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={rateOroAmarillo} onChange={(e) => setRateOroAmarillo(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Oro Blanco (x gr)</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={rateOroBlanco} onChange={(e) => setRateOroBlanco(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Oro Rosa (x gr)</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={rateOroRosa} onChange={(e) => setRateOroRosa(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Plata 925 (x gr)</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={ratePlata925} onChange={(e) => setRatePlata925(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Acero Inoxidable (x gr)</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={rateAcero} onChange={(e) => setRateAcero(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Markup (multiplicador)</label>
            <input type="number" step="0.01" className="border border-gray-300 rounded px-2 py-1 w-full" value={markupMultiplier} onChange={(e) => setMarkupMultiplier(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Categoría (opcional)</label>
            <input type="text" className="border border-gray-300 rounded px-2 py-1 w-full" value={priceCategory} onChange={(e) => setPriceCategory(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Programar (fecha y hora)</label>
            <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1 w-full" value={scheduledAtPrice} onChange={(e) => setScheduledAtPrice(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-gray-600 mb-1">Metales a incluir (opcional)</label>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Oro Amarillo','Oro Blanco','Oro Rosa','Plata 925','Acero Inoxidable'].map((m) => (
              <label key={m} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={priceMetals.includes(m)}
                  onChange={(e) => {
                    setPriceMetals((prev) => e.target.checked ? [...prev, m] : prev.filter((x) => x !== m));
                  }}
                />
                {m}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleEnqueuePriceUpdate} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700" disabled={backendHealthMode !== 'ok'} title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Encolar actualización'} data-testid="jobs-run-price-update-button">Encolar actualización</button>
        </div>
      </div>

      {/* Etiquetas en lote */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Imprimir etiquetas en lote</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Límite</label>
            <input type="number" className="border border-gray-300 rounded px-2 py-1 w-full" value={labelsLimit} onChange={(e) => setLabelsLimit(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Categoría (opcional)</label>
            <input type="text" className="border border-gray-300 rounded px-2 py-1 w-full" value={labelsCategory} onChange={(e) => setLabelsCategory(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Programar (fecha y hora)</label>
            <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1 w-full" value={scheduledAtLabels} onChange={(e) => setScheduledAtLabels(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleEnqueueBulkLabels} className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700" disabled={backendHealthMode !== 'ok'} title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Encolar impresión'} data-testid="jobs-run-bulk-labels-button">Encolar impresión</button>
        </div>
      </div>

      {/* Reporte cierre diario */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Reporte cierre diario</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha (opcional)</label>
            <input type="date" className="border border-gray-300 rounded px-2 py-1 w-full" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Programar (fecha y hora)</label>
            <input type="datetime-local" className="border border-gray-300 rounded px-2 py-1 w-full" value={scheduledAtClosing} onChange={(e) => setScheduledAtClosing(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleEnqueueDailyClosing} className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700" disabled={backendHealthMode !== 'ok'} title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : 'Encolar reporte'} data-testid="jobs-run-daily-closing-button">Encolar reporte</button>
        </div>
      </div>
    </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <div className="text-xs text-yellow-800">Queued</div>
          <div className="text-2xl font-semibold text-yellow-900">{statusStats.queued}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-xs text-blue-800">Processing</div>
          <div className="text-2xl font-semibold text-blue-900">{statusStats.processing}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="text-xs text-green-800">Completed</div>
          <div className="text-2xl font-semibold text-green-900">{statusStats.completed}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="text-xs text-red-800">Failed</div>
          <div className="text-2xl font-semibold text-red-900">{statusStats.failed}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-4 mb-4">
      <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo</label>
            <select className="border border-gray-300 rounded px-2 py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Estado</label>
            <select className="border border-gray-300 rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as JobStatus | '')}>
              <option value="">Todos</option>
              <option value="queued">queued</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Por página</label>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={limit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLimit(v);
                setPage(1);
                loadJobs(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            onClick={() => { setPage(1); loadJobs(1); }}
            className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
          >Aplicar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><LoadingSpinner size="lg" /></div>
      ) : error ? (
        <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded">{error}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort('type')}>
                    Tipo <span className="text-gray-400 text-xs">{sortKey === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                    Estado <span className="text-gray-400 text-xs">{sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort('attempts')}>
                    Intentos <span className="text-gray-400 text-xs">{sortKey === 'attempts' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">Programado</th>
                <th className="px-3 py-2 text-left">Disponible</th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort('createdAt')}>
                    Creado <span className="text-gray-400 text-xs">{sortKey === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button className="inline-flex items-center gap-1" onClick={() => toggleSort('updatedAt')}>
                    Actualizado <span className="text-gray-400 text-xs">{sortKey === 'updatedAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((j) => (
                <React.Fragment key={j.id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50" data-testid={`job-row-${j.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{j.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{j.type}</td>
                    <td className="px-3 py-2">
                      <span data-testid="jobs.status" className={`px-2 py-1 rounded ${statusBadgeClass(j.status)}`}>{j.status}</span>
                    </td>
                    <td className="px-3 py-2">{j.attempts}/{j.maxAttempts}</td>
                    <td className="px-3 py-2">{j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : '-'}</td>
                    <td className="px-3 py-2">{j.availableAt ? new Date(j.availableAt).toLocaleString() : '-'}</td>
                    <td className="px-3 py-2">{new Date(j.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{new Date(j.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 flex gap-2">
                      <button className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => toggleExpand(j.id)}>Detalle</button>
                      {j.status === 'failed' && (
                        <button className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700" onClick={() => handleRetry(j.id)}>Reintentar</button>
                      )}
                    </td>
                  </tr>
                  {expanded[j.id] && (
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2" colSpan={9}>
                        <pre className="text-xs overflow-auto max-h-48">{typeof j.payload === 'string' ? j.payload : JSON.stringify(j.payload, null, 2)}</pre>
                        {j.error && (
                          <div className="mt-2 text-xs text-red-700">Error: {j.error}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {jobs.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={9}>Sin registros</td></tr>
              )}
            </tbody>
          </table>
          {/* Paginación */}
          <div className="flex items-center justify-between p-3 border-t border-gray-100 text-sm">
            <div className="text-gray-600">
              {pagination ? (
                <span>
                  Página {pagination.page} de {pagination.totalPages} ·
                  {' '}Mostrando {(pagination.page - 1) * pagination.limit + (jobs.length ? 1 : 0)}–{(pagination.page - 1) * pagination.limit + jobs.length} de {pagination.total}
                </span>
              ) : (
                <span>Mostrando {jobs.length} registros</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                disabled={pagination ? pagination.page <= 1 : page <= 1}
                onClick={() => {
                  const next = (pagination ? pagination.page : page) - 1;
                  if (next >= 1) { setPage(next); loadJobs(next); }
                }}
              >Anterior</button>
              <button
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                disabled={pagination ? pagination.page >= pagination.totalPages : false}
                onClick={() => {
                  const next = (pagination ? pagination.page : page) + 1;
                  if (!pagination || next <= pagination.totalPages) { setPage(next); loadJobs(next); }
                }}
              >Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsPage;
