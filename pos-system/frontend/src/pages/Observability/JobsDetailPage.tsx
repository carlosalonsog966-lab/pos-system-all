import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchJobs, type JobRecord, type JobStatus } from '@/services/jobsService';
import ObservabilityChip from '@/components/Common/ObservabilityChip';
import { backendStatus } from '@/lib/api';

type JobHealthRow = {
  timestamp: number;
  running?: boolean;
  intervalMs?: number;
  pendingCount?: number;
  processingCount?: number;
  failedCount?: number;
  data?: Record<string, any>;
};

const JobsDetailPage: React.FC = () => {
  const [rows, setRows] = useState<JobHealthRow[]>([]);
  const [params] = useSearchParams();
  const filter = (params.get('filter') || '').toLowerCase();

  // Salud del backend para deshabilitar exportaciones cuando no está OK
  const [backendHealthMode, setBackendHealthMode] = useState<'ok' | 'no_health' | 'down'>('ok');
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

  // Listado de jobs (filtros y datos)
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [limit, setLimit] = useState<number>(50);
  const [sortKey, setSortKey] = useState<'createdAt'|'updatedAt'|'durationMs'>('createdAt');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');

  useEffect(() => {
    try {
      const j = localStorage.getItem('observability:jobsHistory');
      const arr: JobHealthRow[] = j ? JSON.parse(j) : [];
      setRows(arr);
    } catch {
      setRows([]);
    }
  }, []);

  // Fetch jobs con filtros
  const loadJobs = async () => {
    try {
      setLoadingJobs(true);
      const { jobs: items } = await fetchJobs({ type: typeFilter || undefined, status: (statusFilter || undefined) as JobStatus | undefined, limit });
      setJobs(items || []);
    } catch (err) {
      console.warn('No se pudo cargar listado de jobs', err);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, limit]);

  const jobsWithDerived = useMemo(() => {
    return jobs.map(j => {
      const created = j.createdAt ? new Date(j.createdAt).getTime() : NaN;
      const locked = j.lockedAt ? new Date(j.lockedAt).getTime() : NaN;
      const updated = j.updatedAt ? new Date(j.updatedAt).getTime() : NaN;
      let duration: number | null = null;
      if (j.status === 'processing' && Number.isFinite(locked)) {
        duration = Math.max(0, Date.now() - locked);
      } else if ((j.status === 'completed' || j.status === 'failed')) {
        const start = Number.isFinite(locked) ? locked : created;
        if (Number.isFinite(start) && Number.isFinite(updated)) duration = Math.max(0, updated - start);
      } else if (Number.isFinite(updated) && Number.isFinite(created)) {
        duration = Math.max(0, updated - created);
      }
      return { ...j, _createdTs: created, _updatedTs: updated, _durationMs: duration } as JobRecord & { _createdTs: number, _updatedTs: number, _durationMs: number | null };
    });
  }, [jobs]);

  const sortedJobs = useMemo(() => {
    const arr = [...jobsWithDerived];
    arr.sort((a, b) => {
      let va: number = 0; let vb: number = 0;
      if (sortKey === 'createdAt') { va = a._createdTs || 0; vb = b._createdTs || 0; }
      else if (sortKey === 'updatedAt') { va = a._updatedTs || 0; vb = b._updatedTs || 0; }
      else { va = (a._durationMs ?? -1); vb = (b._durationMs ?? -1); }
      return sortDir === 'asc' ? (va - vb) : (vb - va);
    });
    return arr;
  }, [jobsWithDerived, sortKey, sortDir]);

  const normalized = useMemo(() => rows.map((r) => {
    const base: Record<string, any> = { ...r };
    if (base && typeof base.data === 'object' && base.data) {
      try {
        Object.entries(base.data as Record<string, any>).forEach(([k, v]) => {
          if (!(k in base)) base[k] = v;
        });
      } catch {/* noop */}
      delete base.data;
    }
    return base as JobHealthRow;
  }), [rows]);

  const filtered = useMemo(() => {
    if (filter === 'failed') {
      return normalized.filter(r => Number(r.failedCount ?? 0) > 0);
    }
    if (filter === 'pending') {
      return normalized.filter(r => Number(r.pendingCount ?? 0) > 0);
    }
    return normalized;
  }, [normalized, filter]);

  const headers = ['timestamp','running','intervalMs','pendingCount','processingCount','failedCount'];

  const exportCsv = () => {
    try {
      const esc = (v: any) => {
        const s = v == null ? '' : String(v);
        const needsQuote = /[",\n]/.test(s);
        if (!needsQuote) return s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const csv = [headers.join(','), ...filtered.map(r => headers.map(h => esc((r as any)[h])).join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `jobs_detail_${filter || 'all'}_${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('CSV export error (jobs detail)', err);
    }
  };

  const exportJobsCsv = () => {
    try {
      const headers = ['id','type','status','createdAt','lockedAt','updatedAt','durationMs'];
      const esc = (v: any) => {
        const s = v == null ? '' : String(v);
        const needsQuote = /[",\n]/.test(s);
        if (!needsQuote) return s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const calcDuration = (j: JobRecord) => {
        const created = j.createdAt ? new Date(j.createdAt).getTime() : NaN;
        const locked = j.lockedAt ? new Date(j.lockedAt).getTime() : NaN;
        const updated = j.updatedAt ? new Date(j.updatedAt).getTime() : NaN;
        if (j.status === 'processing' && Number.isFinite(locked)) return Math.max(0, Date.now() - locked);
        if ((j.status === 'completed' || j.status === 'failed')) {
          const start = Number.isFinite(locked) ? locked : created;
          if (Number.isFinite(start) && Number.isFinite(updated)) return Math.max(0, updated - start);
        }
        return Number.isFinite(updated) && Number.isFinite(created) ? Math.max(0, updated - created) : '';
      };
      const rows = jobs.map(j => [j.id, j.type, j.status, j.createdAt, j.lockedAt ?? '', j.updatedAt, calcDuration(j)]);
      const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `jobs_list_${(statusFilter || 'all')}_${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('CSV export error (jobs list)', err);
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Link to="/observability" className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100">← Observabilidad</Link>
          <span className="text-gray-800">Detalle de Jobs</span>
          {filter && <span className="text-[11px] px-2 py-0.5 rounded border text-gray-700 bg-gray-50 border-gray-200">Filtro: {filter}</span>}
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const pendingCount = jobs.filter(j => String(j.status) === 'pending').length;
            const failedCount = jobs.filter(j => String(j.status) === 'failed').length;
            return (
              <>
                <ObservabilityChip label="Pendientes" value={pendingCount} warnKey="JOBS_PENDING_WARN_COUNT" critKey="JOBS_PENDING_CRIT_COUNT" />
                <ObservabilityChip label="Fallidos" value={failedCount} warnKey="JOBS_FAILED_WARN_COUNT" critKey="JOBS_FAILED_CRIT_COUNT" />
              </>
            );
          })()}
          <button
            onClick={exportCsv}
            className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100 disabled:opacity-50"
            disabled={backendHealthMode !== 'ok'}
            title={backendHealthMode !== 'ok' ? 'Acción deshabilitada: backend degradado o no disponible' : `Exportar filas (${filtered.length})`}
          >Exportar CSV</button>
        </div>
      </div>
      {/* Banner de salud del backend para exportaciones */}
      {backendHealthMode !== 'ok' && (
        <div className={`mb-2 rounded-md px-3 py-2 text-sm border ${backendHealthMode === 'down' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
          {backendHealthMode === 'down' ? 'Backend caído: exportaciones deshabilitadas temporalmente.' : 'Backend degradado: exportaciones deshabilitadas temporalmente.'}
        </div>
      )}
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intervalo (ms)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendientes</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procesando</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fallidos</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((r, idx) => {
              const ts = Number(r.timestamp ?? Date.now());
              const dateStr = new Date(ts).toLocaleString();
              const statusStr = r.running ? 'Activo' : 'Detenido';
              return (
                <tr key={`job-row-${idx}`}>
                  <td className="px-4 py-2 text-sm text-gray-700">{dateStr}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-0.5 rounded border ${r.running ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>{statusStr}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{Number(r.intervalMs ?? 0)}</td>
                  <td className="px-4 py-2 text-sm">
                    {(() => {
                      const count = Number(r.pendingCount ?? 0);
                      const warn = Number(((import.meta as any).env?.VITE_JOBS_PENDING_WARN_COUNT ?? NaN));
                      const crit = Number(((import.meta as any).env?.VITE_JOBS_PENDING_CRIT_COUNT ?? NaN));
                      const hasWarn = typeof warn === 'number' && !Number.isNaN(warn);
                      const hasCrit = typeof crit === 'number' && !Number.isNaN(crit);
                      let cls = 'text-gray-700';
                      let label = '';
                      if (hasCrit && count >= crit) { cls = 'text-red-700'; label = 'Crítico'; }
                      else if (hasWarn && count >= warn) { cls = 'text-yellow-700'; label = 'Warn'; }
                      const chipCls = label === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                      return (
                        <span className={`font-semibold ${cls}`}>
                          {count}
                          {label && <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{label}</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{Number(r.processingCount ?? 0)}</td>
                  <td className="px-4 py-2 text-sm">
                    {(() => {
                      const count = Number(r.failedCount ?? 0);
                      const warn = Number(((import.meta as any).env?.VITE_JOBS_FAILED_WARN_COUNT ?? NaN));
                      const crit = Number(((import.meta as any).env?.VITE_JOBS_FAILED_CRIT_COUNT ?? NaN));
                      const hasWarn = typeof warn === 'number' && !Number.isNaN(warn);
                      const hasCrit = typeof crit === 'number' && !Number.isNaN(crit);
                      let cls = 'text-gray-700';
                      let label = '';
                      if (hasCrit && count >= crit) { cls = 'text-red-700'; label = 'Crítico'; }
                      else if (hasWarn && count >= warn) { cls = 'text-yellow-700'; label = 'Warn'; }
                      const chipCls = label === 'Crítico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
                      return (
                        <span className={`font-semibold ${cls}`}>
                          {count}
                          {label && <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border font-normal ${chipCls}`}>{label}</span>}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-sm text-gray-500" colSpan={6}>Sin datos para el filtro seleccionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Listado de jobs con filtros y duración */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">Listado</span>
            <label className="text-[11px] text-gray-600">Tipo</label>
            <input
              className="text-[11px] border rounded px-1 py-0.5"
              placeholder="echo, sync, ..."
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <label className="text-[11px] text-gray-600">Estado</label>
            <select
              className="text-[11px] border rounded px-1 py-0.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value || '') as JobStatus | '')}
            >
              <option value="">Todos</option>
              <option value="queued">queued</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <label className="text-[11px] text-gray-600">Límite</label>
            <select
              className="text-[11px] border rounded px-1 py-0.5"
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <button
              className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
              onClick={loadJobs}
              title="Refrescar listado"
            >Buscar</button>
            <label className="text-[11px] text-gray-600 ml-2">Ordenar por</label>
            <select
              className="text-[11px] border rounded px-1 py-0.5"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
            >
              <option value="createdAt">Creado</option>
              <option value="updatedAt">Actualizado</option>
              <option value="durationMs">Duración</option>
            </select>
            <select
              className="text-[11px] border rounded px-1 py-0.5"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <button
            onClick={exportJobsCsv}
            className="text-xs px-2 py-1 rounded border text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
            title={`Exportar jobs (${jobs.length})`}
          >Exportar CSV</button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locked</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actualizado</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración (ms)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedJobs.map((j) => {
                const createdStr = j.createdAt ? new Date(j.createdAt).toLocaleString() : '';
                const lockedStr = j.lockedAt ? new Date(j.lockedAt).toLocaleString() : '';
                const updatedStr = j.updatedAt ? new Date(j.updatedAt).toLocaleString() : '';
                const created = j.createdAt ? new Date(j.createdAt).getTime() : NaN;
                const locked = j.lockedAt ? new Date(j.lockedAt).getTime() : NaN;
                const updated = j.updatedAt ? new Date(j.updatedAt).getTime() : NaN;
                let duration: number | string = '';
                if (j.status === 'processing' && Number.isFinite(locked)) {
                  duration = Math.max(0, Date.now() - locked);
                } else if ((j.status === 'completed' || j.status === 'failed')) {
                  const start = Number.isFinite(locked) ? locked : created;
                  if (Number.isFinite(start) && Number.isFinite(updated)) duration = Math.max(0, updated - start);
                } else if (Number.isFinite(updated) && Number.isFinite(created)) {
                  duration = Math.max(0, updated - created);
                }
                return (
                  <tr key={j.id}>
                    <td className="px-4 py-2 text-sm text-gray-700">{j.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{j.type}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-0.5 rounded border ${j.status === 'failed' ? 'text-red-700 bg-red-50 border-red-200' : j.status === 'completed' ? 'text-green-700 bg-green-50 border-green-200' : j.status === 'processing' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-gray-700 bg-gray-50 border-gray-200'}`}>{j.status}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{createdStr}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{lockedStr}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{updatedStr}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{typeof duration === 'number' ? duration : ''}</td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={7}>{loadingJobs ? 'Cargando...' : 'Sin resultados para los filtros seleccionados.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobsDetailPage;
