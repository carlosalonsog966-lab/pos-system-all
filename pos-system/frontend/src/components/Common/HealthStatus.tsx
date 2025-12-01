import React, { useEffect, useMemo, useState } from 'react';
import { api, backendStatus, type BackendStatus } from '@/lib/api';

type HealthPayload = {
  success?: boolean;
  message?: string;
  version?: string;
  timestamp?: string;
  uptimeSec?: number;
  db?: { healthy?: boolean; latency?: number };
  config?: { ok?: boolean; errors?: number; warnings?: number };
};

const statusColor = (status: BackendStatus, okDetails: boolean) => {
  if (status === 'down') return 'bg-error-600';
  if (status === 'ok' && okDetails) return 'bg-success-600';
  return 'bg-warning-600';
};

const StatusDot: React.FC<{ colorClass: string }> = ({ colorClass }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />
);

const formatLatency = (lat?: number) => {
  if (typeof lat !== 'number') return '—';
  return `${lat} ms`;
};

type HealthStatusProps = { intervalMs?: number };
const HealthStatus: React.FC<HealthStatusProps> = ({ intervalMs = 60000 }) => {
  const [status, setStatus] = useState<BackendStatus>('down');
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(typeof document !== 'undefined' ? !document.hidden : true);
  const okDetails = useMemo(() => {
    const p = payload || {};
    const dbOk = !!p.db?.healthy;
    const cfgOk = !!p.config?.ok && (p.config?.errors ?? 0) === 0;
    return dbOk && cfgOk;
  }, [payload]);

  useEffect(() => {
    const listener = (s: BackendStatus) => setStatus(s);
    backendStatus.onStatus(listener);
    return () => backendStatus.offStatus(listener);
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    const fetchHealth = async () => {
      try {
        const res = await api.get('/health', { __suppressGlobalError: true } as any);
        const data = (res.data?.data ?? res.data) as HealthPayload;
        setPayload(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch {
        // Mantener último payload conocido pero marcar degradado visualmente
        setPayload((prev) => prev ? { ...prev, message: 'Unavailable' } : null);
      }
    };
    // Primer intento inmediato
    fetchHealth();
    // Polling basado en visibilidad
    if (visible) {
      timer = window.setInterval(fetchHealth, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, intervalMs]);

  const colorClass = statusColor(status, okDetails);
  const ver = payload?.version || '—';
  const dbHealthy = payload?.db?.healthy ? 'OK' : 'Error';
  const cfgOk = payload?.config?.ok ? 'OK' : 'Error';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-base-ivory border border-line-soft rounded-lg">
      <StatusDot colorClass={colorClass} />
      <span className="text-sm text-text-warm">Servidor</span>
      <span className="text-xs text-text-muted">v{ver}</span>
      <span className="text-xs text-text-muted">DB: {dbHealthy}</span>
      <span className="text-xs text-text-muted">Cfg: {cfgOk}</span>
      <span className="text-xs text-text-muted">{formatLatency(payload?.db?.latency)}</span>
      {lastUpdated && (
        <span className="text-xs text-text-soft">{lastUpdated}</span>
      )}
    </div>
  );
};

export default HealthStatus;
