import { api, normalizeListPayload } from '@/lib/api';

export type EventSeverity = 'info' | 'warning' | 'error' | 'exception';

export interface EventRecord {
  id?: string | number;
  type: string;
  severity: EventSeverity;
  message?: string;
  context?: Record<string, unknown> | string | null;
  userId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventQueryParams {
  type?: string;
  severity?: EventSeverity;
  from?: string; // ISO string
  to?: string;   // ISO string
  page?: number;
  limit?: number;
  search?: string;
}

export interface EventsResult {
  items: EventRecord[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface MetricsSummary {
  countsByType?: Record<string, number>;
  countsBySeverity?: Record<string, number>;
  latestError?: EventRecord | null;
  windowHours?: number;
  latencyByRoute?: Array<{ url: string; method?: string; count: number; avgMs: number; p50Ms?: number; p95Ms: number; p99Ms?: number }>;
}

export async function fetchEvents(params: EventQueryParams = {}): Promise<EventsResult> {
  const response = await api.get('/events', { params, __suppressGlobalError: true } as any);
  const items = normalizeListPayload<EventRecord>(response.data);
  const pagination = (response?.data?.data?.pagination || (response?.data?.pagination) || undefined);
  return { items, pagination };
}

export async function fetchMetrics(params?: { windowHours?: number; from?: string; to?: string }): Promise<MetricsSummary> {
  const response = await api.get('/metrics', { params, __suppressGlobalError: true } as any);
  const data = (response?.data?.data || response?.data || {}) as MetricsSummary;
  return data;
}
