import axios from "../lib/api";

export interface HealthModuleStatus {
  ok: boolean;
  message?: string;
}

export interface HealthDbStatus {
  healthy: boolean;
  latencyMs?: number;
}

export interface HealthConfigStatus {
  ok: boolean;
  missing?: string[];
}

export interface HealthInventoryStatus {
  tablesExist?: boolean;
  ledgerCount?: number;
  lowStockCount?: number;
}

export interface HealthSalesStatus {
  ok: boolean;
  degraded?: boolean;
  message?: string;
}

export interface HealthMetricsSummary {
  totals: {
    info: number;
    warning: number;
    error: number;
    exception: number;
  };
  countsBySeverity: Array<{
    severity: "info" | "warning" | "error" | "exception";
    count: number;
  }>;
}

export interface ErrorBudgetSummary {
  windowHours: number;
  errorCount: number;
  warningCount: number;
}

export interface HealthPayload {
  success: boolean;
  message?: string;
  timestamp: string;
  version?: string;
  uptimeSec: number;
  db: HealthDbStatus;
  config: HealthConfigStatus;
  modules: {
    jobQueue: HealthModuleStatus;
    filesystem: HealthModuleStatus;
    offlineStorage: HealthModuleStatus;
  };
  degradation?: {
    degraded: boolean;
    causes: string[];
  };
  metrics: HealthMetricsSummary;
  errorBudget: ErrorBudgetSummary;
  inventory?: HealthInventoryStatus;
  sales?: HealthSalesStatus;
}

export interface HealthMetricsPayload {
  windowHours: number;
  countsBySeverity: Array<{
    severity: "info" | "warning" | "error" | "exception";
    count: number;
  }>;
  totals: {
    info: number;
    warning: number;
    error: number;
    exception: number;
  };
}

export async function fetchHealth(): Promise<HealthPayload> {
  const res = await axios.get<HealthPayload>("/health", { __suppressGlobalError: true } as any);
  return res.data;
}

export async function fetchHealthMetrics(windowHours?: number): Promise<HealthMetricsPayload> {
  const res = await axios.get<HealthMetricsPayload>("/health/metrics", { params: typeof windowHours === 'number' ? { windowHours } : undefined, __suppressGlobalError: true } as any);
  return res.data;
}
