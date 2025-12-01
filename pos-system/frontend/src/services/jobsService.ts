import { api } from '@/lib/api';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: string | null;
  availableAt?: string | null;
  lockedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobsListResponse {
  success: boolean;
  jobs?: JobRecord[];
  data?: { items?: JobRecord[] };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string;
}

export interface JobSingleResponse {
  success: boolean;
  job?: JobRecord;
  data?: JobRecord;
  error?: string;
}

export interface JobsHealth {
  success: boolean;
  running: boolean;
  intervalMs?: number;
  // Campos opcionales expuestos por /jobs/health cuando el backend los soporta
  pendingCount?: number;
  processingCount?: number;
  failedCount?: number;
  queueAgeMsStats?: { min?: number; p95?: number; max?: number };
  processingTimeMsStats?: { min?: number; p95?: number; max?: number };
}

export async function fetchJobs(params?: { type?: string; status?: JobStatus; limit?: number; page?: number }): Promise<JobsListResponse> {
  const res = await api.get('/jobs', { params } as any);
  const raw = res.data || {};
  const jobs = (raw.jobs || raw.data?.items || []) as JobRecord[];
  return { success: !!raw.success, jobs, pagination: raw.pagination, error: raw.error };
}

export async function enqueueJob(input: { type: string; payload?: unknown; scheduledAt?: string | null }): Promise<JobSingleResponse> {
  const res = await api.post('/jobs', input);
  const raw = res.data || {};
  const job = (raw.job || raw.data) as JobRecord;
  return { success: !!raw.success, job, error: raw.error };
}

export async function fetchJobById(id: string): Promise<JobSingleResponse> {
  const res = await api.get(`/jobs/${id}`);
  const raw = res.data || {};
  const job = (raw.job || raw.data) as JobRecord;
  return { success: !!raw.success, job, error: raw.error };
}

export async function retryJob(id: string): Promise<{ success: boolean; error?: string; job?: JobRecord }>{
  const res = await api.post(`/jobs/${id}/retry`);
  const raw = res.data || {};
  return { success: !!raw.success, error: raw.error, job: raw.job };
}

export async function fetchJobsHealth(): Promise<JobsHealth> {
  const res = await api.get('/jobs/health');
  const raw = res.data || {};
  if (raw.success === undefined && typeof raw.running === 'boolean') {
    return { success: true, running: !!raw.running, intervalMs: raw.intervalMs };
  }
  return { success: !!raw.success, running: !!raw.running, intervalMs: raw.intervalMs };
}
